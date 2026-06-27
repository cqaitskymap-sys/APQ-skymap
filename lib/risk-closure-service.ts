import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import { RISK_ASSESSMENT_COLLECTION } from '@/lib/cpv-risk-assessment-records';
import {
  fetchRiskAssessmentById,
  fetchRiskAssessmentRecords,
} from '@/lib/cpv-risk-assessment-service';
import { updateRecord } from '@/lib/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  RISK_CLOSURE_COLLECTION,
  RISK_CLOSURE_MODULE,
  buildDefaultClosureForm,
  computeRiskClosureDashboardMetrics,
  computeRiskClosureReadiness,
  determineFinalRiskEvaluation,
  estimateResidualRpn,
  inferRiskDepartment,
  requiresHeadQaRiskClosure,
  residualRiskLevel,
  type RiskClosure,
  type RiskClosureActor,
  type RiskClosureDashboardMetrics,
  type RiskClosureFormInput,
} from '@/lib/risk-closure-records';

export type { RiskClosureActor, RiskClosureFormInput };

const NOTIFICATIONS = 'notifications';
const AUDIT_TRAIL = 'audit_trail';

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

function buildClosureId(riskNumber: string) {
  return `RCL-${riskNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

function riskTitle(risk: RiskAssessmentRecord): string {
  return risk.parameterName?.trim() || risk.riskDescription?.slice(0, 120) || risk.riskNumber;
}

async function audit(actor: RiskClosureActor, actionType: string, recordId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: RISK_CLOSURE_MODULE,
      collectionName: RISK_CLOSURE_COLLECTION,
      recordId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('risk closure audit', e);
  }
}

async function notify(title: string, message: string, recordId: string, userId?: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
      title,
      message,
      module: RISK_CLOSURE_MODULE,
      record_id: recordId,
      user_id: userId || '',
      read: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('risk closure notify', e);
  }
}

async function notifyRole(title: string, message: string, recordId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
        title,
        message,
        module: RISK_CLOSURE_MODULE,
        record_id: recordId,
        target_role: role,
        read: false,
        created_at: nowIso(),
      });
    } catch (e) {
      console.error('risk closure notify role', e);
    }
  }
}

async function saveEsignMetadata(
  risk: RiskAssessmentRecord,
  esignId: string,
  actor: RiskClosureActor,
  actionType: string,
) {
  if (!isFirebaseConfigured() || !esignId) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
      esign_record_id: esignId,
      module_name: RISK_CLOSURE_MODULE,
      record_id: risk.id,
      document_number: risk.riskNumber,
      action_type: actionType,
      user_id: actor.id,
      user_name: actor.name,
      user_email: actor.email || '',
      signed_date_time: nowIso(),
      authentication_status: 'Success',
      is_deleted: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('risk closure esign', e);
  }
}

function buildClosurePayload(
  risk: RiskAssessmentRecord,
  form: RiskClosureFormInput,
  actor: RiskClosureActor,
  readinessPercent: number,
  status: string,
  existing?: RiskClosure | null,
): Omit<RiskClosure, 'id'> {
  const ts = nowIso();
  const residualRpn = estimateResidualRpn(risk);
  const residualLevel = residualRiskLevel(residualRpn);
  return {
    closure_id: existing?.closure_id || buildClosureId(risk.riskNumber),
    risk_assessment_id: risk.id,
    risk_number: risk.riskNumber,
    risk_title: riskTitle(risk),
    risk_category: risk.riskCategory,
    department: inferRiskDepartment(risk),
    risk_owner: risk.riskOwner,
    closure_date: status === 'Closed' ? today() : null,
    closed_by: status === 'Closed' ? actor.id : existing?.closed_by || '',
    closed_by_name: status === 'Closed' ? actor.name : existing?.closed_by_name || '',
    initial_rpn: risk.rpnScore,
    residual_rpn: residualRpn,
    initial_risk_level: risk.riskLevel,
    residual_risk_level: residualLevel,
    mitigation_completed: form.mitigation_actions_completed,
    mitigation_effectiveness_verified: form.effectiveness_verified,
    review_completed: form.risk_review_completed,
    approval_completed: form.final_approval_completed,
    capa_required: form.capa_required,
    capa_linked: Boolean(risk.linkedCapaNumber),
    capa_completed: form.capa_completed,
    change_control_required: form.change_control_required,
    change_control_completed: form.change_control_completed,
    training_required: form.training_required,
    training_completed: form.training_completed,
    validation_required: form.validation_required,
    validation_completed: form.validation_completed,
    final_risk_evaluation: form.final_risk_evaluation || determineFinalRiskEvaluation(residualRpn),
    closure_justification: form.closure_justification,
    qa_closure_comments: form.qa_closure_comments,
    head_qa_comments: form.head_qa_comments || '',
    closure_status: status,
    e_signature_required: true,
    e_signature_status: existing?.e_signature_status || 'Not Signed',
    signed_by: existing?.signed_by || '',
    signed_date: existing?.signed_date || null,
    readiness_percent: readinessPercent,
    reopen_reason: existing?.reopen_reason,
    created_at: existing?.created_at || ts,
    updated_at: ts,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    is_deleted: false,
  };
}

export async function getRiskClosure(riskAssessmentId: string): Promise<RiskClosure | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
      where('is_deleted', '==', false),
      orderBy('updated_at', 'desc'),
      limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as RiskClosure;
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
      limit(1),
    ));
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    if (d.is_deleted) return null;
    return { id: snap.docs[0].id, ...d } as RiskClosure;
  }
}

export async function listRiskClosures(max = 200): Promise<(RiskClosure & { risk?: RiskAssessmentRecord | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION),
      where('is_deleted', '==', false),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    const closures = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskClosure));
    return Promise.all(closures.map(async (c) => ({
      ...c,
      risk: await fetchRiskAssessmentById(c.risk_assessment_id),
    })));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION));
    const closures = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskClosure)).filter((c) => !c.is_deleted);
    return Promise.all(closures.map(async (c) => ({
      ...c,
      risk: await fetchRiskAssessmentById(c.risk_assessment_id),
    })));
  }
}

async function getAuditLogsForRiskClosure(riskId: string) {
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

export async function fetchRiskClosurePageData(riskAssessmentId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const risk = await fetchRiskAssessmentById(riskAssessmentId);
    if (!risk) return { error: 'Risk assessment not found.' };

    const closure = await getRiskClosure(riskAssessmentId);
    const auditLogs = await getAuditLogsForRiskClosure(riskAssessmentId);
    const formDefaults = buildDefaultClosureForm(risk, closure);
    const readiness = computeRiskClosureReadiness(risk, formDefaults);

    return {
      risk,
      closure,
      readiness,
      formDefaults,
      auditLogs,
      headQaRequired: requiresHeadQaRiskClosure(risk),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load closure data' };
  }
}

export async function fetchRiskClosureDashboard(): Promise<{
  error?: string;
  closures: (RiskClosure & { risk?: RiskAssessmentRecord | null })[];
  risks: RiskAssessmentRecord[];
  metrics: RiskClosureDashboardMetrics;
}> {
  if (!isFirebaseConfigured()) {
    return {
      error: 'Firebase is not configured.',
      closures: [],
      risks: [],
      metrics: {
        readyForClosure: 0, pendingClosure: 0, closed: 0, rejected: 0,
        reopened: 0, highRiskClosures: 0, capaPendingClosures: 0, validationPendingClosures: 0,
      },
    };
  }
  try {
    const [closures, risks] = await Promise.all([
      listRiskClosures(),
      fetchRiskAssessmentRecords(),
    ]);
    const metrics = computeRiskClosureDashboardMetrics(closures, risks);
    return { closures, risks, metrics };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to load dashboard',
      closures: [],
      risks: [],
      metrics: {
        readyForClosure: 0, pendingClosure: 0, closed: 0, rejected: 0,
        reopened: 0, highRiskClosures: 0, capaPendingClosures: 0, validationPendingClosures: 0,
      },
    };
  }
}

export async function saveRiskClosureDraft(
  riskAssessmentId: string,
  form: RiskClosureFormInput,
  actor: RiskClosureActor,
): Promise<RiskClosure> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  if (risk.riskStatus === 'Closed') throw new Error('Risk is already closed');

  const readiness = computeRiskClosureReadiness(risk, form);
  const existing = await getRiskClosure(riskAssessmentId);
  const status = existing?.closure_status === 'Closed'
    ? 'Closed'
    : readiness.ready
      ? 'Ready For Closure'
      : 'Pending';
  const payload = buildClosurePayload(risk, form, actor, readiness.percent, status, existing);

  if (existing?.id) {
    await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, existing.id), payload);
    await audit(actor, 'closure checklist completed', riskAssessmentId);
    return { id: existing.id, ...payload };
  }

  const ref = await addDoc(collection(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION), payload);
  await audit(actor, 'closure initiated', riskAssessmentId, payload.closure_id);
  await notify('Risk Closure Initiated', `Closure started for ${risk.riskNumber}`, riskAssessmentId, risk.createdBy);
  return { id: ref.id, ...payload };
}

export async function submitRiskClosureForQaReview(
  riskAssessmentId: string,
  form: RiskClosureFormInput,
  actor: RiskClosureActor,
): Promise<RiskClosure> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');

  const readiness = computeRiskClosureReadiness(risk, form);
  if (!readiness.ready) throw new Error(`Closure blocked: ${readiness.blockers.join('; ')}`);
  if (!form.closure_justification.trim()) throw new Error('Closure justification is required');
  if (!form.final_risk_evaluation) throw new Error('Final risk evaluation is required');
  if (!form.qa_closure_comments.trim()) throw new Error('QA closure comments are required');
  if (form.final_risk_evaluation === 'Not Acceptable') {
    throw new Error('Risk cannot close when final evaluation is Not Acceptable');
  }

  const headQaRequired = requiresHeadQaRiskClosure(risk);
  const status = headQaRequired ? 'Head QA Review' : 'QA Review';
  const existing = await getRiskClosure(riskAssessmentId);
  const payload = buildClosurePayload(risk, form, actor, readiness.percent, status, existing);

  let saved: RiskClosure;
  if (existing?.id) {
    await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, existing.id), payload);
    saved = { id: existing.id, ...payload };
  } else {
    const ref = await addDoc(collection(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION), payload);
    saved = { id: ref.id, ...payload };
  }

  await audit(actor, 'risk acceptance determined', riskAssessmentId, form.final_risk_evaluation);
  await audit(actor, 'QA review completed', riskAssessmentId, form.qa_closure_comments);
  await notify('Risk Closure QA Review', `${risk.riskNumber} submitted for closure review`, riskAssessmentId, risk.createdBy);
  await notifyRole('Risk Closure Head QA', `${risk.riskNumber} requires Head QA approval`, riskAssessmentId, ['head_qa', 'qa_manager']);
  if (form.capa_required && !form.capa_completed) {
    await notify('CAPA Pending for Risk Closure', risk.linkedCapaNumber || risk.riskNumber, riskAssessmentId);
  }
  if (form.change_control_required && !form.change_control_completed) {
    await notify('Change Control Pending for Risk Closure', risk.linkedChangeControlNumber || risk.riskNumber, riskAssessmentId);
  }
  return saved;
}

export async function approveHeadQaRiskClosure(
  riskAssessmentId: string,
  form: RiskClosureFormInput,
  actor: RiskClosureActor,
): Promise<RiskClosure> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const existing = await getRiskClosure(riskAssessmentId);
  if (!existing) throw new Error('Closure record not found');
  if (!['head_qa', 'super_admin', 'admin'].includes(actor.role || '')) {
    throw new Error('Head QA approval required');
  }

  const readiness = computeRiskClosureReadiness(risk, form);
  if (!readiness.ready) throw new Error(`Closure blocked: ${readiness.blockers.join('; ')}`);

  const payload = {
    ...buildClosurePayload(risk, form, actor, readiness.percent, 'QA Review', existing),
    head_qa_comments: form.head_qa_comments || existing.head_qa_comments || '',
    updated_at: nowIso(),
  };

  await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, existing.id), payload);
  await audit(actor, 'Head QA review completed', riskAssessmentId, form.head_qa_comments);
  await notify('Head QA Approved Risk Closure', risk.riskNumber, riskAssessmentId, risk.createdBy);
  return { id: existing.id, ...payload };
}

export async function closeRiskWithClosure(
  riskAssessmentId: string,
  form: RiskClosureFormInput,
  eSignature: string,
  actor: RiskClosureActor,
): Promise<RiskClosure> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const existing = await getRiskClosure(riskAssessmentId);
  if (!existing) throw new Error('Closure record not found — submit for QA review first');

  const headQaRequired = requiresHeadQaRiskClosure(risk);
  if (headQaRequired && !['head_qa', 'super_admin', 'admin'].includes(actor.role || '')) {
    throw new Error('Head QA approval required for high/critical risk closure');
  }
  if (!eSignature.trim()) throw new Error('E-signature required for closure');

  const readiness = computeRiskClosureReadiness(risk, form);
  if (!readiness.ready) throw new Error(`Closure blocked: ${readiness.blockers.join('; ')}`);
  if (!form.closure_justification.trim()) throw new Error('Closure justification is required');
  if (!form.qa_closure_comments.trim()) throw new Error('QA closure comments are required');
  if (form.final_risk_evaluation === 'Not Acceptable') {
    throw new Error('Cannot close with Not Acceptable evaluation');
  }

  const ts = nowIso();
  const payload = {
    ...buildClosurePayload(risk, form, actor, readiness.percent, 'Closed', existing),
    closure_date: today(),
    closed_by: actor.id,
    closed_by_name: actor.name,
    e_signature_status: 'Signed',
    signed_by: actor.name,
    signed_date: ts,
    updated_at: ts,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, existing.id), payload);
  await saveEsignMetadata(risk, eSignature, actor, 'Risk Closed');

  await updateRecord(RISK_ASSESSMENT_COLLECTION, riskAssessmentId, {
    riskStatus: 'Closed',
    workflowStatus: 'Closure',
    isLocked: true,
    updatedByName: actor.name,
  }, { moduleName: RISK_CLOSURE_MODULE, actor: { id: actor.id, name: actor.name } });

  await audit(actor, 'risk closed', riskAssessmentId, form.closure_justification);
  await audit(actor, 'e-signature success', riskAssessmentId, eSignature);
  await notify('Risk Closed', `${risk.riskNumber} has been closed`, riskAssessmentId, risk.createdBy);
  await notifyRole('Risk Closed', risk.riskNumber, riskAssessmentId, ['risk_manager', 'qa_manager', 'head_qa']);
  return { id: existing.id, ...payload };
}

export async function rejectRiskClosure(
  riskAssessmentId: string,
  reason: string,
  actor: RiskClosureActor,
): Promise<RiskClosure> {
  const existing = await getRiskClosure(riskAssessmentId);
  if (!existing) throw new Error('Closure record not found');
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');

  const payload = {
    closure_status: 'Rejected',
    qa_closure_comments: reason || existing.qa_closure_comments,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, existing.id), payload);
  await audit(actor, 'closure rejected', riskAssessmentId, reason);
  await notify('Risk Closure Rejected', `${risk.riskNumber}: ${reason}`, riskAssessmentId, risk.createdBy);
  return { ...existing, ...payload };
}

export async function reopenRiskClosure(
  riskAssessmentId: string,
  reason: string,
  eSignature: string,
  actor: RiskClosureActor,
): Promise<RiskClosure> {
  const existing = await getRiskClosure(riskAssessmentId);
  if (!existing) throw new Error('Closure record not found');
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  if (!reason.trim()) throw new Error('Reopen reason is required');
  if (!eSignature.trim()) throw new Error('E-signature required for reopen');

  const payload = {
    closure_status: 'Reopened',
    reopen_reason: reason,
    closure_date: null,
    e_signature_status: 'Signed',
    signed_by: actor.name,
    signed_date: nowIso(),
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, existing.id), payload);
  await saveEsignMetadata(risk, eSignature, actor, 'Risk Reopened');

  await updateRecord(RISK_ASSESSMENT_COLLECTION, riskAssessmentId, {
    riskStatus: 'Mitigation In Progress',
    workflowStatus: 'Mitigation',
    isLocked: false,
    updatedByName: actor.name,
  }, { moduleName: RISK_CLOSURE_MODULE, actor: { id: actor.id, name: actor.name } });

  await audit(actor, 'risk reopened', riskAssessmentId, reason);
  await audit(actor, 'e-signature success', riskAssessmentId, eSignature);
  await notify('Risk Reopened', `${risk.riskNumber} reopened: ${reason}`, riskAssessmentId, risk.createdBy);
  return { ...existing, ...payload };
}

export async function logRiskClosureEsignResult(
  riskAssessmentId: string,
  success: boolean,
  actor: RiskClosureActor,
  detail?: string,
) {
  await audit(
    actor,
    success ? 'e-signature success' : 'e-signature failure',
    riskAssessmentId,
    detail,
  );
}

export async function softDeleteRiskClosure(id: string, actor: RiskClosureActor) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getFirebaseFirestore(), RISK_CLOSURE_COLLECTION, id), {
    is_deleted: true,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
}
