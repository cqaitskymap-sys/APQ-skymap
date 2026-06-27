import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  buildRiskAssessmentId,
  buildRiskRowId,
  canApproveCriticalResidual,
  CC_RISK_MODULE,
  computeCcRiskChartData,
  computeCcRiskDashboardMetrics,
  computeCcRiskScores,
  computeOverallRiskLevel,
  computeResidualOverallRiskLevel,
  computeResidualRisk,
  isMitigationRequired,
  requiresCsvReview,
  requiresHeadQaForResidual,
  requiresPatientSafetyNotification,
  requiresRegulatoryReview,
  type CcRiskActor,
  type CcRiskHeaderInput,
  type CcRiskQaReviewInput,
  type CcRiskRowInput,
  validateRiskRowInput,
} from '@/lib/cc-risk-records';
import {
  CC_COLLECTIONS,
  type CcRiskChartData,
  type CcRiskDashboardMetrics,
  type ChangeControlRecord,
  type ChangeRiskAssessment,
} from '@/lib/change-control-types';
import {
  getAuditLogsForChange,
  getChangeById,
  listChanges,
  updateChange,
} from '@/lib/change-control-service';

export type { CcRiskActor, CcRiskHeaderInput, CcRiskRowInput, CcRiskQaReviewInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(
  actor: CcRiskActor,
  actionType: string,
  changeId: string,
  detail?: string,
  recordId?: string,
) {
  try {
    await createAuditLog({
      moduleName: CC_RISK_MODULE,
      collectionName: CC_COLLECTIONS.risk,
      recordId: recordId || changeId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('cc risk audit', e);
  }
}

async function notify(
  title: string,
  message: string,
  changeId: string,
  opts?: { userId?: string; targetRole?: string },
) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.notifications), {
      title, message, module: CC_RISK_MODULE, record_id: changeId,
      ...(opts?.userId ? { user_id: opts.userId } : {}),
      ...(opts?.targetRole ? { target_role: opts.targetRole } : {}),
      read: false, created_at: nowIso(),
    });
  } catch (e) {
    console.error('cc risk notify', e);
  }
}

function normalizeRisk(docId: string, data: Record<string, unknown>): ChangeRiskAssessment {
  const detection = Number(data.detection ?? data.detectability ?? 1);
  const severity = Number(data.severity ?? 1);
  const occurrence = Number(data.occurrence ?? 1);
  const scores = computeCcRiskScores(severity, occurrence, detection);
  const r = {
    id: docId,
    ...data,
    detection,
    detectability: detection,
    severity,
    occurrence,
    rpn: Number(data.rpn ?? scores.rpn),
    risk_level: String(data.risk_level || scores.risk_level),
    record_type: data.record_type as ChangeRiskAssessment['record_type'],
    is_deleted: data.is_deleted ?? false,
  } as ChangeRiskAssessment;
  if (r.residual_severity && r.residual_occurrence && r.residual_detection) {
    const residual = computeResidualRisk(r.residual_severity, r.residual_occurrence, r.residual_detection);
    r.residual_rpn = residual.residual_rpn;
    r.residual_risk_level = residual.residual_risk_level;
  }
  return r;
}

function isHeader(r: ChangeRiskAssessment): boolean {
  return r.record_type === 'header';
}

function isRow(r: ChangeRiskAssessment): boolean {
  return r.record_type === 'risk_row' || (!r.record_type && Boolean(r.risk_description || r.severity));
}

export async function getCcRiskRecords(changeId: string): Promise<ChangeRiskAssessment[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.risk),
      where('change_id', '==', changeId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => normalizeRisk(d.id, d.data() as Record<string, unknown>)).filter((r) => !r.is_deleted);
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.risk),
      where('change_id', '==', changeId),
    ));
    return snap.docs
      .map((d) => normalizeRisk(d.id, d.data() as Record<string, unknown>))
      .filter((r) => !r.is_deleted)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
}

export function getCcRiskHeader(records: ChangeRiskAssessment[]): ChangeRiskAssessment | null {
  return records.find(isHeader) || null;
}

export function getCcRiskRows(records: ChangeRiskAssessment[]): ChangeRiskAssessment[] {
  return records.filter(isRow);
}

export async function getCcRiskAssessment(changeId: string) {
  const records = await getCcRiskRecords(changeId);
  return {
    header: getCcRiskHeader(records),
    rows: getCcRiskRows(records),
    records,
  };
}

export async function listCcRiskAssessments(max = 300) {
  if (!isFirebaseConfigured()) return { headers: [] as (ChangeRiskAssessment & { change?: ChangeControlRecord | null; rows?: ChangeRiskAssessment[] })[], allRows: [] as ChangeRiskAssessment[] };
  const [snap, changes] = await Promise.all([
    getDocs(query(collection(getFirebaseFirestore(), CC_COLLECTIONS.risk), orderBy('updated_at', 'desc'), limit(max * 3))),
    listChanges(),
  ]);
  const changeById = new Map(changes.map((c) => [c.id, c]));
  const all = snap.docs.map((d) => normalizeRisk(d.id, d.data() as Record<string, unknown>)).filter((r) => !r.is_deleted);
  const headers = all.filter(isHeader).slice(0, max).map((h) => ({
    ...h,
    change: changeById.get(h.change_id) || null,
    rows: all.filter((r) => isRow(r) && r.change_id === h.change_id),
  }));
  const legacyChanges = new Map<string, ChangeRiskAssessment[]>();
  for (const r of all.filter((r) => !isHeader(r) && !headers.some((h) => h.change_id === r.change_id))) {
    const list = legacyChanges.get(r.change_id) || [];
    list.push(r);
    legacyChanges.set(r.change_id, list);
  }
  for (const [changeId, legacyRows] of Array.from(legacyChanges.entries())) {
    if (!headers.some((h) => h.change_id === changeId)) {
      const change = changeById.get(changeId) || null;
      headers.push({
        id: `legacy-${changeId}`,
        record_type: 'header',
        change_id: changeId,
        change_control_number: change?.change_control_number,
        risk_assessment_id: buildRiskAssessmentId(change?.change_control_number || changeId),
        assessment_date: legacyRows[0]?.assessed_at?.split('T')[0] || today(),
        assessed_by: legacyRows[0]?.assessed_by || '',
        assessed_by_name: legacyRows[0]?.assessed_by_name || '',
        department: change?.department || 'QA',
        status: 'Draft',
        severity: 0,
        occurrence: 0,
        detectability: 0,
        rpn: 0,
        risk_level: computeOverallRiskLevel(legacyRows),
        mitigation_plan: '',
        assessed_at: legacyRows[0]?.assessed_at || nowIso(),
        created_at: legacyRows[0]?.created_at || nowIso(),
        updated_at: legacyRows[0]?.updated_at || nowIso(),
        change,
        rows: legacyRows,
      });
    }
  }
  return { headers, allRows: all.filter(isRow) };
}

export async function fetchCcRiskPageData(changeId: string) {
  try {
    const [change, assessment, auditLogs] = await Promise.all([
      getChangeById(changeId),
      getCcRiskAssessment(changeId),
      getAuditLogsForChange(changeId),
    ]);
    if (!change) return { error: 'Change control not found' };
    const metrics = computeCcRiskDashboardMetrics(assessment.records);
    return { change, ...assessment, auditLogs, metrics };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load risk assessment' };
  }
}

export async function fetchCcRiskListData() {
  try {
    const { headers, allRows } = await listCcRiskAssessments();
    const changes = await listChanges();
    const metrics = computeCcRiskDashboardMetrics(allRows);
    const charts = computeCcRiskChartData(allRows, changes);
    return { assessments: headers, rows: allRows, changes, metrics, charts };
  } catch (e) {
    return {
      assessments: [] as (ChangeRiskAssessment & { change?: ChangeControlRecord | null })[],
      rows: [] as ChangeRiskAssessment[],
      changes: [] as ChangeControlRecord[],
      metrics: computeCcRiskDashboardMetrics([]),
      charts: computeCcRiskChartData([], []),
      error: e instanceof Error ? e.message : 'Failed to load list',
    };
  }
}

async function syncChangeRiskLevel(changeId: string, rows: ChangeRiskAssessment[], actor: CcRiskActor) {
  const overall = computeOverallRiskLevel(rows);
  await updateChange(changeId, { overall_risk_level: overall }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
}

export async function saveCcRiskHeader(
  input: CcRiskHeaderInput,
  actor: CcRiskActor,
): Promise<{ header?: ChangeRiskAssessment; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const change = await getChangeById(input.change_id);
  if (!change) return { error: 'Change control not found' };

  const records = await getCcRiskRecords(input.change_id);
  const existing = getCcRiskHeader(records);
  const timestamp = nowIso();
  const payload: Partial<ChangeRiskAssessment> = {
    record_type: 'header',
    change_id: change.id,
    change_control_number: change.change_control_number,
    risk_assessment_id: existing?.risk_assessment_id || buildRiskAssessmentId(change.change_control_number),
    assessment_date: input.assessment_date,
    assessed_by: input.assessed_by,
    assessed_by_name: input.assessed_by_name || actor.name,
    department: input.department,
    status: existing?.status || 'Draft',
    severity: 0,
    occurrence: 0,
    detectability: 0,
    rpn: 0,
    risk_level: existing?.risk_level || 'Low',
    mitigation_plan: '',
    assessed_at: timestamp,
    updated_at: timestamp,
    created_by: existing?.created_by || actor.id,
    updated_by: actor.id,
    is_deleted: false,
  };

  let refId = existing?.id;
  if (existing && !existing.id.startsWith('legacy-')) {
    await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.risk, existing.id), payload);
  } else {
    const ref = await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.risk), {
      ...payload, created_at: timestamp,
    });
    refId = ref.id;
    await audit(actor, 'RISK_ASSESSMENT_CREATED', change.id, payload.risk_assessment_id, refId);
  }

  await updateChange(change.id, { status: 'risk_assessment' }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
  return { header: { id: refId!, ...payload } as ChangeRiskAssessment };
}

export async function createCcRiskRow(
  input: CcRiskRowInput,
  actor: CcRiskActor,
  seq?: number,
): Promise<{ row?: ChangeRiskAssessment; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const validationError = validateRiskRowInput(input);
  if (validationError) return { error: validationError };

  const change = await getChangeById(input.change_id);
  if (!change) return { error: 'Change control not found' };

  let header = (await getCcRiskAssessment(input.change_id)).header;
  if (!header || header.id.startsWith('legacy-')) {
    const saved = await saveCcRiskHeader({
      change_id: input.change_id,
      assessment_date: today(),
      assessed_by: actor.id,
      assessed_by_name: actor.name,
      department: change.department,
    }, actor);
    if (saved.error) return { error: saved.error };
    header = saved.header || null;
  }
  if (!header) return { error: 'Risk assessment header not found' };

  const records = await getCcRiskRecords(input.change_id);
  const rows = getCcRiskRows(records);
  const scores = computeCcRiskScores(input.severity, input.occurrence, input.detection);
  const residual = computeResidualRisk(input.residual_severity, input.residual_occurrence, input.residual_detection);
  const timestamp = nowIso();
  const rowNumber = buildRiskRowId(change.change_control_number, seq ?? rows.length + 1);

  const payload: Omit<ChangeRiskAssessment, 'id'> = {
    record_type: 'risk_row',
    change_id: input.change_id,
    risk_assessment_id: header.risk_assessment_id,
    risk_description: input.risk_description,
    risk_category: input.risk_category,
    potential_failure_mode: input.potential_failure_mode || '',
    potential_impact: input.potential_impact || '',
    potential_cause: input.potential_cause || '',
    existing_controls: input.existing_controls || '',
    severity: input.severity,
    occurrence: input.occurrence,
    detection: input.detection,
    detectability: input.detection,
    rpn: scores.rpn,
    risk_level: scores.risk_level,
    mitigation_required: isMitigationRequired(scores.risk_level),
    mitigation_plan: input.mitigation_plan || '',
    mitigation_status: input.mitigation_plan?.trim() ? 'Planned' : 'Pending',
    residual_severity: input.residual_severity ?? null,
    residual_occurrence: input.residual_occurrence ?? null,
    residual_detection: input.residual_detection ?? null,
    residual_rpn: residual.residual_rpn,
    residual_risk_level: residual.residual_risk_level,
    capa_required: input.capa_required ?? false,
    validation_required: input.validation_required ?? false,
    linked_capa_id: input.linked_capa_id ?? null,
    linked_capa_number: input.linked_capa_number || '',
    assessed_by: actor.id,
    assessed_by_name: actor.name,
    assessed_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    updated_by: actor.id,
    is_deleted: false,
  };
  void rowNumber;

  const ref = await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.risk), payload);
  await audit(actor, 'RISK_ROW_ADDED', input.change_id, input.risk_description, ref.id);
  await audit(actor, 'RISK_SCORE_CALCULATED', input.change_id, `RPN ${scores.rpn} (${scores.risk_level})`, ref.id);

  const updatedRecords = await getCcRiskRecords(input.change_id);
  await syncChangeRiskLevel(input.change_id, getCcRiskRows(updatedRecords), actor);

  if (input.risk_category === 'Patient Safety') {
    await notify('Patient Safety Risk Identified', input.risk_description, input.change_id, { targetRole: 'head_qa' });
  }
  if (input.risk_category === 'CSV / Data Integrity') {
    await notify('CSV Risk Review Required', input.risk_description, input.change_id, { targetRole: 'it_csv' });
  }
  if (input.risk_category === 'Regulatory Compliance') {
    await notify('Regulatory Risk Review Required', input.risk_description, input.change_id, { targetRole: 'regulatory' });
  }

  return { row: { id: ref.id, ...payload } };
}

export async function updateCcRiskRow(
  rowId: string,
  input: Partial<CcRiskRowInput>,
  actor: CcRiskActor,
): Promise<{ row?: ChangeRiskAssessment; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const ref = doc(getFirebaseFirestore(), CC_COLLECTIONS.risk, rowId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { error: 'Risk row not found' };
  const existing = normalizeRisk(snap.id, snap.data() as Record<string, unknown>);

  const mergedInput: CcRiskRowInput = {
    change_id: existing.change_id,
    risk_description: input.risk_description ?? existing.risk_description ?? '',
    risk_category: input.risk_category ?? existing.risk_category ?? 'Other',
    potential_failure_mode: input.potential_failure_mode ?? existing.potential_failure_mode,
    potential_impact: input.potential_impact ?? existing.potential_impact,
    potential_cause: input.potential_cause ?? existing.potential_cause,
    existing_controls: input.existing_controls ?? existing.existing_controls,
    severity: input.severity ?? existing.severity,
    occurrence: input.occurrence ?? existing.occurrence,
    detection: input.detection ?? existing.detection ?? existing.detectability,
    mitigation_plan: input.mitigation_plan ?? existing.mitigation_plan,
    residual_severity: input.residual_severity ?? existing.residual_severity,
    residual_occurrence: input.residual_occurrence ?? existing.residual_occurrence,
    residual_detection: input.residual_detection ?? existing.residual_detection,
    capa_required: input.capa_required ?? existing.capa_required,
    validation_required: input.validation_required ?? existing.validation_required,
    linked_capa_id: input.linked_capa_id ?? existing.linked_capa_id,
    linked_capa_number: input.linked_capa_number ?? existing.linked_capa_number,
  };
  const validationError = validateRiskRowInput(mergedInput);
  if (validationError) return { error: validationError };

  const scores = computeCcRiskScores(mergedInput.severity, mergedInput.occurrence, mergedInput.detection);
  const residual = computeResidualRisk(mergedInput.residual_severity, mergedInput.residual_occurrence, mergedInput.residual_detection);
  const updates: Partial<ChangeRiskAssessment> = {
    ...mergedInput,
    detectability: mergedInput.detection,
    rpn: scores.rpn,
    risk_level: scores.risk_level,
    mitigation_required: isMitigationRequired(scores.risk_level),
    mitigation_status: mergedInput.mitigation_plan?.trim() ? 'Updated' : 'Pending',
    residual_rpn: residual.residual_rpn,
    residual_risk_level: residual.residual_risk_level,
    updated_at: nowIso(),
    updated_by: actor.id,
  };

  const { id: _id, ...payload } = { ...existing, ...updates };
  await updateDoc(ref, payload);
  if (input.mitigation_plan) await audit(actor, 'MITIGATION_PLAN_UPDATED', existing.change_id, input.mitigation_plan, rowId);
  if (residual.residual_rpn) await audit(actor, 'RESIDUAL_RISK_CALCULATED', existing.change_id, `Residual RPN ${residual.residual_rpn}`, rowId);

  const records = await getCcRiskRecords(existing.change_id);
  await syncChangeRiskLevel(existing.change_id, getCcRiskRows(records), actor);
  return { row: { ...existing, ...updates } };
}

export async function linkCcRiskCapa(
  rowId: string,
  capaId: string,
  capaNumber: string,
  actor: CcRiskActor,
): Promise<{ ok: boolean; error?: string }> {
  const res = await updateCcRiskRow(rowId, { linked_capa_id: capaId, linked_capa_number: capaNumber, capa_required: true }, actor);
  if (res.error) return { ok: false, error: res.error };
  await audit(actor, 'CAPA_LINKED', res.row!.change_id, capaNumber, rowId);
  return { ok: true };
}

export async function submitCcRiskForReview(changeId: string, actor: CcRiskActor) {
  const { header, rows } = await getCcRiskAssessment(changeId);
  if (!header || header.id.startsWith('legacy-')) return { error: 'Save assessment header first' };
  if (!rows.length) return { error: 'Add at least one risk row' };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.risk, header.id), {
    status: 'Under Review', updated_at: nowIso(), updated_by: actor.id,
  });
  await audit(actor, 'RISK_SUBMITTED_FOR_REVIEW', changeId, `${rows.length} risks`, header.id);
  return { ok: true };
}

export async function submitCcRiskQaReview(
  changeId: string,
  input: CcRiskQaReviewInput,
  actor: CcRiskActor,
): Promise<{ header?: ChangeRiskAssessment; error?: string }> {
  const { header, rows } = await getCcRiskAssessment(changeId);
  if (!header || header.id.startsWith('legacy-')) return { error: 'Risk assessment not found' };

  const residualHigh = computeResidualOverallRiskLevel(rows);
  if (input.decision === 'approved' && requiresHeadQaForResidual(residualHigh) && !canApproveCriticalResidual(actor.role)) {
    await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.risk, header.id), {
      status: 'QA Review', qa_comments: input.qa_comments, updated_at: nowIso(), updated_by: actor.id,
    });
    await notify('Head QA Approval Required', `Residual risk level ${residualHigh} requires Head QA approval.`, changeId, { targetRole: 'head_qa' });
    return { error: 'Head QA approval required for High/Critical residual risk.' };
  }

  if (requiresCsvReview(rows)) await notify('CSV Risk Assessment Review', 'CSV/Data Integrity risks identified.', changeId, { targetRole: 'it_csv' });
  if (requiresRegulatoryReview(rows)) await notify('Regulatory Risk Review', 'Regulatory compliance risks identified.', changeId, { targetRole: 'regulatory' });
  if (requiresPatientSafetyNotification(rows)) await notify('Patient Safety Risk', 'Patient safety risks require Head QA awareness.', changeId, { targetRole: 'head_qa' });

  const status = input.decision === 'approved' ? 'Approved' : 'Rejected';
  const updates: Partial<ChangeRiskAssessment> = {
    status,
    qa_comments: input.qa_comments,
    updated_at: nowIso(),
    updated_by: actor.id,
  };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.risk, header.id), updates);
  await audit(actor, input.decision === 'approved' ? 'ASSESSMENT_APPROVED' : 'ASSESSMENT_REJECTED', changeId, input.qa_comments, header.id);
  await audit(actor, 'QA_REVIEW_COMPLETED', changeId, input.qa_comments, header.id);
  await notify('Risk Assessment QA Review', `Assessment ${input.decision} for change.`, changeId, { userId: header.assessed_by });

  if (input.decision === 'approved') {
    await syncChangeRiskLevel(changeId, rows, actor);
  }

  return { header: { ...header, ...updates } };
}

export async function softDeleteCcRiskRow(rowId: string, actor: CcRiskActor) {
  const ref = doc(getFirebaseFirestore(), CC_COLLECTIONS.risk, rowId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { error: 'Not found' };
  await updateDoc(ref, { is_deleted: true, updated_at: nowIso(), updated_by: actor.id });
  const existing = normalizeRisk(snap.id, snap.data() as Record<string, unknown>);
  const records = await getCcRiskRecords(existing.change_id);
  await syncChangeRiskLevel(existing.change_id, getCcRiskRows(records), actor);
  return { ok: true };
}

/** Legacy bridge for change-control-service */
export async function getLegacyRiskAssessment(changeId: string): Promise<ChangeRiskAssessment | null> {
  const { rows, header } = await getCcRiskAssessment(changeId);
  if (!rows.length) return null;
  const top = [...rows].sort((a, b) => b.rpn - a.rpn)[0];
  return { ...top, mitigation_plan: top.mitigation_plan || '', assessed_by_name: top.assessed_by_name || header?.assessed_by_name || '' };
}

export { computeCcRiskDashboardMetrics, computeCcRiskChartData };

export type { CcRiskDashboardMetrics, CcRiskChartData };
