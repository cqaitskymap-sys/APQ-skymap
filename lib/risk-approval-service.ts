import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { RISK_ASSESSMENT_COLLECTION } from '@/lib/cpv-risk-assessment-records';
import {
  fetchRiskAssessmentById,
  fetchRiskAssessmentRecords,
} from '@/lib/cpv-risk-assessment-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { updateRecord } from '@/lib/firestore';
import {
  RISK_APPROVAL_HISTORY_COLLECTION,
  RISK_APPROVAL_MODULE,
  RISK_APPROVALS_COLLECTION,
  buildRiskWorkflowContext,
  buildRiskWorkflowSteps,
  getCurrentPendingRiskApproval,
  mapRiskStatusForStep,
  notifyRolesForStep,
  type RiskApproval,
  type RiskApprovalActor,
  type RiskApprovalHistoryEntry,
  type RiskWorkflowStepDef,
  validateRiskApprovalAction,
} from '@/lib/risk-approval-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';

export type { RiskApprovalActor };

const NOTIFICATIONS = 'notifications';
const AUDIT_TRAIL = 'audit_trail';

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildApprovalId(riskNumber: string, level: number) {
  return `RAP-${riskNumber.replace(/\s+/g, '-')}-L${level}-${Date.now().toString(36).toUpperCase()}`;
}

async function audit(actor: RiskApprovalActor, actionType: string, recordId: string, detail?: unknown) {
  try {
    await createAuditLog({
      moduleName: RISK_APPROVAL_MODULE,
      collectionName: RISK_APPROVALS_COLLECTION,
      recordId,
      actionType,
      actionDescription: typeof detail === 'string' ? detail : actionType,
      reason: typeof detail === 'string' ? detail : '',
      newValue: detail,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('risk approval audit', e);
  }
}

async function saveHistory(entry: Omit<RiskApprovalHistoryEntry, 'id'>, actor: RiskApprovalActor) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), RISK_APPROVAL_HISTORY_COLLECTION), {
      ...entry,
      created_by: actor.id,
      is_deleted: false,
    });
  } catch (e) {
    console.error('risk saveHistory', e);
  }
}

async function notifyRole(title: string, message: string, recordId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
        title, message, module: RISK_APPROVAL_MODULE, record_id: recordId, target_role: role, read: false, created_at: nowIso(),
      });
    } catch (e) {
      console.error('risk approval notify', e);
    }
  }
}

async function notifyUser(title: string, message: string, recordId: string, userId: string) {
  if (!isFirebaseConfigured() || !userId) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), NOTIFICATIONS), {
      title, message, module: RISK_APPROVAL_MODULE, record_id: recordId, user_id: userId, read: false, created_at: nowIso(),
    });
  } catch (e) {
    console.error('risk approval notify user', e);
  }
}

async function saveEsignRecord(
  risk: RiskAssessmentRecord,
  approval: RiskApproval,
  eSignature: string,
  actor: RiskApprovalActor,
  meaning: string,
) {
  if (!isFirebaseConfigured() || !eSignature.trim()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
      esign_record_id: eSignature,
      module_name: RISK_APPROVAL_MODULE,
      record_id: risk.id,
      document_number: risk.riskNumber,
      action_type: approval.current_workflow_step || 'Approval',
      signature_meaning: meaning,
      user_id: actor.id,
      user_name: actor.name,
      user_email: actor.email || '',
      user_role: actor.role || '',
      signed_date_time: nowIso(),
      authentication_status: 'Success',
      is_test: false,
      is_deleted: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('risk esign record', e);
  }
}

function mapStepToApproval(riskId: string, riskNumber: string, step: RiskWorkflowStepDef, actor: RiskApprovalActor): Omit<RiskApproval, 'id'> {
  const ts = nowIso();
  return {
    risk_assessment_id: riskId,
    risk_number: riskNumber,
    approval_id: buildApprovalId(riskNumber, step.level),
    current_workflow_step: step.stepName,
    current_approver: '',
    current_role: step.approverRole,
    current_approver_role: step.approverRole,
    approval_level: step.level,
    approval_status: 'Waiting',
    approval_comments: '',
    due_date: addDays(today(), step.dueDays),
    escalation_status: 'None',
    e_signature_required: step.eSignatureRequired,
    e_signature_status: 'Not Signed',
    created_at: ts,
    updated_at: ts,
    created_by: actor.id,
    created_by_name: actor.name,
    is_deleted: false,
  };
}

function normalizeApproval(docId: string, data: Record<string, unknown>): RiskApproval {
  const a = { id: docId, ...data } as RiskApproval;
  return {
    ...a,
    approval_status: a.approval_status || 'Pending',
    approval_comments: a.approval_comments || a.comments || '',
    signed_at: a.signed_at ?? a.signed_date ?? null,
  };
}

export async function getRiskApprovals(riskAssessmentId: string): Promise<RiskApproval[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => normalizeApproval(d.id, d.data() as Record<string, unknown>)).filter((a) => !a.is_deleted);
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION),
      where('risk_assessment_id', '==', riskAssessmentId),
    ));
    return snap.docs.map((d) => normalizeApproval(d.id, d.data() as Record<string, unknown>))
      .filter((a) => !a.is_deleted)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
}

export async function getRiskApprovalHistory(riskAssessmentId?: string): Promise<RiskApprovalHistoryEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = riskAssessmentId
      ? query(collection(getFirebaseFirestore(), RISK_APPROVAL_HISTORY_COLLECTION), where('risk_assessment_id', '==', riskAssessmentId), orderBy('created_at', 'desc'))
      : query(collection(getFirebaseFirestore(), RISK_APPROVAL_HISTORY_COLLECTION), orderBy('created_at', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RiskApprovalHistoryEntry)).filter((h) => !h.is_deleted);
  } catch {
    return [];
  }
}

export async function fetchAllRiskApprovalRecords(): Promise<RiskApproval[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION), limit(1000)));
    return snap.docs.map((d) => normalizeApproval(d.id, d.data() as Record<string, unknown>)).filter((a) => !a.is_deleted);
  } catch {
    return [];
  }
}

export async function initializeRiskApprovalWorkflow(
  riskAssessmentId: string,
  actor: RiskApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const risk = await fetchRiskAssessmentById(riskAssessmentId);
    if (!risk) return { error: 'Risk assessment not found' };
    if (['Closed', 'Rejected'].includes(risk.riskStatus)) {
      return { error: 'Cannot submit closed or rejected risk for approval' };
    }

    const existing = await getRiskApprovals(riskAssessmentId);
    if (existing.some((a) => ['Pending', 'Waiting', 'Escalated', 'Approved'].includes(a.approval_status || ''))) {
      return {};
    }

    const ctx = buildRiskWorkflowContext(risk);
    if (!ctx.fmeaCompleted) return { error: 'FMEA must be completed before submitting for approval.' };
    if (!ctx.mitigationPlanExists) return { error: 'Mitigation plan must exist before submitting for approval.' };

    const steps = buildRiskWorkflowSteps(ctx);
    const batch = steps.map((step) => mapStepToApproval(riskAssessmentId, risk.riskNumber, step, actor));

    for (let i = 0; i < batch.length; i += 1) {
      const payload = { ...batch[i], approval_status: i === 0 ? 'Pending' : 'Waiting' };
      await addDoc(collection(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION), payload);
    }

    await updateRecord(RISK_ASSESSMENT_COLLECTION, riskAssessmentId, {
      riskStatus: 'Under Review',
      workflowStatus: 'Review',
      updatedByName: actor.name,
    }, { moduleName: RISK_APPROVAL_MODULE, actor: { id: actor.id, name: actor.name } });

    await audit(actor, 'risk submitted', riskAssessmentId, 'Approval workflow initialized');
    await saveHistory({
      risk_assessment_id: riskAssessmentId,
      risk_number: risk.riskNumber,
      approval_id: batch[0]?.approval_id || '',
      action: 'Risk Submitted',
      workflow_step: 'Submitted',
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role || 'risk_owner',
      comments: 'Risk assessment submitted for approval workflow',
      created_at: nowIso(),
      created_by: actor.id,
    }, actor);

    const nextStep = steps[1];
    if (nextStep) {
      await notifyRole('Risk Pending Approval', `${risk.riskNumber} — ${nextStep.stepName}`, riskAssessmentId, notifyRolesForStep(nextStep.approverRole));
    }
    await notifyUser('Risk Submitted', `${risk.riskNumber} submitted for approval`, riskAssessmentId, risk.createdBy);
    if (ctx.headQaRequired) await notifyRole('Critical Risk Submitted', risk.riskNumber, riskAssessmentId, ['head_qa']);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to initialize approval workflow' };
  }
}

async function completeRiskStepAndAdvance(
  approval: RiskApproval,
  risk: RiskAssessmentRecord,
  action: 'approve' | 'reject' | 'send_back',
  payload: { comments?: string; rejection_reason?: string; send_back_reason?: string; e_signature?: string },
  actor: RiskApprovalActor,
  meaning: string,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const ts = nowIso();
  const stepName = approval.current_workflow_step || '';
  const ctx = buildRiskWorkflowContext(risk);

  if (action === 'approve') {
    const validation = validateRiskApprovalAction(stepName, ctx, action);
    if (!validation.ok) return { error: validation.error };
    if (approval.e_signature_required && !payload.e_signature?.trim()) {
      return { error: 'E-signature required for this approval step.' };
    }
    const stepDef = buildRiskWorkflowSteps(ctx).find((s) => s.stepName === stepName);
    if (stepDef?.commentRequired && !payload.comments?.trim()) {
      return { error: 'Approval comments are required for this step.' };
    }
  }

  const statusMap = { approve: 'Approved', reject: 'Rejected', send_back: 'Sent Back' } as const;
  const decisionMap = { approve: 'approved', reject: 'rejected', send_back: 'sent_back' } as const;

  await updateDoc(doc(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION, approval.id), {
    approval_status: statusMap[action],
    decision: decisionMap[action],
    approver_id: actor.id,
    approver_name: actor.name,
    approver_role: actor.role || 'qa',
    current_approver: actor.id,
    current_approver_name: actor.name,
    approval_comments: payload.comments || '',
    comments: payload.comments || '',
    rejection_reason: payload.rejection_reason || '',
    send_back_reason: payload.send_back_reason || '',
    e_signature: payload.e_signature || '',
    e_signature_status: payload.e_signature ? 'Signed' : 'Not Signed',
    signed_by: actor.name,
    signed_date: ts,
    signed_at: ts,
    completed_date: today(),
    updated_at: ts,
    updated_by: actor.id,
    updated_by_name: actor.name,
  });

  if (payload.e_signature) await saveEsignRecord(risk, approval, payload.e_signature, actor, meaning);

  const actionLabel = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Sent Back';
  await audit(actor, actionLabel.toLowerCase(), risk.id, payload.comments || payload.rejection_reason || payload.send_back_reason);
  if (payload.e_signature) await audit(actor, 'e-signature success', risk.id, meaning);
  await saveHistory({
    risk_assessment_id: risk.id,
    risk_number: risk.riskNumber,
    approval_id: approval.approval_id || approval.id,
    action: actionLabel,
    workflow_step: stepName,
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role || 'qa',
    comments: payload.comments || '',
    rejection_reason: payload.rejection_reason,
    send_back_reason: payload.send_back_reason,
    e_signature_status: payload.e_signature ? 'Signed' : 'Not Signed',
    created_at: ts,
    created_by: actor.id,
  }, actor);

  const statusUpdate = mapRiskStatusForStep(stepName, action === 'approve' ? 'approve' : action);

  if (action === 'approve') {
    const allApprovals = await getRiskApprovals(risk.id);
    const next = allApprovals
      .filter((a) => !a.is_deleted && a.approval_status === 'Waiting')
      .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0];

    if (next) {
      await updateDoc(doc(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION, next.id), {
        approval_status: 'Pending',
        updated_at: ts,
      });
      await notifyRole('Risk Pending Approval', `${risk.riskNumber} — ${next.current_workflow_step}`, risk.id, notifyRolesForStep(next.current_role || ''));
      await notifyUser('Risk Approval Step', `${risk.riskNumber} advanced to ${next.current_workflow_step}`, risk.id, risk.createdBy);
    } else if (stepName === 'Final Approval') {
      await audit(actor, 'final approval completed', risk.id);
      await audit(actor, 'risk activated', risk.id, 'Risk active in register');
      await saveHistory({
        risk_assessment_id: risk.id,
        risk_number: risk.riskNumber,
        approval_id: approval.approval_id || approval.id,
        action: 'Final Approval Completed',
        workflow_step: 'Closed',
        user_id: actor.id,
        user_name: actor.name,
        user_role: actor.role || 'qa',
        comments: 'Risk assessment fully approved and activated',
        created_at: ts,
        created_by: actor.id,
      }, actor);
      await notifyUser('Risk Approved', `${risk.riskNumber} fully approved`, risk.id, risk.createdBy);
      await notifyRole('Risk Approved', risk.riskNumber, risk.id, ['risk_manager', 'qa_manager', 'head_qa', 'admin']);
    }
  } else if (action === 'reject') {
    await notifyUser('Risk Rejected', `${risk.riskNumber}: ${payload.rejection_reason}`, risk.id, risk.createdBy);
    await notifyRole('Risk Rejected', risk.riskNumber, risk.id, ['risk_manager', 'qa_manager', 'head_qa']);
  } else if (action === 'send_back') {
    await notifyUser('Risk Sent Back', `${risk.riskNumber}: ${payload.send_back_reason}`, risk.id, risk.createdBy);
    await notifyRole('Risk Sent Back', risk.riskNumber, risk.id, ['department_head', 'risk_manager', 'qa']);
  }

  await updateRecord(RISK_ASSESSMENT_COLLECTION, risk.id, {
    riskStatus: statusUpdate.riskStatus,
    workflowStatus: statusUpdate.workflowStatus,
    ...(statusUpdate.lock ? { isLocked: true, approvedBy: actor.name, approvalDate: today() } : {}),
    ...(action === 'send_back' ? { isLocked: false } : {}),
    updatedByName: actor.name,
  }, { moduleName: RISK_APPROVAL_MODULE, actor: { id: actor.id, name: actor.name } });

  return {};
}

export async function approveRiskStep(
  riskAssessmentId: string,
  approvalId: string,
  comments: string,
  eSignature: string,
  actor: RiskApprovalActor,
  meaning: string,
): Promise<{ error?: string }> {
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) return { error: 'Risk assessment not found' };
  if (risk.riskStatus === 'Closed') return { error: 'Risk assessment is closed' };
  const approvals = await getRiskApprovals(riskAssessmentId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  return completeRiskStepAndAdvance(approval, risk, 'approve', { comments, e_signature: eSignature }, actor, meaning);
}

export async function rejectRiskStep(
  riskAssessmentId: string,
  approvalId: string,
  rejectionReason: string,
  comments: string,
  actor: RiskApprovalActor,
): Promise<{ error?: string }> {
  if (!rejectionReason.trim()) return { error: 'Reject reason is mandatory' };
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) return { error: 'Risk assessment not found' };
  const approvals = await getRiskApprovals(riskAssessmentId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  return completeRiskStepAndAdvance(approval, risk, 'reject', { rejection_reason: rejectionReason, comments }, actor, '');
}

export async function sendBackRiskStep(
  riskAssessmentId: string,
  approvalId: string,
  sendBackReason: string,
  comments: string,
  actor: RiskApprovalActor,
): Promise<{ error?: string }> {
  if (!sendBackReason.trim()) return { error: 'Send back reason is mandatory' };
  const risk = await fetchRiskAssessmentById(riskAssessmentId);
  if (!risk) return { error: 'Risk assessment not found' };
  const approvals = await getRiskApprovals(riskAssessmentId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  return completeRiskStepAndAdvance(approval, risk, 'send_back', { send_back_reason: sendBackReason, comments }, actor, '');
}

export async function escalateOverdueRiskApprovals(actor: RiskApprovalActor): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const all = await fetchAllRiskApprovalRecords();
  const todayStr = today();
  let count = 0;

  for (const a of all) {
    if (!['Pending', 'Escalated'].includes(a.approval_status || '')) continue;
    if (!a.due_date || a.due_date >= todayStr) continue;

    await updateDoc(doc(getFirebaseFirestore(), RISK_APPROVALS_COLLECTION, a.id), {
      approval_status: 'Escalated',
      escalation_status: 'Escalated',
      updated_at: nowIso(),
    });

    await audit(actor, 'escalated', a.risk_assessment_id, `Overdue: ${a.current_workflow_step}`);
    await notifyRole('Overdue Risk Approval', `${a.risk_number} — ${a.current_workflow_step}`, a.risk_assessment_id, ['admin', 'head_qa', 'qa_manager']);
    await saveHistory({
      risk_assessment_id: a.risk_assessment_id,
      risk_number: a.risk_number,
      approval_id: a.approval_id || a.id,
      action: 'Escalated',
      workflow_step: a.current_workflow_step || '',
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role || 'admin',
      comments: 'Auto-escalated due to overdue approval',
      created_at: nowIso(),
      created_by: actor.id,
    }, actor);
    count += 1;
  }
  return count;
}

export async function logRiskEsignResult(
  riskAssessmentId: string,
  success: boolean,
  actor: RiskApprovalActor,
  detail?: string,
) {
  await audit(actor, success ? 'e-signature success' : 'e-signature failure', riskAssessmentId, detail);
}

async function getAuditLogsForRiskApproval(riskId: string) {
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

export async function fetchRiskApprovalPageData(riskAssessmentId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const risk = await fetchRiskAssessmentById(riskAssessmentId);
    if (!risk) return { error: 'Risk assessment not found.' };

    const [approvals, history, auditLogs] = await Promise.all([
      getRiskApprovals(riskAssessmentId),
      getRiskApprovalHistory(riskAssessmentId),
      getAuditLogsForRiskApproval(riskAssessmentId),
    ]);

    const ctx = buildRiskWorkflowContext(risk);
    const current = getCurrentPendingRiskApproval(approvals);
    return {
      risk,
      approvals,
      history,
      auditLogs,
      current,
      workflowSteps: buildRiskWorkflowSteps(ctx),
      workflowContext: ctx,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load approval data' };
  }
}

export async function fetchRiskApprovalDashboardData(actor: RiskApprovalActor, role?: string) {
  const [approvals, history] = await Promise.all([
    fetchAllRiskApprovalRecords(),
    getRiskApprovalHistory(),
  ]);

  let risks: RiskAssessmentRecord[] = [];
  if (isFirebaseConfigured()) {
    try {
      risks = await fetchRiskAssessmentRecords();
    } catch {
      risks = [];
    }
  }

  const { computeRiskApprovalDashboardCounts } = await import('./risk-approval-records');
  return {
    approvals,
    history,
    risks,
    counts: computeRiskApprovalDashboardCounts(approvals, history, risks, actor.id, role),
  };
}

export {
  buildRiskWorkflowSteps,
  computeRiskApprovalDashboardCounts,
  getCurrentPendingRiskApproval,
  mapHistoryToRiskApprovalTimeline,
  riskApprovalMeaning,
} from '@/lib/risk-approval-records';
