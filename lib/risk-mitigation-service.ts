import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { RISK_ASSESSMENT_COLLECTION, type RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import {
  fetchRiskAssessmentById,
  fetchRiskAssessmentRecords,
} from '@/lib/cpv-risk-assessment-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { updateRecord } from '@/lib/firestore';
import {
  RISK_MITIGATION_COLLECTION,
  RISK_MITIGATION_MODULE,
  buildDefaultMitigationForm,
  calculateResidualRisk,
  canApproveRiskMitigation,
  canEditRiskMitigation,
  computeMitigationCharts,
  computeMitigationDashboardMetrics,
  isMitigationOverdue,
  requiresCsvReview,
  requiresHeadQaApproval,
  requiresMitigationPlan,
  requiresRegulatoryReview,
  requiresValidationReview,
  type RiskMitigationActor,
  type RiskMitigationFormInput,
  type RiskMitigationRecord,
} from '@/lib/risk-mitigation-records';
import { inferRiskDepartment } from '@/lib/risk-reports-records';

const NOTIFICATIONS = 'notifications';
const AUDIT_TRAIL = 'audit_trail';

const nowIso = () => new Date().toISOString();

function buildMitigationId(riskNumber: string) {
  return `RMP-${riskNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

async function audit(actor: RiskMitigationActor, actionType: string, recordId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: RISK_MITIGATION_MODULE,
      collectionName: RISK_MITIGATION_COLLECTION,
      recordId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('risk mitigation audit', e);
  }
}

async function notify(title: string, message: string, recordId: string, userId?: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
      title,
      message,
      module: RISK_MITIGATION_MODULE,
      record_id: recordId,
      user_id: userId || '',
      read: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('risk mitigation notify', e);
  }
}

async function notifyRole(title: string, message: string, recordId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
        title,
        message,
        module: RISK_MITIGATION_MODULE,
        record_id: recordId,
        target_role: role,
        read: false,
        created_at: nowIso(),
      });
    } catch (e) {
      console.error('risk mitigation notify role', e);
    }
  }
}

function buildMitigationPayload(
  risk: RiskAssessmentRecord,
  form: RiskMitigationFormInput,
  actor: RiskMitigationActor,
  status: string,
  existing?: RiskMitigationRecord | null,
): Omit<RiskMitigationRecord, 'id'> {
  const ts = nowIso();
  const residual = calculateResidualRisk(form.residual_severity, form.residual_occurrence, form.residual_detection);
  return {
    mitigation_id: existing?.mitigation_id || buildMitigationId(risk.riskNumber),
    risk_assessment_id: risk.id,
    risk_number: risk.riskNumber,
    risk_title: risk.parameterName || risk.riskDescription.slice(0, 120),
    risk_category: risk.riskCategory,
    initial_rpn: risk.rpnScore,
    initial_risk_level: risk.riskLevel,
    mitigation_title: form.mitigation_title,
    mitigation_description: form.mitigation_description,
    mitigation_type: form.mitigation_type,
    action_owner: form.action_owner,
    department: form.department || inferRiskDepartment(risk),
    priority: form.priority,
    target_completion_date: form.target_completion_date,
    actual_completion_date: ['Implemented', 'Approved', 'Closed'].includes(status)
      ? (existing?.actual_completion_date || new Date().toISOString().slice(0, 10))
      : existing?.actual_completion_date || '',
    mitigation_status: status,
    effectiveness_required: form.effectiveness_required,
    effectiveness_review_date: form.effectiveness_review_date || form.target_completion_date,
    residual_severity: form.residual_severity,
    residual_occurrence: form.residual_occurrence,
    residual_detection: form.residual_detection,
    residual_rpn: residual.residualRpn,
    residual_risk_level: residual.residualRiskLevel,
    capa_required: form.capa_required,
    capa_number: form.capa_number || '',
    change_control_required: form.change_control_required,
    change_control_number: form.change_control_number || '',
    training_required: form.training_required,
    training_reference: form.training_reference || '',
    validation_required: form.validation_required,
    validation_reference: form.validation_reference || '',
    remarks: form.remarks || '',
    created_at: existing?.created_at || ts,
    updated_at: ts,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    is_deleted: false,
  };
}

export async function getRiskMitigations(riskAssessmentId: string): Promise<RiskMitigationRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
      where('is_deleted', '==', false),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskMitigationRecord));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskMitigationRecord))
      .filter((m) => !m.is_deleted)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }
}

export async function listAllRiskMitigations(max = 500): Promise<RiskMitigationRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION),
      where('is_deleted', '==', false),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskMitigationRecord));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskMitigationRecord)).filter((m) => !m.is_deleted);
  }
}

export async function fetchRiskMitigationPageData(riskAssessmentId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const risk = await fetchRiskAssessmentById(riskAssessmentId);
    if (!risk) return { error: 'Risk assessment not found.' };
    const mitigations = await getRiskMitigations(riskAssessmentId);
    const latest = mitigations[0] || null;
    const formDefaults = latest
      ? {
        mitigation_title: latest.mitigation_title,
        mitigation_description: latest.mitigation_description,
        mitigation_type: latest.mitigation_type,
        action_owner: latest.action_owner,
        department: latest.department,
        priority: latest.priority,
        target_completion_date: latest.target_completion_date,
        mitigation_status: latest.mitigation_status,
        effectiveness_required: latest.effectiveness_required,
        effectiveness_review_date: latest.effectiveness_review_date || '',
        residual_severity: latest.residual_severity,
        residual_occurrence: latest.residual_occurrence,
        residual_detection: latest.residual_detection,
        capa_required: latest.capa_required,
        capa_number: latest.capa_number,
        change_control_required: latest.change_control_required,
        change_control_number: latest.change_control_number,
        training_required: latest.training_required,
        training_reference: latest.training_reference,
        validation_required: latest.validation_required,
        validation_reference: latest.validation_reference,
        remarks: latest.remarks,
      } as RiskMitigationFormInput
      : buildDefaultMitigationForm(risk);

    const auditLogs = await getAuditLogs(riskAssessmentId);
    return { risk, mitigations, latest, formDefaults, auditLogs };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load mitigation page' };
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

export async function fetchRiskMitigationDashboard() {
  const [mitigations, risks] = await Promise.all([
    listAllRiskMitigations(),
    isFirebaseConfigured() ? fetchRiskAssessmentRecords() : Promise.resolve([]),
  ]);
  return {
    mitigations,
    risks,
    metrics: computeMitigationDashboardMetrics(mitigations),
    charts: computeMitigationCharts(mitigations),
  };
}

export async function saveRiskMitigationDraft(
  riskAssessmentId: string,
  form: RiskMitigationFormInput,
  actor: RiskMitigationActor,
): Promise<RiskMitigationRecord> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  if (requiresMitigationPlan(risk) && !form.mitigation_title.trim()) {
    throw new Error('Mitigation plan is required for High/Critical risks');
  }

  const existing = (await getRiskMitigations(riskAssessmentId)).find((m) => ['Draft', 'Assigned', 'In Progress'].includes(m.mitigation_status)) || null;
  const payload = buildMitigationPayload(risk, form, actor, form.mitigation_status || 'Draft', existing);

  if (existing?.id) {
    await updateDoc(doc(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION, existing.id), payload);
    await audit(actor, 'action updated', riskAssessmentId, payload.mitigation_title);
    return { id: existing.id, ...payload };
  }

  const ref = await addDoc(collection(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION), payload);
  await audit(actor, 'mitigation created', riskAssessmentId, payload.mitigation_id);
  await notify('Mitigation Created', `${risk.riskNumber} mitigation created`, riskAssessmentId, risk.createdBy);
  return { id: ref.id, ...payload };
}

function validateForApproval(form: RiskMitigationFormInput) {
  if (!form.mitigation_title.trim()) throw new Error('Mitigation title required');
  if (!form.mitigation_description.trim()) throw new Error('Mitigation description required');
  if (!form.action_owner.trim()) throw new Error('Action owner required');
  if (!form.target_completion_date.trim()) throw new Error('Target completion date required');
  if (!form.capa_required && !form.change_control_required && !form.training_required && !form.validation_required) return;
  if (form.capa_required && !form.capa_number.trim()) throw new Error('CAPA reference required');
  if (form.change_control_required && !form.change_control_number.trim()) throw new Error('Change Control reference required');
  if (form.training_required && !form.training_reference.trim()) throw new Error('Training reference required');
  if (form.validation_required && !form.validation_reference.trim()) throw new Error('Validation reference required');
}

export async function submitMitigationForReview(
  riskAssessmentId: string,
  mitigationId: string,
  form: RiskMitigationFormInput,
  actor: RiskMitigationActor,
): Promise<RiskMitigationRecord> {
  validateForApproval(form);
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const mitigations = await getRiskMitigations(riskAssessmentId);
  const existing = mitigations.find((m) => m.id === mitigationId || m.mitigation_id === mitigationId);
  if (!existing) throw new Error('Mitigation not found');

  const payload = buildMitigationPayload(risk, form, actor, 'Pending Review', existing);
  await updateDoc(doc(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION, existing.id), payload);
  await audit(actor, 'review completed', riskAssessmentId, payload.mitigation_title);
  await notifyRole('Mitigation Pending Review', `${risk.riskNumber} pending QA review`, riskAssessmentId, ['qa', 'qa_manager', 'risk_manager']);
  await notify('Mitigation Assigned', `${payload.mitigation_title} assigned to ${payload.action_owner}`, riskAssessmentId);

  if (requiresHeadQaApproval(risk)) await notifyRole('Critical Risk Mitigation', risk.riskNumber, riskAssessmentId, ['head_qa']);
  if (requiresCsvReview(risk)) await notifyRole('CSV Review Required', risk.riskNumber, riskAssessmentId, ['csv_manager']);
  if (requiresRegulatoryReview(risk)) await notifyRole('Regulatory Review Required', risk.riskNumber, riskAssessmentId, ['regulatory_affairs']);
  if (requiresValidationReview(risk)) await notifyRole('Validation Review Required', risk.riskNumber, riskAssessmentId, ['validation_manager']);

  return { id: existing.id, ...payload };
}

export async function approveMitigation(
  riskAssessmentId: string,
  mitigationId: string,
  form: RiskMitigationFormInput,
  actor: RiskMitigationActor,
): Promise<RiskMitigationRecord> {
  if (!canApproveRiskMitigation(actor.role)) throw new Error('No approval permission');
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) throw new Error('Risk assessment not found');
  const mitigations = await getRiskMitigations(riskAssessmentId);
  const existing = mitigations.find((m) => m.id === mitigationId || m.mitigation_id === mitigationId);
  if (!existing) throw new Error('Mitigation not found');

  const payload = buildMitigationPayload(risk, form, actor, 'Approved', existing);
  if (['High', 'Critical'].includes(payload.residual_risk_level)) {
    throw new Error('Residual risk remains High/Critical. Additional mitigation required.');
  }

  await updateDoc(doc(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION, existing.id), payload);
  await audit(actor, 'approved', riskAssessmentId, payload.mitigation_title);
  await audit(actor, 'residual risk calculated', riskAssessmentId, `${payload.residual_rpn}`);

  await updateRecord(RISK_ASSESSMENT_COLLECTION, riskAssessmentId, {
    riskStatus: 'Effectiveness Check Pending',
    workflowStatus: 'Mitigation',
    mitigationAction: payload.mitigation_description,
    linkedCapaNumber: payload.capa_number || risk.linkedCapaNumber,
    linkedChangeControlNumber: payload.change_control_number || risk.linkedChangeControlNumber,
    updatedByName: actor.name,
  }, { moduleName: RISK_MITIGATION_MODULE, actor: { id: actor.id, name: actor.name } });

  await notify('Mitigation Approved', `${risk.riskNumber} mitigation approved`, riskAssessmentId, risk.createdBy);
  return { id: existing.id, ...payload };
}

export async function rejectMitigation(
  riskAssessmentId: string,
  mitigationId: string,
  reason: string,
  actor: RiskMitigationActor,
): Promise<RiskMitigationRecord> {
  const mitigations = await getRiskMitigations(riskAssessmentId);
  const existing = mitigations.find((m) => m.id === mitigationId || m.mitigation_id === mitigationId);
  if (!existing) throw new Error('Mitigation not found');
  const payload = {
    mitigation_status: 'Rejected',
    remarks: reason || existing.remarks,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION, existing.id), payload);
  await audit(actor, 'rejected', riskAssessmentId, reason);
  return { ...existing, ...payload };
}

export async function closeMitigation(
  riskAssessmentId: string,
  mitigationId: string,
  actor: RiskMitigationActor,
): Promise<RiskMitigationRecord> {
  const mitigations = await getRiskMitigations(riskAssessmentId);
  const existing = mitigations.find((m) => m.id === mitigationId || m.mitigation_id === mitigationId);
  if (!existing) throw new Error('Mitigation not found');
  if (existing.training_required && !existing.training_reference) throw new Error('Training completion reference required before closure');
  if (existing.validation_required && !existing.validation_reference) throw new Error('Validation completion reference required before closure');

  const payload = {
    mitigation_status: isMitigationOverdue(existing) ? 'Overdue' : 'Closed',
    actual_completion_date: existing.actual_completion_date || new Date().toISOString().slice(0, 10),
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION, existing.id), payload);
  await audit(actor, 'closed', riskAssessmentId, existing.mitigation_title);
  return { ...existing, ...payload };
}

export async function softDeleteMitigation(id: string, actor: RiskMitigationActor) {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getFirebaseFirestore(), RISK_MITIGATION_COLLECTION, id), {
    is_deleted: true,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
}

export async function escalateOverdueMitigations(actor: RiskMitigationActor): Promise<number> {
  const all = await listAllRiskMitigations();
  const overdue = all.filter(isMitigationOverdue);
  for (const m of overdue) {
    await notifyRole('Overdue Mitigation', `${m.risk_number} - ${m.mitigation_title}`, m.risk_assessment_id, ['qa_manager', 'risk_manager', 'head_qa']);
    await audit(actor, 'action updated', m.risk_assessment_id, `Overdue mitigation ${m.mitigation_id}`);
  }
  return overdue.length;
}

export { canEditRiskMitigation };
