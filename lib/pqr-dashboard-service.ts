import {
  collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { PQR_COLLECTIONS } from '@/lib/pqr-types';
import {
  PQR_DASHBOARD_COLLECTIONS, PQR_DASHBOARD_MODULE,
  emptyCharts, emptyKpis, normalizePqrStatus,
  type PqrActivityEntry, type PqrCriticalAlertRow, type PqrDashboardCharts,
  type PqrDashboardData, type PqrDashboardFilters, type PqrDashboardKpis,
  type PqrDueRow, type PqrPendingApprovalRow, type PqrRecordRow,
} from '@/lib/pqr-dashboard-records';

export type PqrDashboardActor = { id: string; name: string; role?: string };

const round = (v: number, d = 1) => Number(v.toFixed(d));

function avg(vals: number[], d = 1): number {
  if (!vals.length) return 0;
  return round(vals.reduce((a, b) => a + b, 0) / vals.length, d);
}

function nowIso() {
  return new Date().toISOString();
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function num(v: unknown, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function monthKey(raw?: string): string {
  if (!raw) return 'Unknown';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inDateRange(raw: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const d = parseDate(raw);
  if (!d) return true;
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(`${to}T23:59:59`)) return false;
  return true;
}

async function readCollection(name: string, max = 500): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), name),
      orderBy('createdAt', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`readCollection ${name} failed`, e);
      return [];
    }
  }
}

async function readFirst(names: string[], max = 500): Promise<Record<string, unknown>[]> {
  for (const name of names) {
    const rows = await readCollection(name, max);
    if (rows.length) return rows;
  }
  return [];
}

function mapPqrRecord(raw: Record<string, unknown>): PqrRecordRow {
  const status = normalizePqrStatus(str(raw.status || raw.document_status, 'Draft'));
  return {
    id: str(raw.id),
    pqrNumber: str(raw.pqrNumber || raw.pqr_number, 'PQR-DRAFT'),
    product: str(raw.productName || raw.product_name || raw.product),
    reviewPeriod: `${str(raw.reviewPeriodFrom || raw.review_period_from)} — ${str(raw.reviewPeriodTo || raw.review_period_to)}`.replace(/^ — | — $/g, '') || str(raw.reviewPeriod || raw.review_period),
    status,
    preparedBy: str(raw.preparedBy || raw.created_by || raw.createdByName, '—'),
    pendingWith: str(raw.pendingWith || raw.pending_with, '—'),
    createdDate: str(raw.createdAt || raw.created_at).slice(0, 10),
    dueDate: str(raw.dueDate || raw.next_review_due_date || raw.nextReviewDueDate),
    reviewYear: num(raw.reviewYear || raw.pqr_year || raw.pqrYear, new Date().getFullYear()),
  };
}

function filterPqrRecords(rows: PqrRecordRow[], filters: PqrDashboardFilters): PqrRecordRow[] {
  return rows.filter((r) => {
    if (filters.product && filters.product !== 'all' && r.product !== filters.product) return false;
    if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
    if (filters.reviewYear && filters.reviewYear !== 'all' && String(r.reviewYear) !== filters.reviewYear) return false;
    if (filters.preparedBy && filters.preparedBy !== 'all' && r.preparedBy !== filters.preparedBy) return false;
    if (filters.pendingWith && filters.pendingWith !== 'all' && r.pendingWith !== filters.pendingWith) return false;
    if (!inDateRange(r.createdDate, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
}

function buildCharts(
  pqrs: PqrRecordRow[],
  batches: Record<string, unknown>[],
  deviations: Record<string, unknown>[],
  oos: Record<string, unknown>[],
  capa: Record<string, unknown>[],
  yields: Record<string, unknown>[],
  cqa: Record<string, unknown>[],
  stability: Record<string, unknown>[],
  complaints: Record<string, unknown>[],
  recalls: Record<string, unknown>[],
  approvals: Record<string, unknown>[],
): PqrDashboardCharts {
  const statusMap = new Map<string, number>();
  pqrs.forEach((p) => statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1));

  const monthCreate = new Map<string, number>();
  pqrs.forEach((p) => {
    const k = monthKey(p.createdDate);
    monthCreate.set(k, (monthCreate.get(k) || 0) + 1);
  });

  const productMap = new Map<string, { draft: number; review: number; approved: number }>();
  pqrs.forEach((p) => {
    const cur = productMap.get(p.product) || { draft: 0, review: 0, approved: 0 };
    if (p.status === 'Draft') cur.draft += 1;
    else if (p.status === 'Under Review') cur.review += 1;
    else if (p.status === 'Approved') cur.approved += 1;
    productMap.set(p.product, cur);
  });

  const batchMonth = new Map<string, { released: number; rejected: number }>();
  batches.forEach((b) => {
    const k = monthKey(str(b.manufacturingDate || b.manufacturing_date || b.createdAt));
    const cur = batchMonth.get(k) || { released: 0, rejected: 0 };
    const rs = str(b.releaseStatus || b.release_status || b.batchStatus, '').toLowerCase();
    if (rs.includes('reject')) cur.rejected += 1;
    else if (rs.includes('release')) cur.released += 1;
    batchMonth.set(k, cur);
  });

  const qualityMonth = new Map<string, { deviations: number; oos: number; capa: number }>();
  const bumpQuality = (rows: Record<string, unknown>[], key: 'deviations' | 'oos' | 'capa') => {
    rows.forEach((r) => {
      const k = monthKey(str(r.createdAt || r.openDate || r.reportedDate));
      const cur = qualityMonth.get(k) || { deviations: 0, oos: 0, capa: 0 };
      cur[key] += 1;
      qualityMonth.set(k, cur);
    });
  };
  bumpQuality(deviations, 'deviations');
  bumpQuality(oos, 'oos');
  bumpQuality(capa, 'capa');

  const yieldMonth = new Map<string, number[]>();
  yields.forEach((y) => {
    const k = monthKey(str(y.recordedDate || y.manufacturingDate || y.createdAt));
    const list = yieldMonth.get(k) || [];
    list.push(num(y.yieldPercentage || y.yieldPercent || y.observedValue));
    yieldMonth.set(k, list);
  });

  const assayMonth = new Map<string, number[]>();
  cqa.forEach((r) => {
    const param = str(r.parameterName || r.testParameter || r.parameter).toLowerCase();
    if (!param.includes('assay')) return;
    const k = monthKey(str(r.testDate || r.recordedDate || r.createdAt));
    const list = assayMonth.get(k) || [];
    list.push(num(r.resultValue || r.observedValue));
    assayMonth.set(k, list);
  });

  const stabMonth = new Map<string, number[]>();
  stability.forEach((s) => {
    const k = monthKey(str(s.testDate || s.recordedDate || s.createdAt));
    const list = stabMonth.get(k) || [];
    list.push(num(s.resultValue || s.observedValue || s.assay));
    stabMonth.set(k, list);
  });

  const crMonth = new Map<string, { complaints: number; recalls: number }>();
  complaints.forEach((c) => {
    const k = monthKey(str(c.createdAt || c.receivedDate));
    const cur = crMonth.get(k) || { complaints: 0, recalls: 0 };
    cur.complaints += 1;
    crMonth.set(k, cur);
  });
  recalls.forEach((r) => {
    const k = monthKey(str(r.createdAt || r.initiatedDate));
    const cur = crMonth.get(k) || { complaints: 0, recalls: 0 };
    cur.recalls += 1;
    crMonth.set(k, cur);
  });

  const apprMonth = new Map<string, number>();
  approvals.filter((a) => str(a.status).toLowerCase() === 'pending').forEach((a) => {
    const k = monthKey(str(a.createdAt || a.approval_date));
    apprMonth.set(k, (apprMonth.get(k) || 0) + 1);
  });

  const sortMonths = (entries: [string, unknown][]) =>
    entries.sort(([a], [b]) => a.localeCompare(b)).slice(-6);

  return {
    statusDistribution: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
    monthlyCreationTrend: sortMonths(Array.from(monthCreate.entries())).map(([month, value]) => ({ month, value: value as number })),
    productStatus: Array.from(productMap.entries()).slice(0, 8).map(([product, v]) => ({ product, ...v })),
    batchReleaseTrend: sortMonths(Array.from(batchMonth.entries())).map(([month, v]) => ({ month, ...(v as { released: number; rejected: number }) })),
    qualityTrend: sortMonths(Array.from(qualityMonth.entries())).map(([month, v]) => ({ month, ...(v as { deviations: number; oos: number; capa: number }) })),
    yieldTrend: sortMonths(Array.from(yieldMonth.entries())).map(([month, vals]) => ({
      month,
      value: avg(vals as number[]),
    })),
    assayTrend: sortMonths(Array.from(assayMonth.entries())).map(([month, vals]) => ({
      month,
      value: avg(vals as number[]),
    })),
    stabilityTrend: sortMonths(Array.from(stabMonth.entries())).map(([month, vals]) => ({
      month,
      value: avg(vals as number[]),
    })),
    complaintRecallTrend: sortMonths(Array.from(crMonth.entries())).map(([month, v]) => ({ month, ...(v as { complaints: number; recalls: number }) })),
    approvalPendingTrend: sortMonths(Array.from(apprMonth.entries())).map(([month, value]) => ({ month, value: value as number })),
  };
}

function computeKpis(
  pqrs: PqrRecordRow[],
  batches: Record<string, unknown>[],
  deviations: Record<string, unknown>[],
  oos: Record<string, unknown>[],
  capa: Record<string, unknown>[],
  changeControls: Record<string, unknown>[],
  complaints: Record<string, unknown>[],
  recalls: Record<string, unknown>[],
  yields: Record<string, unknown>[],
  cqa: Record<string, unknown>[],
  capability: Record<string, unknown>[],
  risks: Record<string, unknown>[],
  approvals: Record<string, unknown>[],
): PqrDashboardKpis {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const countStatus = (s: string) => pqrs.filter((p) => p.status === s).length;

  const overduePqrs = pqrs.filter((p) => {
    if (['Approved', 'Archived'].includes(p.status)) return false;
    const due = parseDate(p.dueDate);
    return due ? due < today : false;
  }).length;

  const dueThisMonth = pqrs.filter((p) => {
    const due = parseDate(p.dueDate);
    return due ? due >= monthStart && due <= monthEnd : false;
  }).length;

  const products = new Set(pqrs.map((p) => p.product).filter(Boolean));

  const released = batches.filter((b) => str(b.releaseStatus || b.release_status, '').toLowerCase().includes('release')).length;
  const rejected = batches.filter((b) => str(b.releaseStatus || b.release_status, '').toLowerCase().includes('reject')).length;

  const yieldVals = yields.map((y) => num(y.yieldPercentage || y.yieldPercent || y.observedValue)).filter((v) => v > 0);
  const assayVals = cqa.filter((r) => str(r.parameterName || r.testParameter).toLowerCase().includes('assay'))
    .map((r) => num(r.resultValue || r.observedValue)).filter((v) => v > 0);
  const cpkVals = capability.map((c) => num(c.cpk || c.Cpk)).filter((v) => v > 0);

  const openRisks = risks.filter((r) => !['closed', 'Closed'].includes(str(r.status))).length;
  const pendingApprovals = approvals.filter((a) => str(a.status).toLowerCase() === 'pending').length;

  return {
    totalPqrs: pqrs.length,
    draftPqrs: countStatus('Draft'),
    underReviewPqrs: countStatus('Under Review'),
    approvedPqrs: countStatus('Approved'),
    rejectedPqrs: countStatus('Rejected'),
    archivedPqrs: countStatus('Archived'),
    pqrsDueThisMonth: dueThisMonth,
    overduePqrs,
    totalProductsReviewed: products.size,
    totalBatchesReviewed: batches.length,
    releasedBatches: released,
    rejectedBatches: rejected,
    deviationCount: deviations.length,
    oosCount: oos.length,
    capaCount: capa.length,
    changeControlCount: changeControls.length,
    marketComplaintCount: complaints.length,
    recallCount: recalls.length,
    averageYieldPct: yieldVals.length ? round(yieldVals.reduce((a, b) => a + b, 0) / yieldVals.length) : 0,
    averageAssayPct: assayVals.length ? round(assayVals.reduce((a, b) => a + b, 0) / assayVals.length) : 0,
    averageCpk: cpkVals.length ? round(cpkVals.reduce((a, b) => a + b, 0) / cpkVals.length, 2) : 0,
    openRisks,
    pendingApprovals,
  };
}

function buildDueRows(pqrs: PqrRecordRow[]): PqrDueRow[] {
  const today = new Date();
  return pqrs
    .filter((p) => !['Approved', 'Archived'].includes(p.status))
    .map((p) => {
      const due = parseDate(p.dueDate);
      const daysOverdue = due && due < today ? Math.ceil((today.getTime() - due.getTime()) / 86400000) : 0;
      return {
        id: p.id,
        product: p.product,
        reviewYear: p.reviewYear || new Date().getFullYear(),
        dueDate: p.dueDate || '—',
        daysOverdue,
        owner: p.preparedBy,
        status: daysOverdue > 0 ? 'Overdue' : p.status,
      };
    })
    .filter((r) => r.daysOverdue > 0 || r.status === 'Under Review')
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 20);
}

function buildPendingApprovals(approvals: Record<string, unknown>[], pqrs: PqrRecordRow[]): PqrPendingApprovalRow[] {
  return approvals
    .filter((a) => str(a.status).toLowerCase() === 'pending')
    .slice(0, 20)
    .map((a) => {
      const pqrId = str(a.pqr_id || a.pqrId);
      const pqr = pqrs.find((p) => p.id === pqrId);
      return {
        id: str(a.id),
        pqrId,
        pqrNumber: pqr?.pqrNumber || '—',
        product: pqr?.product || str(a.productName),
        currentStep: str(a.approval_type || a.approvalType, 'Review'),
        pendingWith: str(a.name || a.designation, '—'),
        dueDate: str(a.approval_date || a.dueDate).slice(0, 10) || '—',
        priority: str(a.priority, 'Medium'),
      };
    });
}

function buildCriticalAlerts(
  deviations: Record<string, unknown>[],
  oos: Record<string, unknown>[],
  recalls: Record<string, unknown>[],
): PqrCriticalAlertRow[] {
  const alerts: PqrCriticalAlertRow[] = [];

  oos.slice(0, 5).forEach((r) => alerts.push({
    id: str(r.id),
    product: str(r.productName || r.product),
    batchNo: str(r.batchNumber || r.batchNo),
    source: 'OOS',
    issue: str(r.title || r.parameterName || 'Out of Specification'),
    riskLevel: 'Critical',
    status: str(r.status, 'Open'),
  }));

  deviations.filter((d) => ['critical', 'high'].includes(str(d.severity || d.riskLevel).toLowerCase())).slice(0, 5).forEach((d) => {
    alerts.push({
      id: str(d.id),
      product: str(d.productName || d.product),
      batchNo: str(d.batchNumber || d.batchNo),
      source: 'Deviation',
      issue: str(d.title || d.deviationTitle),
      riskLevel: str(d.severity || d.riskLevel, 'High'),
      status: str(d.status, 'Open'),
    });
  });

  recalls.slice(0, 3).forEach((r) => alerts.push({
    id: str(r.id),
    product: str(r.productName || r.product),
    batchNo: str(r.batchNumber || r.batchNo),
    source: 'Recall',
    issue: str(r.title || r.recallReason, 'Product Recall'),
    riskLevel: 'Critical',
    status: str(r.status, 'Active'),
  }));

  return alerts.slice(0, 15);
}

async function logDashboardAudit(actionType: string, actor: PqrDashboardActor, detail?: unknown) {
  try {
    await createAuditLog({
      moduleName: PQR_DASHBOARD_MODULE,
      collectionName: PQR_DASHBOARD_COLLECTIONS.records,
      recordId: 'dashboard',
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_DASHBOARD_COLLECTIONS.records,
      documentId: 'dashboard',
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_DASHBOARD_MODULE,
    });
  } catch (e) {
    console.error('logDashboardAudit failed', e);
  }
}

export async function fetchPqrDashboard(filters: PqrDashboardFilters = {}): Promise<PqrDashboardData> {
  if (!isFirebaseConfigured()) {
    return {
      kpis: emptyKpis(),
      charts: emptyCharts(),
      recentPqrs: [],
      duePqrs: [],
      pendingApprovals: [],
      criticalAlerts: [],
      activity: [],
      generatedAt: nowIso(),
    };
  }

  try {
    const [
      pqrRaw, batches, cpvBatches, deviations, oos, capa, changeControls,
      complaints, recalls, yields, cqa, stability, capability, risks, approvals,
    ] = await Promise.all([
      readFirst([PQR_DASHBOARD_COLLECTIONS.records, PQR_DASHBOARD_COLLECTIONS.recordsLegacy, PQR_COLLECTIONS.documents]),
      readFirst([PQR_DASHBOARD_COLLECTIONS.batches, 'pqr_batches']),
      readCollection(PQR_DASHBOARD_COLLECTIONS.cpvBatches, 200),
      readFirst([PQR_DASHBOARD_COLLECTIONS.deviations, 'deviation']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.oosRecords, 'oos']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.capaRecords, 'capa']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.changeControls, 'change_control']),
      readCollection(PQR_DASHBOARD_COLLECTIONS.complaints),
      readFirst([PQR_DASHBOARD_COLLECTIONS.recalls, 'recall_records']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.yieldMonitoring, CPV_COLLECTIONS.yield]),
      readFirst([PQR_DASHBOARD_COLLECTIONS.cqaResults, CPV_COLLECTIONS.cqa, 'cqa_results']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.stabilityMonitoring, 'stability_results']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.processCapability, 'process_capability']),
      readFirst([PQR_DASHBOARD_COLLECTIONS.riskAssessment, CPV_COLLECTIONS.risk]),
      readFirst([PQR_DASHBOARD_COLLECTIONS.approvals, PQR_COLLECTIONS.approvals]),
    ]);

    const allBatches = [...batches, ...cpvBatches];
    let pqrs = pqrRaw.map(mapPqrRecord);
    pqrs = filterPqrRecords(pqrs, filters);

    const kpis = computeKpis(pqrs, allBatches, deviations, oos, capa, changeControls, complaints, recalls, yields, cqa, capability, risks, approvals);
    const charts = buildCharts(pqrs, allBatches, deviations, oos, capa, yields, cqa, stability, complaints, recalls, approvals);

    const activity: PqrActivityEntry[] = [
      ...pqrs.slice(0, 5).map((p) => ({
        action: `PQR ${p.pqrNumber} — ${p.status}`,
        user: p.preparedBy,
        at: p.createdDate,
        detail: p.product,
      })),
      ...approvals.filter((a) => str(a.status).toLowerCase() === 'pending').slice(0, 3).map((a) => ({
        action: 'Approval pending',
        user: str(a.name),
        at: str(a.createdAt).slice(0, 16),
        detail: str(a.approval_type),
      })),
    ].slice(0, 10);

    return {
      kpis,
      charts,
      recentPqrs: pqrs.slice(0, 20),
      duePqrs: buildDueRows(pqrs),
      pendingApprovals: buildPendingApprovals(approvals, pqrs),
      criticalAlerts: buildCriticalAlerts(deviations, oos, recalls),
      activity,
      generatedAt: nowIso(),
    };
  } catch (e) {
    console.error('fetchPqrDashboard failed', e);
    return {
      kpis: emptyKpis(),
      charts: emptyCharts(),
      recentPqrs: [],
      duePqrs: [],
      pendingApprovals: [],
      criticalAlerts: [],
      activity: [],
      generatedAt: nowIso(),
    };
  }
}

export async function refreshPqrDashboard(actor: PqrDashboardActor, filters: PqrDashboardFilters = {}) {
  await logDashboardAudit('dashboard refreshed', actor, filters);
  return fetchPqrDashboard(filters);
}

export async function logPqrDashboardView(actor: PqrDashboardActor) {
  await logDashboardAudit('dashboard viewed', actor);
}

export async function logPqrDashboardFilter(actor: PqrDashboardActor, filters: PqrDashboardFilters) {
  await logDashboardAudit('filter applied', actor, filters);
}

export async function logPqrDashboardExport(actor: PqrDashboardActor, type: 'pdf' | 'excel') {
  await logDashboardAudit(type === 'pdf' ? 'PDF export clicked' : 'Excel export clicked', actor);
}

export async function logPqrOpened(actor: PqrDashboardActor, pqrId: string) {
  await logDashboardAudit('recent PQR opened', actor, { pqrId });
}

export async function fetchPqrProductOptions(): Promise<string[]> {
  const data = await fetchPqrDashboard();
  return Array.from(new Set(data.recentPqrs.map((p) => p.product).filter(Boolean))).sort();
}

export async function fetchPqrYearOptions(): Promise<string[]> {
  const data = await fetchPqrDashboard();
  return Array.from(new Set(data.recentPqrs.map((p) => String(p.reviewYear)).filter(Boolean))).sort().reverse();
}
