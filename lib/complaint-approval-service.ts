import {
  addDoc, collection, doc, getDocs, limit, query, updateDoc, where, orderBy,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getCapaById } from '@/lib/capa-service';
import {
  canCloseComplaintWithCapa,
  getActiveComplaintCapaLink,
  isComplaintCapaSatisfiedForClosure,
} from '@/lib/complaint-capa-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { getComplaintImpactAssessment } from '@/lib/complaint-impact-service';
import { getComplaintInvestigationRecord } from '@/lib/complaint-investigation-service';
import {
  buildComplaintWorkflowSteps,
  COMPLAINT_APPROVAL_MODULE,
  getCurrentPendingComplaintApproval,
  mapComplaintStatusForStep,
  validateComplaintApprovalAction,
  type ComplaintApprovalActor,
  type ComplaintWorkflowStepDef,
} from '@/lib/complaint-approval-records';
import {
  COMPLAINT_COLLECTIONS,
  type ComplaintApproval,
  type ComplaintApprovalHistoryEntry,
  type ComplaintRecord,
} from '@/lib/complaint-types';
import {
  getAuditLogsForComplaint,
  getComplaintById,
  listComplaints,
  updateComplaint,
} from '@/lib/complaint-service';

export type { ComplaintApprovalActor };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

function buildApprovalId(complaintNumber: string, level: number) {
  return `CAP-${complaintNumber.replace(/\s+/g, '-')}-L${level}-${Date.now().toString(36).toUpperCase()}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function audit(actor: ComplaintApprovalActor, actionType: string, complaintId: string, detail?: unknown) {
  try {
    await createAuditLog({
      moduleName: COMPLAINT_APPROVAL_MODULE,
      collectionName: COMPLAINT_COLLECTIONS.approvals,
      recordId: complaintId,
      actionType,
      actionDescription: typeof detail === 'string' ? detail : actionType,
      reason: typeof detail === 'string' ? detail : '',
      newValue: detail,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
  } catch (e) {
    console.error('complaint approval audit', e);
  }
}

async function saveHistory(entry: Omit<ComplaintApprovalHistoryEntry, 'id'>, actor: ComplaintApprovalActor) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvalHistory), {
      ...entry,
      created_by: actor.id,
      is_deleted: false,
    });
  } catch (e) {
    console.error('complaint approval history', e);
  }
}

async function notifyRole(title: string, message: string, complaintId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.notifications), {
        title, message, module: 'Complaint', record_id: complaintId, target_role: role, read: false, created_at: nowIso(),
      });
    } catch (e) {
      console.error('complaint approval notify', e);
    }
  }
}

function mapStepToApproval(
  complaintId: string,
  complaintNumber: string,
  step: ComplaintWorkflowStepDef,
): Omit<ComplaintApproval, 'id'> {
  const ts = nowIso();
  return {
    complaint_id: complaintId,
    complaint_number: complaintNumber,
    approval_id: buildApprovalId(complaintNumber, step.level),
    current_workflow_step: step.stepName,
    current_approver: '',
    current_approver_name: '',
    current_role: step.approverRole,
    approval_level: step.level,
    approval_status: 'Waiting',
    approver_id: '',
    approver_name: '',
    approver_role: step.approverRole,
    decision: 'waiting',
    comments: '',
    e_signature_required: step.eSignatureRequired,
    e_signature: '',
    e_signature_status: 'Not Signed',
    signed_at: null,
    due_date: addDays(today(), step.dueDays),
    completed_date: null,
    escalation_status: 'None',
    created_at: ts,
    updated_at: ts,
    is_deleted: false,
  };
}

export async function getComplaintApprovals(complaintId: string): Promise<ComplaintApproval[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals),
      where('complaint_id', '==', complaintId),
      orderBy('created_at', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintApproval));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals),
      where('complaint_id', '==', complaintId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintApproval))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
}

export async function getComplaintApprovalHistory(complaintId?: string): Promise<ComplaintApprovalHistoryEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = complaintId
      ? query(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvalHistory), where('complaint_id', '==', complaintId), orderBy('created_at', 'desc'))
      : query(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvalHistory), orderBy('created_at', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintApprovalHistoryEntry));
  } catch {
    return [];
  }
}

export async function fetchAllComplaintApprovalRecords(): Promise<ComplaintApproval[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals), limit(1000)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintApproval)).filter((a) => !a.is_deleted);
  } catch {
    return [];
  }
}

async function investigationComplete(complaintId: string): Promise<boolean> {
  const inv = await getComplaintInvestigationRecord(complaintId);
  if (!inv) return false;
  return ['Completed', 'CAPA Required', 'Recall Evaluation'].includes(inv.investigation_status || '');
}

async function impactComplete(complaintId: string): Promise<boolean> {
  const impact = await getComplaintImpactAssessment(complaintId);
  if (!impact) return false;
  return impact.status === 'Approved';
}

async function capaSatisfied(record: ComplaintRecord): Promise<boolean> {
  if (!record.capa_required) return true;
  const link = await getActiveComplaintCapaLink(record.id);
  const capa = record.linked_capa_id
    ? await getCapaById(record.linked_capa_id)
    : (link?.capa_id ? await getCapaById(link.capa_id) : null);
  return isComplaintCapaSatisfiedForClosure(capa, true);
}

async function recallComplete(record: ComplaintRecord): Promise<boolean> {
  if (!record.recall_evaluation_required && !record.recall_required) return true;
  return Boolean(record.linked_recall_id) || record.status === 'closed';
}

async function gatherChecks(record: ComplaintRecord) {
  const impact = await getComplaintImpactAssessment(record.id);
  return {
    investigationComplete: await investigationComplete(record.id),
    impactComplete: await impactComplete(record.id),
    capaSatisfied: await capaSatisfied(record),
    recallComplete: await recallComplete(record),
    impact,
  };
}

export async function initializeComplaintApprovalWorkflow(
  complaintId: string,
  actor: ComplaintApprovalActor,
): Promise<{ error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };
  if (record.status === 'draft') return { error: 'Complaint must be submitted before starting approval workflow.' };

  const existing = await getComplaintApprovals(complaintId);
  if (existing.some((a) => !a.is_deleted && ['Pending', 'Waiting', 'Escalated', 'Approved'].includes(a.approval_status || ''))) {
    return { error: 'Approval workflow already initialized.' };
  }

  const impact = await getComplaintImpactAssessment(complaintId);
  const steps = buildComplaintWorkflowSteps(record, impact);
  const batch = steps.map((step) => mapStepToApproval(complaintId, record.complaint_number, step));

  for (let i = 0; i < batch.length; i += 1) {
    const payload = { ...batch[i], approval_status: i === 0 ? 'Pending' : 'Waiting', decision: i === 0 ? 'pending' : 'waiting' };
    await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals), payload);
  }

  await updateComplaint(complaintId, { status: 'received' }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
  await audit(actor, 'Submit Complaint for Approval', complaintId, 'Approval workflow initialized');
  await saveHistory({
    complaint_id: complaintId,
    complaint_number: record.complaint_number,
    approval_id: batch[0]?.approval_id || '',
    action: 'Submit Complaint',
    workflow_step: 'Received',
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role || 'qa',
    comments: 'Complaint submitted for approval workflow',
    created_at: nowIso(),
    created_by: actor.id,
  }, actor);

  await notifyRole('Complaint Pending Approval', `${record.complaint_number} awaiting ${steps[0].stepName}`, complaintId, [steps[0].approverRole, 'qa_manager']);
  if (record.complaint_criticality === 'Critical') {
    await notifyRole('Critical Complaint Submitted', record.complaint_number, complaintId, ['head_qa']);
  }
  return {};
}

export async function fetchComplaintApprovalPageData(complaintId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const record = await getComplaintById(complaintId);
    if (!record) return { error: 'Complaint not found.' };
    const [approvals, history, auditLogs] = await Promise.all([
      getComplaintApprovals(complaintId),
      getComplaintApprovalHistory(complaintId),
      getAuditLogsForComplaint(complaintId),
    ]);
    const checks = await gatherChecks(record);
    const current = getCurrentPendingComplaintApproval(approvals);
    const closureCheck = canCloseComplaintWithCapa(record, await getActiveComplaintCapaLink(complaintId), record.linked_capa_id ? await getCapaById(record.linked_capa_id) : null, checks.impact);
    return {
      record,
      approvals,
      history,
      auditLogs,
      current,
      workflowSteps: buildComplaintWorkflowSteps(record, checks.impact),
      ...checks,
      canClose: closureCheck.canClose,
      closeBlockReason: closureCheck.reason,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load approval data' };
  }
}

async function completeStepAndAdvance(
  approval: ComplaintApproval,
  record: ComplaintRecord,
  action: 'approve' | 'reject' | 'send_back',
  payload: { comments?: string; rejection_reason?: string; send_back_reason?: string; e_signature?: string },
  actor: ComplaintApprovalActor,
): Promise<{ error?: string }> {
  const ts = nowIso();
  const stepName = approval.current_workflow_step || '';
  const checks = await gatherChecks(record);

  if (action === 'approve') {
    const validation = validateComplaintApprovalAction(record, stepName, checks);
    if (!validation.ok) return { error: validation.error };
  }

  const statusMap = { approve: 'Approved', reject: 'Rejected', send_back: 'Sent Back' } as const;
  const decisionMap = { approve: 'approved', reject: 'rejected', send_back: 'sent_back' } as const;

  await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals, approval.id), {
    approval_status: statusMap[action],
    decision: decisionMap[action],
    approver_id: actor.id,
    approver_name: actor.name,
    approver_role: actor.role || 'qa',
    current_approver: actor.id,
    current_approver_name: actor.name,
    comments: payload.comments || '',
    rejection_reason: payload.rejection_reason || '',
    send_back_reason: payload.send_back_reason || '',
    e_signature: payload.e_signature || '',
    e_signature_status: payload.e_signature ? 'Signed' : 'Not Signed',
    signed_at: ts,
    completed_date: today(),
    updated_at: ts,
  });

  const actionLabel = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Send Back';
  await audit(actor, actionLabel, record.id, payload.comments || payload.rejection_reason || payload.send_back_reason);
  await saveHistory({
    complaint_id: record.id,
    complaint_number: record.complaint_number,
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

  if (payload.e_signature) {
    try {
      await addDoc(collection(getFirebaseFirestore(), 'esign_records'), {
        module: COMPLAINT_APPROVAL_MODULE,
        record_id: record.id,
        complaint_number: record.complaint_number,
        action: actionLabel,
        step: stepName,
        signed_by: actor.id,
        signed_by_name: actor.name,
        signature: payload.e_signature,
        signed_at: ts,
      });
    } catch (e) {
      console.error('esign record', e);
    }
  }

  let newStatus = mapComplaintStatusForStep(stepName, action === 'approve' ? 'approve' : action);

  if (action === 'approve') {
    const allApprovals = await getComplaintApprovals(record.id);
    const next = allApprovals
      .filter((a) => !a.is_deleted && a.approval_status === 'Waiting')
      .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0];

    if (next) {
      await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals, next.id), {
        approval_status: 'Pending',
        decision: 'pending',
        updated_at: ts,
      });
      newStatus = mapComplaintStatusForStep(next.current_workflow_step || '', 'approve');
      await notifyRole('Complaint Pending Approval', `${record.complaint_number} — ${next.current_workflow_step}`, record.id, [next.current_role || 'qa_manager']);
    } else if (stepName === 'Closed') {
      newStatus = 'closed';
      await audit(actor, 'Final Approval — Complaint Closed', record.id);
      await notifyRole('Complaint Closed', record.complaint_number, record.id, ['qa_manager', 'head_qa']);
    }
  } else if (action === 'reject') {
    await notifyRole('Complaint Rejected', `${record.complaint_number}: ${payload.rejection_reason}`, record.id, ['qa_manager', record.created_by]);
  } else if (action === 'send_back') {
    await notifyRole('Complaint Sent Back', `${record.complaint_number}: ${payload.send_back_reason}`, record.id, ['qa_manager', record.created_by]);
  }

  const patch: Partial<ComplaintRecord> = {
    status: newStatus,
    qa_remarks: payload.comments || record.qa_remarks,
  };
  if (newStatus === 'closed') {
    patch.closure_date = today();
  }

  await updateComplaint(record.id, patch, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
  return {};
}

export async function approveComplaintStep(
  complaintId: string,
  approvalId: string,
  comments: string,
  eSignature: string,
  actor: ComplaintApprovalActor,
): Promise<{ error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };
  const approvals = await getComplaintApprovals(complaintId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  if (!['Pending', 'Escalated'].includes(approval.approval_status || '')) return { error: 'This approval step is not pending.' };
  if (approval.e_signature_required && !eSignature.trim()) return { error: 'E-signature required' };
  return completeStepAndAdvance(approval, record, 'approve', { comments, e_signature: eSignature }, actor);
}

export async function rejectComplaintStep(
  complaintId: string,
  approvalId: string,
  rejectionReason: string,
  comments: string,
  actor: ComplaintApprovalActor,
): Promise<{ error?: string }> {
  if (!rejectionReason.trim()) return { error: 'Reject reason is mandatory' };
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };
  const approvals = await getComplaintApprovals(complaintId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  return completeStepAndAdvance(approval, record, 'reject', { rejection_reason: rejectionReason, comments }, actor);
}

export async function sendBackComplaintStep(
  complaintId: string,
  approvalId: string,
  sendBackReason: string,
  comments: string,
  actor: ComplaintApprovalActor,
): Promise<{ error?: string }> {
  if (!sendBackReason.trim()) return { error: 'Send back reason is mandatory' };
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };
  const approvals = await getComplaintApprovals(complaintId);
  const approval = approvals.find((a) => a.id === approvalId || a.approval_id === approvalId);
  if (!approval) return { error: 'Approval step not found' };
  return completeStepAndAdvance(approval, record, 'send_back', { send_back_reason: sendBackReason, comments }, actor);
}

export async function escalateOverdueComplaintApprovals(actor: ComplaintApprovalActor): Promise<number> {
  const all = await fetchAllComplaintApprovalRecords();
  const todayStr = today();
  let count = 0;
  for (const a of all) {
    if (!['Pending', 'Escalated'].includes(a.approval_status || '')) continue;
    if (!a.due_date || a.due_date >= todayStr) continue;
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.approvals, a.id), {
      approval_status: 'Escalated',
      escalation_status: 'Escalated',
      updated_at: nowIso(),
    });
    await audit(actor, 'Escalate', a.complaint_id, `Overdue: ${a.current_workflow_step}`);
    await notifyRole('Overdue Complaint Approval', `${a.complaint_number} — ${a.current_workflow_step}`, a.complaint_id, ['admin', 'head_qa', 'qa_manager']);
    if (a.complaint_number) {
      await saveHistory({
        complaint_id: a.complaint_id,
        complaint_number: a.complaint_number,
        approval_id: a.approval_id || a.id,
        action: 'Escalate',
        workflow_step: a.current_workflow_step || '',
        user_id: actor.id,
        user_name: actor.name,
        user_role: actor.role || 'admin',
        comments: 'Auto-escalated due to overdue approval',
        created_at: nowIso(),
        created_by: actor.id,
      }, actor);
    }
    count += 1;
  }
  return count;
}

export async function logComplaintEsignResult(
  complaintId: string,
  success: boolean,
  actor: ComplaintApprovalActor,
  detail?: string,
) {
  await audit(actor, success ? 'E-Sign Success' : 'E-Sign Failure', complaintId, detail);
}

export async function fetchComplaintApprovalDashboardData(actor: ComplaintApprovalActor, role?: string) {
  const [approvals, history, complaints] = await Promise.all([
    fetchAllComplaintApprovalRecords(),
    getComplaintApprovalHistory(),
    listComplaints(),
  ]);
  const { computeComplaintApprovalDashboardCounts } = await import('./complaint-approval-records');
  return {
    approvals,
    history,
    complaints,
    counts: computeComplaintApprovalDashboardCounts(approvals, history, complaints, actor.id, role),
  };
}

export {
  buildComplaintWorkflowSteps,
  computeComplaintApprovalDashboardCounts,
  getCurrentPendingComplaintApproval,
  mapAuditToComplaintApprovalTimeline,
} from '@/lib/complaint-approval-records';

export { getAuditLogsForComplaint };
