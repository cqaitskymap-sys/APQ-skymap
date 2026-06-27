import {
  addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  buildCcWorkflowContext,
  buildCcWorkflowSteps,
  canActOnCcApproval,
  CC_APPROVAL_MODULE,
  computeCcApprovalDashboardCounts,
  getCurrentPendingCcApproval,
  mapCcStatusForStep,
  type CcWorkflowStepDef,
  validateCcApprovalAction,
} from '@/lib/cc-approval-records';
import {
  CC_COLLECTIONS,
  type CcApprovalDashboardCounts,
  type CcApprovalHistoryEntry,
  type ChangeApproval,
  type ChangeControlRecord,
} from '@/lib/change-control-types';
import {
  getAuditLogsForChange,
  getChangeById,
  getImpactAssessment,
  getRiskAssessment,
  listChanges,
  updateChange,
} from '@/lib/change-control-service';

export type CcApprovalActor = { id: string; name: string; role?: string; email?: string };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildApprovalId(changeNumber: string, level: number) {
  return `CC-AP-${changeNumber.replace(/\s+/g, '-')}-L${level}-${Date.now().toString(36).toUpperCase()}`;
}

async function audit(actor: CcApprovalActor, actionType: string, changeId: string, detail?: unknown) {
  try {
    await createAuditLog({
      moduleName: CC_APPROVAL_MODULE,
      collectionName: CC_COLLECTIONS.approvals,
      recordId: changeId,
      actionType,
      actionDescription: typeof detail === 'string' ? detail : actionType,
      reason: typeof detail === 'string' ? detail : '',
      newValue: detail,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('cc approval audit', e);
  }
}

async function saveHistory(entry: Omit<CcApprovalHistoryEntry, 'id'>, actor: CcApprovalActor) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.approvalHistory), {
      ...entry,
      created_by: actor.id,
      is_deleted: false,
    });
  } catch (e) {
    console.error('cc saveHistory', e);
  }
}

async function notifyRole(title: string, message: string, changeId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.notifications), {
        title, message, module: CC_APPROVAL_MODULE, record_id: changeId, target_role: role, read: false, created_at: nowIso(),
      });
    } catch (e) {
      console.error('cc approval notify', e);
    }
  }
}

async function notifyUser(title: string, message: string, changeId: string, userId: string) {
  if (!isFirebaseConfigured() || !userId) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.notifications), {
      title, message, module: CC_APPROVAL_MODULE, record_id: changeId, user_id: userId, read: false, created_at: nowIso(),
    });
  } catch (e) {
    console.error('cc approval notify user', e);
  }
}

async function saveEsignRecord(
  change: ChangeControlRecord,
  approval: ChangeApproval,
  eSignature: string,
  meaning: string,
  actor: CcApprovalActor,
) {
  if (!isFirebaseConfigured() || !eSignature.trim()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
      esign_record_id: eSignature,
      module_name: CC_APPROVAL_MODULE,
      record_id: change.id,
      document_number: change.change_control_number,
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
    console.error('cc esign record', e);
  }
}

async function loadWorkflowContext(changeId: string, change: ChangeControlRecord) {
  const [impact, risk] = await Promise.all([
    getImpactAssessment(changeId),
    getRiskAssessment(changeId),
  ]);
  const impactExists = Boolean(impact?.assessed_at);
  const riskExists = Boolean(risk?.assessed_at);
  const impactApproved = impact?.status === 'Approved' || impactExists;
  const riskApproved = risk?.status === 'Approved' || riskExists;
  const dataIntegrityImpact = ['Yes', 'High', 'Critical'].includes(impact?.data_integrity_impact || '')
    || impact?.computerized_system_impact === 'Yes';
  return buildCcWorkflowContext(change, impactExists, riskExists, {
    impactApproved,
    riskApproved,
    dataIntegrityImpact,
  });
}

function assertCanActOnStep(
  actor: CcApprovalActor,
  approval: ChangeApproval,
  change: ChangeControlRecord,
): { ok: boolean; error?: string } {
  if (!canActOnCcApproval(actor.role, approval.current_role, change.initiated_by, actor.id)) {
    return { ok: false, error: 'You do not have permission to act on this approval step.' };
  }
  return { ok: true };
}

function mapStepToApproval(change: ChangeControlRecord, step: CcWorkflowStepDef): Omit<ChangeApproval, 'id'> {
  const ts = nowIso();
  return {
    change_id: change.id,
    change_control_number: change.change_control_number,
    approval_id: buildApprovalId(change.change_control_number, step.level),
    current_workflow_step: step.stepName,
    current_approver: '',
    current_approver_name: '',
    current_approver_role: step.approverRole,
    current_role: step.approverRole,
    approval_level: step.level,
    approval_status: 'Waiting',
    approver_id: '',
    approver_name: '',
    approver_role: step.approverRole,
    decision: 'pending',
    comments: '',
    e_signature_required: step.eSignatureRequired,
    e_signature: '',
    e_signature_status: 'Not Signed',
    signed_at: null,
    due_date: addDays(today(), step.dueDays),
    escalation_status: 'None',
    created_at: ts,
    updated_at: ts,
    is_deleted: false,
  };
}

function normalizeApproval(docId: string, data: Record<string, unknown>): ChangeApproval {
  const a = { id: docId, ...data } as ChangeApproval;
  return {
    ...a,
    approval_status: a.approval_status || (a.decision === 'approved' ? 'Approved' : a.decision === 'rejected' ? 'Rejected' : 'Pending'),
    signed_at: a.signed_at ?? null,
    current_role: a.current_role || a.current_approver_role || a.approver_role,
  };
}

export async function getCcApprovals(changeId: string): Promise<ChangeApproval[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.approvals),
      where('change_id', '==', changeId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => normalizeApproval(d.id, d.data() as Record<string, unknown>)).filter((a) => !a.is_deleted);
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.approvals),
      where('change_id', '==', changeId),
    ));
    return snap.docs.map((d) => normalizeApproval(d.id, d.data() as Record<string, unknown>))
      .filter((a) => !a.is_deleted)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
}

export async function getCcApprovalHistory(changeId?: string): Promise<CcApprovalHistoryEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = changeId
      ? query(collection(getFirebaseFirestore(), CC_COLLECTIONS.approvalHistory), where('change_id', '==', changeId), orderBy('created_at', 'desc'))
      : query(collection(getFirebaseFirestore(), CC_COLLECTIONS.approvalHistory), orderBy('created_at', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CcApprovalHistoryEntry)).filter((h) => !h.is_deleted);
  } catch {
    return [];
  }
}

export async function fetchAllCcApprovalRecords(): Promise<ChangeApproval[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), CC_COLLECTIONS.approvals), limit(1000)));
    return snap.docs.map((d) => normalizeApproval(d.id, d.data() as Record<string, unknown>)).filter((a) => !a.is_deleted);
  } catch {
    return [];
  }
}

export async function initializeCcApprovalWorkflow(changeId: string, actor: CcApprovalActor): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const change = await getChangeById(changeId);
    if (!change) return { error: 'Change control not found' };

    const existing = await getCcApprovals(changeId);
    if (existing.some((a) => ['Pending', 'Waiting', 'Escalated'].includes(a.approval_status || ''))) {
      return {};
    }

    const ctx = await loadWorkflowContext(changeId, change);
    const steps = buildCcWorkflowSteps(ctx, change.department);
    const batch = steps.map((step) => mapStepToApproval(change, step));

    for (let i = 0; i < batch.length; i += 1) {
      const payload = { ...batch[i], approval_status: i === 1 ? 'Pending' : i === 0 ? 'Completed' : 'Waiting' };
      await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.approvals), payload);
    }

    await updateChange(changeId, { status: 'submitted' }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
    await audit(actor, 'change submitted', changeId, 'Approval workflow initialized');
    await saveHistory({
      change_id: changeId,
      change_control_number: change.change_control_number,
      approval_id: batch[1]?.approval_id || '',
      action: 'Change Submitted',
      workflow_step: 'Submitted',
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role || 'qa',
      comments: 'Change control submitted for approval workflow',
      created_at: nowIso(),
      created_by: actor.id,
    }, actor);

    const nextStep = steps[1];
    await notifyUser('Change Pending Approval', `${change.change_control_number} awaiting ${nextStep?.stepName}`, changeId, change.initiated_by);
    await notifyRole('Change Pending Approval', `${change.change_control_number} — ${nextStep?.stepName}`, changeId, [nextStep?.approverRole || 'qa_manager']);
    await notifyRole('Department Head Review Required', change.change_control_number, changeId, [deptToNotifyRole(change.department)]);
    if (ctx.headQaRequired) await notifyRole('Critical Change Submitted', change.change_control_number, changeId, ['head_qa']);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to initialize approval workflow' };
  }
}

async function completeCcStepAndAdvance(
  approval: ChangeApproval,
  change: ChangeControlRecord,
  action: 'approve' | 'reject' | 'send_back',
  payload: { comments?: string; rejection_reason?: string; send_back_reason?: string; e_signature?: string; signature_meaning?: string },
  actor: CcApprovalActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const ts = nowIso();
  const stepName = approval.current_workflow_step || '';
  const ctx = await loadWorkflowContext(change.id, change);

  if (action === 'approve') {
    const validation = validateCcApprovalAction(stepName, ctx);
    if (!validation.ok) return { error: validation.error };
    if (approval.e_signature_required && !payload.e_signature?.trim()) {
      return { error: 'E-signature required for this approval step.' };
    }
    const stepDef = buildCcWorkflowSteps(ctx, change.department).find((s) => s.stepName === stepName);
    if (stepDef?.commentRequired && !payload.comments?.trim()) {
      return { error: 'Approval comments are required for this step.' };
    }
  }

  const statusMap = { approve: 'Approved', reject: 'Rejected', send_back: 'Sent Back' } as const;
  const decisionMap = { approve: 'approved', reject: 'rejected', send_back: 'sent_back' } as const;

  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.approvals, approval.id), {
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

  if (payload.e_signature) {
    await saveEsignRecord(change, approval, payload.e_signature, payload.signature_meaning || '', actor);
    await audit(actor, 'e-signature success', change.id, payload.signature_meaning);
  }

  const actionLabel = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'sent back';
  await audit(actor, actionLabel, change.id, payload.comments || payload.rejection_reason || payload.send_back_reason);
  await saveHistory({
    change_id: change.id,
    change_control_number: change.change_control_number,
    approval_id: approval.approval_id || approval.id,
    action: action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Sent Back',
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

  let newStatus = mapCcStatusForStep(stepName, action === 'approve' ? 'approve' : action);

  if (action === 'approve') {
    const allApprovals = await getCcApprovals(change.id);
    const next = allApprovals
      .filter((a) => a.approval_status === 'Waiting')
      .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0];

    if (next) {
      await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.approvals, next.id), {
        approval_status: 'Pending',
        updated_at: ts,
      });
      newStatus = mapCcStatusForStep(next.current_workflow_step || stepName, 'approve');
      await audit(actor, 'review started', change.id, next.current_workflow_step);
      await notifyRole('Change Pending Approval', `${change.change_control_number} — ${next.current_workflow_step}`, change.id, [next.current_role || 'qa_manager']);
      await notifyUser('Change Approval Step', `${change.change_control_number} advanced to ${next.current_workflow_step}`, change.id, change.initiated_by);
      if (next.current_workflow_step === 'CSV Review') {
        await notifyRole('CSV Review Required', change.change_control_number, change.id, ['csv_team', 'it_csv']);
        if (ctx.dataIntegrityCsv) {
          await notifyRole('Data Integrity — CSV Review Required', change.change_control_number, change.id, ['csv_team']);
        }
      }
      if (next.current_workflow_step === 'Validation Review') await notifyRole('Validation Review Required', change.change_control_number, change.id, ['validation_team']);
      if (next.current_workflow_step === 'Regulatory Review') await notifyRole('Regulatory Review Required', change.change_control_number, change.id, ['regulatory_affairs']);
      if (next.current_workflow_step === 'Head QA Review') await notifyRole('Head QA Review Required', change.change_control_number, change.id, ['head_qa']);
    } else if (stepName === 'Final Approval') {
      newStatus = 'approved_for_implementation';
      await audit(actor, 'final approval completed', change.id);
      await audit(actor, 'implementation authorized', change.id);
      await saveHistory({
        change_id: change.id,
        change_control_number: change.change_control_number,
        approval_id: approval.approval_id || approval.id,
        action: 'Implementation Authorized',
        workflow_step: 'Closed',
        user_id: actor.id,
        user_name: actor.name,
        user_role: actor.role || 'qa',
        comments: 'Final approval completed — implementation authorized',
        created_at: ts,
        created_by: actor.id,
      }, actor);
      await notifyUser('Change Approved for Implementation', change.change_control_number, change.id, change.initiated_by);
      await notifyRole('Change Approved for Implementation', change.change_control_number, change.id, ['qa_manager', 'head_qa', 'admin']);
    } else if (stepName === 'Implementation Approval') {
      newStatus = 'approved_for_implementation';
      await audit(actor, 'implementation authorized', change.id);
      await notifyUser('Implementation Authorized', change.change_control_number, change.id, change.initiated_by);
    }
  } else if (action === 'reject') {
    await notifyUser('Change Rejected', `${change.change_control_number}: ${payload.rejection_reason}`, change.id, change.initiated_by);
    await notifyRole('Change Rejected', change.change_control_number, change.id, ['qa_manager', 'head_qa']);
  } else if (action === 'send_back') {
    newStatus = 'draft';
    await notifyUser('Change Sent Back', `${change.change_control_number}: ${payload.send_back_reason}`, change.id, change.initiated_by);
    await notifyRole('Change Sent Back', change.change_control_number, change.id, [deptToNotifyRole(change.department)]);
  }

  await updateChange(change.id, { status: newStatus }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
  return {};
}

function deptToNotifyRole(department: string): string {
  const map: Record<string, string> = {
    Production: 'production_manager', QC: 'qc_manager', QA: 'qa_manager', Engineering: 'engineering_manager',
  };
  return map[department] || 'production_manager';
}

export async function approveCcStep(
  changeId: string,
  approvalId: string,
  comments: string,
  eSignature: string,
  signatureMeaning: string,
  actor: CcApprovalActor,
): Promise<{ error?: string }> {
  const change = await getChangeById(changeId);
  if (!change) return { error: 'Change control not found' };
  const approvals = await getCcApprovals(changeId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  if (!['Pending', 'Escalated'].includes(approval.approval_status || '')) {
    return { error: 'This approval step is not pending' };
  }
  const perm = assertCanActOnStep(actor, approval, change);
  if (!perm.ok) return { error: perm.error };
  return completeCcStepAndAdvance(approval, change, 'approve', { comments, e_signature: eSignature, signature_meaning: signatureMeaning }, actor);
}

export async function rejectCcStep(
  changeId: string,
  approvalId: string,
  rejectionReason: string,
  comments: string,
  actor: CcApprovalActor,
  eSignature?: string,
  signatureMeaning?: string,
): Promise<{ error?: string }> {
  if (!rejectionReason.trim()) return { error: 'Rejection reason is mandatory' };
  const change = await getChangeById(changeId);
  if (!change) return { error: 'Change control not found' };
  const approvals = await getCcApprovals(changeId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  const perm = assertCanActOnStep(actor, approval, change);
  if (!perm.ok) return { error: perm.error };
  if (approval.e_signature_required && !eSignature?.trim()) {
    return { error: 'E-signature required for rejection on this step.' };
  }
  return completeCcStepAndAdvance(approval, change, 'reject', {
    rejection_reason: rejectionReason,
    comments,
    e_signature: eSignature,
    signature_meaning: signatureMeaning,
  }, actor);
}

export async function sendBackCcStep(
  changeId: string,
  approvalId: string,
  sendBackReason: string,
  comments: string,
  actor: CcApprovalActor,
): Promise<{ error?: string }> {
  if (!sendBackReason.trim()) return { error: 'Send back reason is mandatory' };
  const change = await getChangeById(changeId);
  if (!change) return { error: 'Change control not found' };
  const approvals = await getCcApprovals(changeId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  const perm = assertCanActOnStep(actor, approval, change);
  if (!perm.ok) return { error: perm.error };
  return completeCcStepAndAdvance(approval, change, 'send_back', { send_back_reason: sendBackReason, comments }, actor);
}

export async function escalateCcApproval(
  changeId: string,
  approvalId: string,
  actor: CcApprovalActor,
): Promise<{ error?: string }> {
  const approvals = await getCcApprovals(changeId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  const change = await getChangeById(changeId);
  if (!change) return { error: 'Change control not found' };
  const perm = assertCanActOnStep(actor, approval, change);
  if (!perm.ok) return { error: perm.error };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.approvals, approval.id), {
    approval_status: 'Escalated',
    escalation_status: 'Escalated',
    updated_at: nowIso(),
    updated_by: actor.id,
  });
  await audit(actor, 'escalated', changeId, `Escalated at ${approval.current_workflow_step}`);
  await saveHistory({
    change_id: changeId,
    change_control_number: approval.change_control_number,
    approval_id: approval.approval_id || approval.id,
    action: 'Escalated',
    workflow_step: approval.current_workflow_step,
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role || 'qa',
    comments: 'Approval escalated due to overdue review',
    created_at: nowIso(),
    created_by: actor.id,
  }, actor);
  await notifyRole('Overdue Approval Escalated', approval.change_control_number || changeId, changeId, ['admin', 'head_qa']);
  return {};
}

export async function escalateOverdueCcApprovals(actor: CcApprovalActor): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const all = await fetchAllCcApprovalRecords();
  const todayStr = today();
  let count = 0;
  for (const a of all) {
    if (a.approval_status === 'Pending' && a.due_date && a.due_date < todayStr && a.escalation_status !== 'Escalated') {
      await escalateCcApproval(a.change_id, a.id, actor);
      count += 1;
    }
  }
  return count;
}

export async function logCcEsignResult(
  changeId: string,
  success: boolean,
  detail: string,
  actor: CcApprovalActor,
) {
  await audit(actor, success ? 'e-signature success' : 'e-signature failed', changeId, detail);
}

export async function fetchCcApprovalPageData(changeId: string) {
  try {
    const [change, approvals, history, auditLogs] = await Promise.all([
      getChangeById(changeId),
      getCcApprovals(changeId),
      getCcApprovalHistory(changeId),
      getAuditLogsForChange(changeId),
    ]);
    if (!change) return { error: 'Change control not found' };
    const ctx = await loadWorkflowContext(changeId, change);
    const current = getCurrentPendingCcApproval(approvals);
    const steps = buildCcWorkflowSteps(ctx, change.department);
    return { change, approvals, history, auditLogs, current, workflowContext: ctx, steps };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load approval data' };
  }
}

export async function fetchCcApprovalDashboardData(
  actor: CcApprovalActor,
  userRole?: string,
): Promise<{
  approvals: ChangeApproval[];
  history: CcApprovalHistoryEntry[];
  records: ChangeControlRecord[];
  counts: CcApprovalDashboardCounts;
  error?: string;
}> {
  try {
    const [approvals, history, records] = await Promise.all([
      fetchAllCcApprovalRecords(),
      getCcApprovalHistory(),
      listChanges(),
    ]);
    const counts = computeCcApprovalDashboardCounts(approvals, records, userRole, actor.id);
    return { approvals, history, records, counts };
  } catch (e) {
    return {
      approvals: [],
      history: [],
      records: [],
      counts: computeCcApprovalDashboardCounts([], [], userRole, actor.id),
      error: e instanceof Error ? e.message : 'Failed to load dashboard',
    };
  }
}

export { computeCcApprovalDashboardCounts };
