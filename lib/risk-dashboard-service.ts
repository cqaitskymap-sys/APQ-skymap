import {
  addDoc, collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchRiskAssessmentRecords, normalizeRiskAssessmentRecord } from '@/lib/cpv-risk-assessment-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { listAllRiskMitigations } from '@/lib/risk-mitigation-service';
import { listAllRiskReviews } from '@/lib/risk-review-monitoring-service';
import {
  RISK_DASHBOARD_MODULE,
  applyDashboardFilters,
  buildDashboardCharts,
  buildDashboardWidgets,
  computeDashboardMetrics,
  filterRecordsForRole,
  getRiskDepartment,
  isOpenRisk,
  toDashboardRow,
  type RiskDashboardActivityEntry,
  type RiskDashboardData,
  type RiskDashboardFilters,
} from '@/lib/risk-dashboard-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';

export type RiskDashboardActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
};

const nowIso = () => new Date().toISOString();

async function audit(actor: RiskDashboardActor, actionType: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: RISK_DASHBOARD_MODULE,
      collectionName: 'risk_assessment',
      recordId: 'risk-dashboard',
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('risk dashboard audit', e);
  }
}

async function fetchAuditActivity(max = 25): Promise<RiskDashboardActivityEntry[]> {
  if (!isFirebaseConfigured()) return [];
  const mapEntry = (data: Record<string, unknown>): RiskDashboardActivityEntry | null => {
    const moduleName = String(data.moduleName || data.module_name || '');
    if (!/risk/i.test(moduleName) && !/risk_assessment/i.test(String(data.collectionName || ''))) return null;
    return {
      action: String(data.actionType || data.action || 'Activity'),
      user: String(data.userName || data.user_name || 'System'),
      at: String(data.dateTime || data.timestamp || data.created_at || nowIso()),
      detail: String(data.actionDescription || data.reason || ''),
      recordId: String(data.recordId || data.documentId || ''),
    };
  };
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), 'audit_trail'),
      orderBy('dateTime', 'desc'),
      limit(max * 3),
    ));
    return snap.docs
      .map((d) => mapEntry(d.data() as Record<string, unknown>))
      .filter((e): e is RiskDashboardActivityEntry => e !== null)
      .slice(0, max);
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), limit(max * 3)));
      return snap.docs
        .map((d) => mapEntry(d.data() as Record<string, unknown>))
        .filter((e): e is RiskDashboardActivityEntry => e !== null)
        .slice(0, max);
    } catch (e) {
      console.error('fetchAuditActivity', e);
      return [];
    }
  }
}

const RISK_ASSESSMENTS_ALIAS = 'risk_assessments';

async function fetchAllDashboardRiskRecords(max = 1000): Promise<RiskAssessmentRecord[]> {
  const primary = await fetchRiskAssessmentRecords(max);
  if (!isFirebaseConfigured()) return primary.filter((r) => !r.isDeleted);

  const byId = new Map(primary.filter((r) => !r.isDeleted).map((r) => [r.id, r]));
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_ASSESSMENTS_ALIAS),
      limit(max),
    ));
    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      if (data.is_deleted || data.isDeleted) return;
      if (!byId.has(d.id)) {
        byId.set(d.id, normalizeRiskAssessmentRecord({ id: d.id, ...data }));
      }
    });
  } catch (e) {
    console.error('fetchAllDashboardRiskRecords alias', e);
  }
  return Array.from(byId.values());
}

function enrichWidgets(
  records: RiskAssessmentRecord[],
  widgets: ReturnType<typeof buildDashboardWidgets>,
  reviews: Awaited<ReturnType<typeof listAllRiskReviews>>,
  mitigations: Awaited<ReturnType<typeof listAllRiskMitigations>>,
) {
  const rowById = new Map(records.map((r) => [r.id, toDashboardRow(r)]));
  const pendingTasks = mitigations
    .filter((m) => !m.is_deleted && ['Draft', 'Assigned', 'In Progress', 'Pending Review', 'Overdue'].includes(m.mitigation_status))
    .slice(0, 10)
    .map((m) => ({
      risk_number: m.risk_number,
      title: m.mitigation_title || m.risk_title,
      owner: m.action_owner || '—',
      due_date: m.target_completion_date || '—',
      status: m.mitigation_status,
    }));

  const upcomingReviews = reviews
    .filter((r) => !r.is_deleted && ['Draft', 'Under Review', 'QA Review'].includes(r.status))
    .sort((a, b) => (a.next_review_date || a.review_date).localeCompare(b.next_review_date || b.review_date))
    .slice(0, 10)
    .map((r) => ({
      risk_number: r.risk_number,
      review_date: r.next_review_date || r.review_date,
      reviewer: r.reviewer || '—',
      status: r.status,
    }));

  const pendingFromRows = records
    .filter((r) => isOpenRisk(r) && widgets.pendingMitigationTasks.some((t) => t.risk_number === r.riskNumber) === false)
    .map(toDashboardRow)
    .filter((r) => r.mitigation_status === 'Pending')
    .slice(0, 10)
    .map((r) => ({
      risk_number: r.risk_number,
      title: r.risk_title,
      owner: r.risk_owner,
      due_date: r.target_date,
      status: r.mitigation_status,
    }));

  return {
    ...widgets,
    pendingMitigationTasks: pendingTasks.length ? pendingTasks : pendingFromRows,
    upcomingReviews,
    top10Critical: widgets.top10Critical.length
      ? widgets.top10Critical
      : Array.from(rowById.values()).sort((a, b) => b.rpn - a.rpn).slice(0, 10),
  };
}

export async function fetchRiskDashboardData(
  filters: RiskDashboardFilters,
  actor: RiskDashboardActor,
): Promise<RiskDashboardData> {
  if (!isFirebaseConfigured()) {
    return {
      metrics: {
        totalRisks: 0, openRisks: 0, closedRisks: 0, criticalRisks: 0, highRisks: 0,
        mediumRisks: 0, lowRisks: 0, pendingMitigation: 0, mitigationInProgress: 0,
        overdueRisks: 0, residualHighRisks: 0, approvedRisks: 0, rejectedRisks: 0, risksUnderReview: 0,
      },
      charts: {
        riskLevelDistribution: [], monthlyRiskTrend: [], riskCategoryTrend: [],
        departmentRiskTrend: [], openVsClosed: [], residualRiskTrend: [],
        mitigationStatusTrend: [], criticalRiskTrend: [], riskClosureTrend: [],
      },
      recentRisks: [],
      criticalRisks: [],
      overdueRisks: [],
      residualHighRisks: [],
      widgets: {
        top10Critical: [], heatMap: [], matrix: [], departmentRanking: [],
        pendingMitigationTasks: [], upcomingReviews: [],
      },
      activity: [],
      departments: ['All'],
      products: ['All'],
      filteredCount: 0,
    };
  }

  try {
    const [records, mitigations, reviews, activity] = await Promise.all([
      fetchAllDashboardRiskRecords(1000),
      listAllRiskMitigations(300).catch(() => []),
      listAllRiskReviews(300).catch(() => []),
      fetchAuditActivity(20),
    ]);

    const roleScoped = filterRecordsForRole(records.filter((r) => !r.isDeleted), actor.role, actor.department);
    const filtered = applyDashboardFilters(roleScoped, filters);
    const metrics = computeDashboardMetrics(roleScoped);
    const charts = buildDashboardCharts(filtered.length ? filtered : roleScoped);
    const rows = filtered.map(toDashboardRow);
    const baseRecords = filtered.length ? filtered : roleScoped;

    const widgets = enrichWidgets(
      baseRecords,
      buildDashboardWidgets(baseRecords),
      reviews,
      mitigations,
    );

    const departments = ['All', ...Array.from(new Set(roleScoped.map(getRiskDepartment))).sort()];
    const products = ['All', ...Array.from(new Set(roleScoped.map((r) => r.productName).filter(Boolean))).sort()];

    return {
      metrics,
      charts,
      recentRisks: [...rows].sort((a, b) => b.risk_number.localeCompare(a.risk_number)).slice(0, 20),
      criticalRisks: rows.filter((r) => r.rpn > 200).sort((a, b) => b.rpn - a.rpn),
      overdueRisks: rows.filter((r) => r.days_overdue > 0).sort((a, b) => b.days_overdue - a.days_overdue),
      residualHighRisks: rows.filter((r) => r.residual_rpn >= 101).sort((a, b) => b.residual_rpn - a.residual_rpn),
      widgets,
      activity,
      departments,
      products,
      filteredCount: filtered.length,
    };
  } catch (e) {
    console.error('fetchRiskDashboardData', e);
    throw new Error(e instanceof Error ? e.message : 'Failed to load risk dashboard');
  }
}

export async function logDashboardViewed(actor: RiskDashboardActor) {
  await audit(actor, 'dashboard viewed');
}

export async function logDashboardRefreshed(actor: RiskDashboardActor) {
  await audit(actor, 'dashboard refreshed');
}

export async function logDashboardFilterApplied(actor: RiskDashboardActor, filters: RiskDashboardFilters) {
  await audit(actor, 'filter applied', JSON.stringify(filters));
}

export async function logRiskOpened(actor: RiskDashboardActor, riskId: string, riskNumber: string) {
  await audit(actor, 'risk opened', `${riskNumber} (${riskId})`);
}

export async function logDashboardExport(actor: RiskDashboardActor, type: 'PDF' | 'Excel') {
  await audit(actor, type === 'PDF' ? 'PDF export clicked' : 'Excel export clicked');
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title: `Risk Dashboard ${type} Export`,
      message: `${actor.name} requested ${type} export (placeholder)`,
      module: RISK_DASHBOARD_MODULE,
      user_id: actor.id,
      read: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('dashboard export notify', e);
  }
}
