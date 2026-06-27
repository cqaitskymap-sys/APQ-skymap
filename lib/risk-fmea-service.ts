import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { RISK_ASSESSMENT_COLLECTION, type RiskControlRecord } from '@/lib/cpv-risk-assessment-records';
import { fetchRiskAssessmentById, fetchRiskAssessmentRecords } from '@/lib/cpv-risk-assessment-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { updateRecord } from '@/lib/firestore';
import { normalizeRole } from '@/lib/permissions';
import {
  buildDefaultFmeaHeader,
  buildSeedFmeaRow,
  computeFmeaCharts,
  computeFmeaDashboardMetrics,
  enrichFmeaRow,
  hasResidualHighRisk,
  RISK_FMEA_COLLECTION,
  RISK_FMEA_MODULE,
  requiresCsvReview,
  requiresHeadQaReview,
  requiresRegulatoryReview,
  type FmeaRow,
  type RiskFmeaActor,
  type RiskFmeaHeaderInput,
  type RiskFmeaRecord,
} from '@/lib/risk-fmea-records';

const NOTIFICATIONS = 'notifications';
const AUDIT_TRAIL = 'audit_trail';
const nowIso = () => new Date().toISOString();

function buildFmeaId(riskNumber: string) {
  return `FMEA-${riskNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

async function audit(actor: RiskFmeaActor, actionType: string, recordId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: RISK_FMEA_MODULE,
      collectionName: RISK_FMEA_COLLECTION,
      recordId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('fmea audit', e);
  }
}

async function notify(title: string, message: string, recordId: string, userId?: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
      title,
      message,
      module: RISK_FMEA_MODULE,
      record_id: recordId,
      user_id: userId || '',
      read: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('fmea notify', e);
  }
}

async function notifyRole(title: string, message: string, recordId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
        title,
        message,
        module: RISK_FMEA_MODULE,
        record_id: recordId,
        target_role: role,
        read: false,
        created_at: nowIso(),
      });
    } catch (e) {
      console.error('fmea notify role', e);
    }
  }
}

function normalizeRows(rows: FmeaRow[]): FmeaRow[] {
  return rows.map(enrichFmeaRow);
}

function buildFmeaPayload(
  riskId: string,
  riskNumber: string,
  header: RiskFmeaHeaderInput,
  rows: FmeaRow[],
  actor: RiskFmeaActor,
  existing?: RiskFmeaRecord | null,
): Omit<RiskFmeaRecord, 'id'> {
  const normalized = normalizeRows(rows);
  const highest = normalized.length ? Math.max(...normalized.map((r) => r.rpn)) : 0;
  const highestResidual = normalized.length ? Math.max(...normalized.map((r) => r.residual_rpn)) : 0;
  const ts = nowIso();
  return {
    fmea_id: existing?.fmea_id || buildFmeaId(riskNumber),
    risk_assessment_id: riskId,
    risk_number: riskNumber,
    fmea_title: header.fmea_title,
    department: header.department,
    product: header.product,
    process_area: header.process_area,
    assessment_date: header.assessment_date,
    facilitator: header.facilitator,
    team_members: header.team_members,
    review_date: header.review_date,
    status: header.status,
    rows: normalized,
    highest_rpn: highest,
    highest_residual_rpn: highestResidual,
    created_at: existing?.created_at || ts,
    updated_at: ts,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    is_deleted: false,
  };
}

export async function getRiskFmea(riskAssessmentId: string): Promise<RiskFmeaRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_FMEA_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
      where('is_deleted', '==', false),
      orderBy('updated_at', 'desc'),
      limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as RiskFmeaRecord;
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_FMEA_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
      limit(1),
    ));
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    if (d.is_deleted) return null;
    return { id: snap.docs[0].id, ...d } as RiskFmeaRecord;
  }
}

export async function listAllFmea(max = 300): Promise<RiskFmeaRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_FMEA_COLLECTION),
      where('is_deleted', '==', false),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskFmeaRecord));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RISK_FMEA_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskFmeaRecord)).filter((r) => !r.is_deleted);
  }
}

export async function fetchFmeaPageData(riskAssessmentId: string, actorName: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const risk = await fetchRiskAssessmentById(riskAssessmentId);
    if (!risk) return { error: 'Risk assessment not found.' };
    const fmea = await getRiskFmea(riskAssessmentId);
    const defaultHeader = fmea ? {
      fmea_title: fmea.fmea_title,
      department: fmea.department,
      product: fmea.product,
      process_area: fmea.process_area,
      assessment_date: fmea.assessment_date,
      facilitator: fmea.facilitator,
      team_members: fmea.team_members || [],
      review_date: fmea.review_date,
      status: fmea.status,
    } : buildDefaultFmeaHeader(risk, actorName);
    const defaultRows = fmea?.rows?.length ? fmea.rows.map(enrichFmeaRow) : [buildSeedFmeaRow(risk)];
    const auditLogs = await getAuditLogs(riskAssessmentId);
    return { risk, fmea, defaultHeader, defaultRows, auditLogs };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load FMEA page' };
  }
}

async function getAuditLogs(riskId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), AUDIT_TRAIL),
      where('recordId', '==', riskId),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function fetchFmeaDashboardData() {
  const [fmeaRecords, risks] = await Promise.all([
    listAllFmea(),
    isFirebaseConfigured() ? fetchRiskAssessmentRecords() : Promise.resolve([]),
  ]);
  return {
    fmeaRecords,
    risks,
    metrics: computeFmeaDashboardMetrics(fmeaRecords),
    charts: computeFmeaCharts(fmeaRecords),
  };
}

export async function saveFmeaDraft(
  riskAssessmentId: string,
  header: RiskFmeaHeaderInput,
  rows: FmeaRow[],
  actor: RiskFmeaActor,
): Promise<RiskFmeaRecord> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const existing = await getRiskFmea(riskAssessmentId);
  const payload = buildFmeaPayload(risk.id, risk.riskNumber, { ...header, status: 'Draft' }, rows, actor, existing);
  if (existing?.id) {
    await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), payload);
    await audit(actor, 'failure mode added', riskAssessmentId, `Rows: ${payload.rows.length}`);
    return { id: existing.id, ...payload };
  }
  const ref = await addDoc(collection(getFirebaseFirestore(), RISK_FMEA_COLLECTION), payload);
  await audit(actor, 'FMEA created', riskAssessmentId, payload.fmea_id);
  await notify('FMEA Created', `${risk.riskNumber} FMEA created`, riskAssessmentId, risk.createdBy);
  return { id: ref.id, ...payload };
}

export async function submitFmeaForReview(
  riskAssessmentId: string,
  header: RiskFmeaHeaderInput,
  rows: FmeaRow[],
  actor: RiskFmeaActor,
): Promise<RiskFmeaRecord> {
  if (!rows.length) throw new Error('At least one failure mode is required');
  rows.forEach((r) => {
    const enriched = enrichFmeaRow(r);
    if (enriched.rpn >= 101 && !enriched.mitigation_action.trim()) {
      throw new Error(`Mitigation action required for high/critical risk: ${enriched.failure_mode}`);
    }
  });
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('Save FMEA draft first');
  const payload = buildFmeaPayload(risk.id, risk.riskNumber, { ...header, status: 'Under Review' }, rows, actor, existing);
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), payload);
  await audit(actor, 'review completed', riskAssessmentId);
  await audit(actor, 'RPN calculated', riskAssessmentId, `Highest RPN ${payload.highest_rpn}`);
  await notifyRole('FMEA Under Review', `${risk.riskNumber} submitted for QA review`, riskAssessmentId, ['qa', 'qa_manager', 'risk_manager']);
  if (requiresHeadQaReview(payload.rows)) await notifyRole('Critical FMEA Risk', risk.riskNumber, riskAssessmentId, ['head_qa']);
  if (requiresCsvReview(payload.rows, risk)) await notifyRole('CSV Risk in FMEA', risk.riskNumber, riskAssessmentId, ['csv_manager']);
  if (requiresRegulatoryReview(payload.rows, risk)) await notifyRole('Regulatory Risk in FMEA', risk.riskNumber, riskAssessmentId, ['regulatory_affairs']);
  return { id: existing.id, ...payload };
}

function controlsFromRows(rows: FmeaRow[]): RiskControlRecord[] {
  return rows.map((r) => ({
    controlId: r.failure_mode_id,
    controlDescription: r.mitigation_action || r.existing_control || r.failure_mode,
    controlType: r.mitigation_required ? 'Mitigation' : 'Control',
    owner: r.action_owner || '',
    targetDate: r.target_date || '',
    status: r.status || 'Open',
    effectiveness: ['High', 'Critical'].includes(r.residual_risk_priority) ? 'Pending' : 'Effective',
  }));
}

export async function approveFmea(
  riskAssessmentId: string,
  actor: RiskFmeaActor,
): Promise<RiskFmeaRecord> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('FMEA record not found');
  const rows = normalizeRows(existing.rows || []);
  const actorRole = normalizeRole(actor.role || '');
  if (requiresHeadQaReview(rows) && !['head_qa', 'super_admin', 'admin'].includes(actorRole)) {
    throw new Error('Critical FMEA requires Head QA approval');
  }
  if (hasResidualHighRisk(rows)) {
    throw new Error('Residual High/Critical risks require additional mitigation before approval');
  }

  const payload = {
    status: 'Approved',
    rows,
    highest_rpn: Math.max(...rows.map((r) => r.rpn), 0),
    highest_residual_rpn: Math.max(...rows.map((r) => r.residual_rpn), 0),
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), payload);
  await audit(actor, 'approved', riskAssessmentId, `Highest RPN ${payload.highest_rpn}`);
  await audit(actor, 'residual risk calculated', riskAssessmentId, `Highest Residual RPN ${payload.highest_residual_rpn}`);

  await updateRecord(RISK_ASSESSMENT_COLLECTION, riskAssessmentId, {
    rpnScore: payload.highest_rpn,
    riskLevel: payload.highest_rpn >= 201 ? 'Critical' : payload.highest_rpn >= 101 ? 'High' : payload.highest_rpn >= 51 ? 'Medium' : 'Low',
    workflowStatus: 'Mitigation',
    riskStatus: 'Mitigation In Progress',
    controls: controlsFromRows(rows),
    potentialCause: rows[0]?.potential_cause || risk.potentialCause,
    potentialImpact: rows[0]?.potential_effect || risk.potentialImpact,
    mitigationAction: rows.filter((r) => r.mitigation_action).map((r) => r.mitigation_action).join('; ').slice(0, 1000),
    updatedByName: actor.name,
  }, { moduleName: RISK_FMEA_MODULE, actor: { id: actor.id, name: actor.name } });

  await notify('FMEA Approved', `${risk.riskNumber} FMEA approved`, riskAssessmentId, risk.createdBy);
  return { ...existing, ...payload };
}

export async function rejectFmea(riskAssessmentId: string, reason: string, actor: RiskFmeaActor): Promise<void> {
  if (!reason.trim()) throw new Error('Reject reason is required');
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('FMEA record not found');
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), {
    status: 'Rejected',
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'rejected', riskAssessmentId, reason);
}

export async function closeFmea(riskAssessmentId: string, actor: RiskFmeaActor): Promise<void> {
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('FMEA record not found');
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), {
    status: 'Closed',
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'closed', riskAssessmentId);
}

export async function updateFmeaRow(
  riskAssessmentId: string,
  row: FmeaRow,
  actor: RiskFmeaActor,
): Promise<RiskFmeaRecord> {
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('FMEA record not found');
  const rows = (existing.rows || []).map((r) => (r.failure_mode_id === row.failure_mode_id ? enrichFmeaRow(row) : enrichFmeaRow(r)));
  const payload = {
    rows,
    highest_rpn: Math.max(...rows.map((r) => r.rpn), 0),
    highest_residual_rpn: Math.max(...rows.map((r) => r.residual_rpn), 0),
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), payload);
  await audit(actor, 'RPN calculated', riskAssessmentId, row.failure_mode_id);
  return { ...existing, ...payload };
}

export async function addFmeaRow(
  riskAssessmentId: string,
  row: FmeaRow,
  actor: RiskFmeaActor,
): Promise<RiskFmeaRecord> {
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('FMEA record not found');
  const rows = [...(existing.rows || []), enrichFmeaRow(row)];
  const payload = {
    rows,
    highest_rpn: Math.max(...rows.map((r) => r.rpn), 0),
    highest_residual_rpn: Math.max(...rows.map((r) => r.residual_rpn), 0),
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), payload);
  await audit(actor, 'failure mode added', riskAssessmentId, row.failure_mode);
  return { ...existing, ...payload };
}

export async function removeFmeaRow(
  riskAssessmentId: string,
  failureModeId: string,
  actor: RiskFmeaActor,
): Promise<RiskFmeaRecord> {
  const existing = await getRiskFmea(riskAssessmentId);
  if (!existing) throw new Error('FMEA record not found');
  const rows = (existing.rows || []).filter((r) => r.failure_mode_id !== failureModeId);
  const payload = {
    rows,
    highest_rpn: rows.length ? Math.max(...rows.map((r) => r.rpn), 0) : 0,
    highest_residual_rpn: rows.length ? Math.max(...rows.map((r) => r.residual_rpn), 0) : 0,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, existing.id), payload);
  await audit(actor, 'Updated', riskAssessmentId, `Removed ${failureModeId}`);
  return { ...existing, ...payload };
}

export async function softDeleteFmea(id: string, actor: RiskFmeaActor) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getFirebaseFirestore(), RISK_FMEA_COLLECTION, id), {
    is_deleted: true,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
}
