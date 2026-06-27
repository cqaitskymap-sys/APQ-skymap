import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import {
  RISK_ASSESSMENT_COLLECTION,
  RISK_ASSESSMENT_LEGACY,
  RISK_ASSESSMENT_MODULE,
  RISK_CONTROLS_COLLECTION,
  RISK_REVIEWS_COLLECTION,
  buildRiskAssessmentId,
  calculateRiskAssessment,
  generateRiskNumber,
  inferRiskFromSignal,
  type RiskAssessmentFormData,
  type RiskAssessmentRecord,
  type RiskControlRecord,
  type RiskReviewRecord,
} from '@/lib/cpv-risk-assessment-records';

export interface RiskAssessmentActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: RiskAssessmentActor) {
  return { moduleName: RISK_ASSESSMENT_MODULE, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logRiskAudit(
  actionType: string,
  recordId: string,
  actor: RiskAssessmentActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: RISK_ASSESSMENT_MODULE,
    collectionName: RISK_ASSESSMENT_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: RISK_ASSESSMENT_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: RISK_ASSESSMENT_MODULE,
  });
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function num(v: unknown, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function bool(v: unknown, fb = false): boolean {
  return typeof v === 'boolean' ? v : fb;
}

export function normalizeRiskAssessmentRecord(raw: Record<string, unknown>): RiskAssessmentRecord {
  const productCode = str(raw.productCode || raw.product_code);
  const severity = num(raw.severityScore ?? raw.severity ?? raw.severity_score, 1);
  const occurrence = num(raw.occurrenceScore ?? raw.occurrence ?? raw.likelihood, 1);
  const detection = num(raw.detectionScore ?? raw.detectability ?? raw.detection ?? raw.detection_score, 1);
  const calc = calculateRiskAssessment(severity, occurrence, detection);

  return {
    id: str(raw.id),
    riskAssessmentId: str(raw.riskAssessmentId || raw.risk_assessment_id, buildRiskAssessmentId(productCode)),
    riskNumber: str(raw.riskNumber || raw.risk_number || raw.riskId || raw.risk_id, generateRiskNumber(0)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name || raw.product),
    productCode,
    batchNumber: str(raw.batchNumber || raw.batch_number || raw.batchNo || raw.batch_no),
    riskCategory: (str(raw.riskCategory || raw.risk_category, 'Process Risk') as RiskAssessmentRecord['riskCategory']),
    riskSource: (str(raw.riskSource || raw.risk_source || raw.factor, 'Manual Assessment') as RiskAssessmentRecord['riskSource']),
    processStage: str(raw.processStage || raw.process_stage),
    parameterType: (str(raw.parameterType || raw.parameter_type, 'CPP') as RiskAssessmentRecord['parameterType']),
    parameterName: str(raw.parameterName || raw.parameter_name),
    riskDescription: str(raw.riskDescription || raw.risk_description || raw.rationale),
    potentialImpact: str(raw.potentialImpact || raw.potential_impact),
    potentialCause: str(raw.potentialCause || raw.potential_cause),
    existingControls: str(raw.existingControls || raw.existing_controls || raw.mitigation),
    severityScore: severity,
    occurrenceScore: occurrence,
    detectionScore: detection,
    rpnScore: num(raw.rpnScore ?? raw.rpn ?? raw.rpn_score, calc.rpnScore),
    riskLevel: str(raw.riskLevel || raw.risk_level, calc.riskLevel) as RiskAssessmentRecord['riskLevel'],
    department: str(raw.department),
    riskTitle: str(raw.riskTitle || raw.risk_title),
    residualSeverity: num(raw.residualSeverity ?? raw.residual_severity, 0),
    residualOccurrence: num(raw.residualOccurrence ?? raw.residual_occurrence, 0),
    residualDetection: num(raw.residualDetection ?? raw.residual_detection, 0),
    residualRpn: num(raw.residualRpn ?? raw.residual_rpn, 0),
    residualRiskLevel: str(raw.residualRiskLevel || raw.residual_risk_level, ''),
    sourceReferenceNumber: str(raw.sourceReferenceNumber || raw.source_reference_number),
    reviewFrequency: str(raw.reviewFrequency || raw.review_frequency),
    riskDate: str(raw.riskDate || raw.risk_date),
    riskStatus: (str(raw.riskStatus || raw.risk_status || raw.status, 'Open') as RiskAssessmentRecord['riskStatus']),
    workflowStatus: (str(raw.workflowStatus || raw.workflow_status, 'Draft') as RiskAssessmentRecord['workflowStatus']),
    effectivenessStatus: (str(raw.effectivenessStatus || raw.effectiveness_status, 'Pending') as RiskAssessmentRecord['effectivenessStatus']),
    riskOwner: str(raw.riskOwner || raw.risk_owner || raw.owner, 'Unassigned'),
    mitigationAction: str(raw.mitigationAction || raw.mitigation_action || raw.mitigation),
    targetCompletionDate: str(raw.targetCompletionDate || raw.target_completion_date || raw.dueDate || raw.due_date),
    effectivenessCheckRequired: bool(raw.effectivenessCheckRequired ?? raw.effectiveness_check_required, true),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    linkedOosNumber: str(raw.linkedOosNumber || raw.linked_oos_number),
    linkedChangeControlNumber: str(raw.linkedChangeControlNumber || raw.linked_change_control_number),
    capaSuggested: bool(raw.capaSuggested || raw.capa_suggested),
    isAutoGenerated: bool(raw.isAutoGenerated || raw.is_auto_generated || raw.autoGenerated),
    isLocked: bool(raw.isLocked || raw.is_locked),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    approvedBy: str(raw.approvedBy || raw.approved_by),
    approvalDate: str(raw.approvalDate || raw.approval_date),
    remarks: str(raw.remarks),
    controls: Array.isArray(raw.controls) ? raw.controls as RiskControlRecord[] : [],
    reviews: Array.isArray(raw.reviews) ? raw.reviews as RiskReviewRecord[] : [],
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: bool(raw.isDeleted),
  };
}

export async function fetchRiskAssessmentRecords(max = 500): Promise<RiskAssessmentRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: RiskAssessmentRecord[] = [];
    try {
      primary = await getRecords<RiskAssessmentRecord>(
        RISK_ASSESSMENT_COLLECTION,
        [orderBy('createdAt', 'desc'), limit(max)],
      );
    } catch {
      primary = await getRecords<RiskAssessmentRecord>(RISK_ASSESSMENT_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeRiskAssessmentRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const legacy of RISK_ASSESSMENT_LEGACY) {
      const rows = await listCpvRecords<Record<string, unknown>>(legacy, max);
      if (rows.length) return rows.map((r) => normalizeRiskAssessmentRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.risk, max);
    return cpvLegacy.map((r) => normalizeRiskAssessmentRecord(r));
  } catch (e) {
    console.error('fetchRiskAssessmentRecords failed', e);
    return [];
  }
}

export async function fetchRiskAssessmentById(id: string): Promise<RiskAssessmentRecord | null> {
  const record = await getRecord<RiskAssessmentRecord>(RISK_ASSESSMENT_COLLECTION, id);
  if (record) return normalizeRiskAssessmentRecord(record as unknown as Record<string, unknown>);
  const all = await fetchRiskAssessmentRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchRiskAssessmentAuditTrail(recordId: string) {
  const { getAuditLogsForRisk } = await import('@/lib/risk-audit-trail-service');
  return getAuditLogsForRisk(recordId);
}

export async function createRiskAssessment(
  form: RiskAssessmentFormData,
  actor: RiskAssessmentActor,
  existingCount = 0,
  options?: { isAutoGenerated?: boolean },
): Promise<{ result: RiskAssessmentRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const calc = calculateRiskAssessment(form.severityScore, form.occurrenceScore, form.detectionScore);
    const riskNumber = generateRiskNumber(existingCount);
    const payload = {
      ...form,
      riskAssessmentId: buildRiskAssessmentId(form.productCode),
      riskNumber,
      ...calc,
      riskStatus: 'Open' as const,
      workflowStatus: 'Draft' as const,
      effectivenessStatus: 'Pending' as const,
      capaSuggested: calc.riskLevel === 'Critical' || calc.riskLevel === 'High',
      isAutoGenerated: Boolean(options?.isAutoGenerated),
      isLocked: false,
      reviewedBy: '',
      reviewDate: '',
      approvedBy: '',
      approvalDate: '',
      controls: [],
      reviews: [],
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      RISK_ASSESSMENT_COLLECTION,
      payload as Omit<RiskAssessmentRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    const result = normalizeRiskAssessmentRecord(created as unknown as Record<string, unknown>);
    await logRiskAudit('create risk', result.id, actor, null, result, result.riskNumber);
    await logRiskAudit('risk calculation', result.id, actor, null, calc, result.riskNumber);
    if (options?.isAutoGenerated) {
      await logRiskAudit('auto risk generation', result.id, actor, null, form.riskSource, result.riskNumber);
    }
    return { result, error: null };
  } catch (e) {
    console.error('createRiskAssessment failed', e);
    return { result: null, error: 'Failed to save risk assessment.' };
  }
}

export async function updateRiskAssessment(
  id: string,
  updates: Partial<RiskAssessmentFormData & Pick<RiskAssessmentRecord, 'riskStatus' | 'workflowStatus' | 'effectivenessStatus' | 'mitigationAction' | 'linkedCapaNumber' | 'linkedDeviationNumber' | 'linkedOosNumber' | 'linkedChangeControlNumber' | 'controls' | 'reviews'>>,
  actor: RiskAssessmentActor,
  existing: RiskAssessmentRecord,
  qaOverride = false,
): Promise<{ result: RiskAssessmentRecord | null; error: string | null }> {
  if (existing.isLocked && !qaOverride) {
    return { result: null, error: 'Record is locked. QA override required.' };
  }
  try {
    const severity = updates.severityScore ?? existing.severityScore;
    const occurrence = updates.occurrenceScore ?? existing.occurrenceScore;
    const detection = updates.detectionScore ?? existing.detectionScore;
    const calc = calculateRiskAssessment(severity, occurrence, detection);
    const payload = {
      ...updates,
      ...calc,
      updatedByName: actor.name,
      isLocked: qaOverride ? false : existing.isLocked,
    };
    const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, payload as Partial<RiskAssessmentRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
    await logRiskAudit(qaOverride ? 'QA override' : 'edit risk', id, actor, existing, result, result.riskNumber);
    if (updates.severityScore || updates.occurrenceScore || updates.detectionScore) {
      await logRiskAudit('risk calculation', id, actor, null, calc, result.riskNumber);
    }
    return { result, error: null };
  } catch (e) {
    console.error('updateRiskAssessment failed', e);
    return { result: null, error: 'Update failed.' };
  }
}

export async function reviewRiskAssessment(id: string, actor: RiskAssessmentActor, existing: RiskAssessmentRecord, comments = '') {
  const review: RiskReviewRecord = {
    reviewDate: new Date().toISOString().split('T')[0],
    reviewer: actor.name,
    comments,
    decision: 'Under Review',
    status: 'Under Review',
  };
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    riskStatus: 'Under Review',
    workflowStatus: 'Review',
    reviewedBy: actor.name,
    reviewDate: review.reviewDate,
    reviews: [...(existing.reviews || []), review],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  await logRiskAudit('risk review', id, actor, existing.riskStatus, 'Under Review', result.riskNumber);
  try {
    await addDoc(collection(getFirebaseFirestore(), RISK_REVIEWS_COLLECTION), {
      ...review,
      riskAssessmentId: id,
      riskNumber: result.riskNumber,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      isDeleted: false,
    });
  } catch { /* optional */ }
  return { result, error: null };
}

export async function approveRiskAssessment(id: string, actor: RiskAssessmentActor, existing: RiskAssessmentRecord) {
  const today = new Date().toISOString().split('T')[0];
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    workflowStatus: 'Approval',
    riskStatus: 'Mitigation In Progress',
    approvedBy: actor.name,
    approvalDate: today,
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  await logRiskAudit('risk approval', id, actor, existing.workflowStatus, 'Approval', result.riskNumber);
  return { result, error: null };
}

export async function closeRiskAssessment(id: string, actor: RiskAssessmentActor, existing: RiskAssessmentRecord) {
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    riskStatus: 'Closed',
    workflowStatus: 'Closure',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  await logRiskAudit('risk closure', id, actor, existing.riskStatus, 'Closed', result.riskNumber);
  return { result, error: null };
}

export async function rejectRiskAssessment(id: string, actor: RiskAssessmentActor, existing: RiskAssessmentRecord) {
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    riskStatus: 'Rejected',
    workflowStatus: 'Closure',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  await logRiskAudit('reject risk', id, actor, existing.riskStatus, 'Rejected', result.riskNumber);
  return { result, error: null };
}

export async function addRiskControl(
  id: string,
  control: Omit<RiskControlRecord, 'controlId'>,
  actor: RiskAssessmentActor,
  existing: RiskAssessmentRecord,
) {
  const controlId = `CTRL-${Date.now()}`.slice(0, 20);
  const entry: RiskControlRecord = { ...control, controlId };
  const controls = [...(existing.controls || []), entry];
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    controls,
    workflowStatus: 'Mitigation',
    riskStatus: 'Mitigation In Progress',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  await logRiskAudit('risk mitigation', id, actor, null, entry, result.riskNumber);
  try {
    await addDoc(collection(getFirebaseFirestore(), RISK_CONTROLS_COLLECTION), {
      ...entry,
      riskAssessmentId: id,
      riskNumber: result.riskNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedBy: actor.id,
      isDeleted: false,
    });
  } catch { /* optional */ }
  return { result, error: null };
}

export async function recordEffectivenessReview(
  id: string,
  status: RiskAssessmentRecord['effectivenessStatus'],
  actor: RiskAssessmentActor,
  existing: RiskAssessmentRecord,
) {
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    effectivenessStatus: status,
    workflowStatus: 'Effectiveness Check',
    riskStatus: status === 'Effective' ? 'Closed' : 'Effectiveness Check Pending',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  await logRiskAudit('effectiveness review', id, actor, existing.effectivenessStatus, status, result.riskNumber);
  return { result, error: null };
}

export async function linkRiskRecord(
  id: string,
  field: 'linkedCapaNumber' | 'linkedDeviationNumber' | 'linkedOosNumber' | 'linkedChangeControlNumber',
  value: string,
  actor: RiskAssessmentActor,
  existing: RiskAssessmentRecord,
) {
  const updated = await updateRecord(RISK_ASSESSMENT_COLLECTION, id, {
    [field]: value,
    updatedByName: actor.name,
  } as Partial<RiskAssessmentRecord>, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRiskAssessmentRecord(updated as unknown as Record<string, unknown>);
  const action = field.includes('Capa') ? 'link CAPA'
    : field.includes('Deviation') ? 'link Deviation'
      : field.includes('Oos') ? 'link OOS'
        : 'link change control';
  await logRiskAudit(action, id, actor, null, value, result.riskNumber);
  return { result, error: null };
}

export async function logRiskExport(actor: RiskAssessmentActor, type: string, count: number) {
  await logRiskAudit(`export risk ${type}`, 'export', actor, null, { type, count });
}

export async function createAutoRiskFromSignal(
  input: Parameters<typeof inferRiskFromSignal>[0] & Pick<RiskAssessmentFormData, 'productName' | 'productCode' | 'batchNumber' | 'parameterName' | 'riskOwner' | 'targetCompletionDate'>,
  actor: RiskAssessmentActor,
  existingCount: number,
) {
  const inferred = inferRiskFromSignal(input);
  return createRiskAssessment({
    cpvProductId: '',
    productName: input.productName,
    productCode: input.productCode || 'PRD',
    batchNumber: input.batchNumber || '',
    processStage: '',
    parameterName: input.parameterName || '',
    parameterType: 'CPP',
    riskOwner: input.riskOwner,
    targetCompletionDate: input.targetCompletionDate,
    mitigationAction: '',
    existingControls: '',
    potentialCause: '',
    linkedCapaNumber: '',
    linkedDeviationNumber: '',
    linkedOosNumber: '',
    linkedChangeControlNumber: '',
    remarks: 'Auto-generated from CPV monitoring signal',
    effectivenessCheckRequired: true,
    ...inferred,
  }, actor, existingCount, { isAutoGenerated: true });
}

export { inferRiskFromSignal, calculateRiskAssessment, generateRiskNumber };
