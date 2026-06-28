import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type DocumentData, type QueryConstraint,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  TRAINING_APPROVAL_COLLECTIONS, TRAINING_APPROVAL_MODULE,
  type ApprovalRequest, type ApprovalStep, type ApprovalWorkflowTemplate,
  type ApprovalHistoryEntry, type ApprovalDashboardData, type ApprovalDashboardKpis,
  type ApprovalDashboardCharts, type TrainingApprovalActor, type ApprovalFilters,
  generateWorkflowNumber, generateRequestNumber,
  buildDefaultSteps, roleMatchesApprover,
} from './training-approval-types';
import type { CreateApprovalRequestInput, ApprovalActionInput } from './training-approval-schemas';

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function db() { return getFirebaseFirestore(); }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function audit(actor: TrainingApprovalActor, action: string, recordId: string, detail: unknown) {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: TRAINING_APPROVAL_MODULE, recordId, action,
    oldValue: '', newValue: detail ? JSON.stringify(detail) : '', reason: '',
    ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
  try {
    await addDoc(collection(db(), TRAINING_APPROVAL_COLLECTIONS.auditTrail), {
      moduleName: TRAINING_APPROVAL_MODULE, action, documentId: recordId,
      userId: actor.id, userName: actor.name, timestamp: now(),
      collectionName: TRAINING_APPROVAL_COLLECTIONS.requests,
    });
  } catch { /* optional */ }
}

async function saveHistory(entry: Omit<ApprovalHistoryEntry, 'id'>, actor: TrainingApprovalActor) {
  await addDoc(collection(db(), `${TRAINING_APPROVAL_COLLECTIONS.requests}_history`), {
    ...entry, created_by: actor.id,
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  for (const role of roles) {
    try {
      await addDoc(collection(db(), TRAINING_APPROVAL_COLLECTIONS.notifications), {
        title, message, module: TRAINING_APPROVAL_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
}

function mapRequest(id: string, data: Record<string, unknown>): ApprovalRequest {
  return {
    id,
    workflow_id: String(data.workflow_id ?? ''),
    workflow_number: String(data.workflow_number ?? ''),
    workflow_name: String(data.workflow_name ?? ''),
    workflow_type: String(data.workflow_type ?? ''),
    reference_id: String(data.reference_id ?? ''),
    reference_number: String(data.reference_number ?? ''),
    current_status: String(data.current_status ?? 'Draft'),
    priority: String(data.priority ?? 'Normal'),
    initiated_by: String(data.initiated_by ?? ''),
    initiated_by_name: String(data.initiated_by_name ?? ''),
    assigned_approver: String(data.assigned_approver ?? ''),
    assigned_approver_name: String(data.assigned_approver_name ?? ''),
    approval_level: Number(data.approval_level ?? 1),
    current_step: Number(data.current_step ?? 1),
    total_steps: Number(data.total_steps ?? 1),
    due_date: String(data.due_date ?? ''),
    completed_date: data.completed_date ? String(data.completed_date) : null,
    electronic_signature_required: Boolean(data.electronic_signature_required),
    approval_decision: String(data.approval_decision ?? 'pending'),
    approval_comments: String(data.approval_comments ?? ''),
    rejection_reason: String(data.rejection_reason ?? ''),
    department: String(data.department ?? ''),
    module: String(data.module ?? 'Training'),
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
    created_by: String(data.created_by ?? ''),
    created_by_name: String(data.created_by_name ?? ''),
    updated_by: String(data.updated_by ?? ''),
    updated_by_name: String(data.updated_by_name ?? ''),
  };
}

export async function seedTrainingWorkflowTemplates(): Promise<void> {
  const snap = await getDocs(query(
    collection(db(), TRAINING_APPROVAL_COLLECTIONS.workflows),
    where('module', '==', 'Training'),
    limit(1),
  ));
  if (!snap.empty) return;

  const ts = now();
  const types = [
    'Training Assignment Approval',
    'Training Completion Review',
    'Training Effectiveness Approval',
    'Certificate Approval',
    'Retraining Approval',
  ];
  for (const type of types) {
    const steps = buildDefaultSteps(type);
    await addDoc(collection(db(), TRAINING_APPROVAL_COLLECTIONS.workflows), {
      workflow_id: generateWorkflowNumber(),
      workflow_number: generateWorkflowNumber(),
      workflow_name: type,
      workflow_type: type,
      module: 'Training',
      total_steps: steps.length,
      steps_config: steps,
      electronic_signature_required: steps.some((s) => s.e_signature_required),
      status: 'Active',
      created_at: ts,
      updated_at: ts,
    });
  }
}

export async function listApprovalRequests(filters?: ApprovalFilters, max = 200): Promise<ApprovalRequest[]> {
  const constraints: QueryConstraint[] = [
    where('module', '==', 'Training'),
    orderBy('created_at', 'desc'),
    limit(max),
  ];
  if (filters?.status) constraints.unshift(where('current_status', '==', filters.status));
  if (filters?.workflowType) constraints.unshift(where('workflow_type', '==', filters.workflowType));

  let requests: ApprovalRequest[];
  try {
    const snap = await getDocs(query(collection(db(), TRAINING_APPROVAL_COLLECTIONS.requests), ...constraints));
    requests = snap.docs.map((d) => mapRequest(d.id, d.data()));
  } catch {
    const snap = await getDocs(query(
      collection(db(), TRAINING_APPROVAL_COLLECTIONS.requests),
      where('module', '==', 'Training'),
      limit(max),
    ));
    requests = snap.docs.map((d) => mapRequest(d.id, d.data()));
  }

  if (filters?.department) requests = requests.filter((r) => r.department === filters.department);
  if (filters?.priority) requests = requests.filter((r) => r.priority === filters.priority);
  if (filters?.dateFrom) requests = requests.filter((r) => r.created_at >= filters.dateFrom!);
  if (filters?.dateTo) requests = requests.filter((r) => r.created_at.slice(0, 10) <= filters.dateTo!);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    requests = requests.filter((r) =>
      r.workflow_number.toLowerCase().includes(q)
      || r.reference_number.toLowerCase().includes(q)
      || r.workflow_type.toLowerCase().includes(q));
  }
  return requests;
}

export async function getApprovalSteps(requestId: string): Promise<ApprovalStep[]> {
  try {
    const snap = await getDocs(query(
      collection(db(), TRAINING_APPROVAL_COLLECTIONS.steps),
      where('request_id', '==', requestId),
      orderBy('step_number', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalStep));
  } catch {
    const snap = await getDocs(query(
      collection(db(), TRAINING_APPROVAL_COLLECTIONS.steps),
      where('request_id', '==', requestId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalStep))
      .sort((a, b) => a.step_number - b.step_number);
  }
}

export async function createApprovalRequest(
  input: CreateApprovalRequestInput,
  actor: TrainingApprovalActor,
): Promise<ApprovalRequest> {
  await seedTrainingWorkflowTemplates();
  const stepsConfig = buildDefaultSteps(input.workflow_type);
  const ts = now();
  const workflowNumber = generateRequestNumber();
  const dueDate = addDays(today(), stepsConfig[0]?.due_days ?? 3);

  const requestPayload = {
    workflow_id: '',
    workflow_number: workflowNumber,
    workflow_name: input.workflow_type,
    workflow_type: input.workflow_type,
    reference_id: input.reference_id,
    reference_number: input.reference_number,
    current_status: 'Pending Approval',
    priority: input.priority,
    initiated_by: actor.id,
    initiated_by_name: actor.name,
    assigned_approver: input.assigned_approver ?? '',
    assigned_approver_name: '',
    approval_level: 1,
    current_step: 1,
    total_steps: stepsConfig.length,
    due_date: dueDate,
    completed_date: null,
    electronic_signature_required: stepsConfig.some((s) => s.e_signature_required),
    approval_decision: 'pending',
    approval_comments: input.approval_comments,
    rejection_reason: '',
    department: input.department,
    module: 'Training',
    created_at: ts,
    updated_at: ts,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  const ref = await addDoc(collection(db(), TRAINING_APPROVAL_COLLECTIONS.requests), requestPayload);

  for (let i = 0; i < stepsConfig.length; i++) {
    const step = stepsConfig[i];
    await addDoc(collection(db(), TRAINING_APPROVAL_COLLECTIONS.steps), {
      request_id: ref.id,
      step_number: step.step_number,
      step_name: step.step_name,
      approver_role: step.approver_role,
      approver_id: '',
      approver_name: '',
      status: i === 0 ? 'Pending' : 'Waiting',
      due_date: addDays(today(), step.due_days),
      completed_date: null,
      e_signature_required: step.e_signature_required,
      e_signature_id: null,
      comments: '',
      rejection_reason: '',
      delegated_to: null,
      created_at: ts,
      updated_at: ts,
    });
  }

  await audit(actor, 'workflow submitted', ref.id, requestPayload);
  await saveHistory({
    request_id: ref.id, workflow_number: workflowNumber, action: 'submitted',
    step_name: stepsConfig[0].step_name, user_id: actor.id, user_name: actor.name,
    user_role: actor.role, comments: input.approval_comments, created_at: ts,
  }, actor);
  await notify('Approval Request Submitted', `${input.workflow_type} — ${input.reference_number}`, ref.id, [stepsConfig[0].approver_role]);

  return mapRequest(ref.id, requestPayload);
}

export async function processApprovalAction(
  input: ApprovalActionInput,
  actor: TrainingApprovalActor,
): Promise<void> {
  const reqSnap = await getDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.requests, input.request_id));
  if (!reqSnap.exists()) throw new Error('Approval request not found');
  const request = mapRequest(reqSnap.id, reqSnap.data());

  if (['Approved', 'Rejected', 'Closed', 'Cancelled'].includes(request.current_status)) {
    throw new Error('Request is already finalized');
  }

  const steps = await getApprovalSteps(input.request_id);
  const currentStep = steps.find((s) => s.status === 'Pending');
  if (!currentStep && input.action !== 'Cancel') throw new Error('No pending approval step');

  const ts = now();

  if (input.action === 'Approve' && currentStep) {
    if (!roleMatchesApprover(actor.role, currentStep.approver_role)) {
      throw new Error('You are not authorized to approve this step');
    }
    if (currentStep.e_signature_required && !input.e_signature_id) {
      throw new Error('Electronic signature required for this approval step');
    }

    await updateDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.steps, currentStep.id), {
      status: 'Approved', approver_id: actor.id, approver_name: actor.name,
      completed_date: ts, comments: input.comments,
      e_signature_id: input.e_signature_id ?? null, updated_at: ts,
    } as DocumentData);

    const nextStep = steps.find((s) => s.step_number === currentStep.step_number + 1);
    if (nextStep) {
      await updateDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.steps, nextStep.id), {
        status: 'Pending', updated_at: ts,
      });
      await updateDoc(reqSnap.ref, {
        current_step: nextStep.step_number,
        current_status: 'Under Review',
        assigned_approver: nextStep.approver_role,
        due_date: nextStep.due_date,
        updated_at: ts, updated_by: actor.id, updated_by_name: actor.name,
      });
      await notify('Approval Required', `${request.workflow_type} awaiting ${nextStep.step_name}`, input.request_id, [nextStep.approver_role]);
    } else {
      await updateDoc(reqSnap.ref, {
        current_status: 'Approved',
        approval_decision: 'approved',
        completed_date: ts,
        updated_at: ts, updated_by: actor.id, updated_by_name: actor.name,
      });
      await applyFinalApproval(request, actor);
      await notify('Request Approved', `${request.reference_number} has been approved`, input.request_id, ['training_coordinator']);
    }
    await audit(actor, 'approved', input.request_id, { step: currentStep.step_name, comments: input.comments });
  }

  if (input.action === 'Reject' && currentStep) {
    await updateDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.steps, currentStep.id), {
      status: 'Rejected', approver_id: actor.id, approver_name: actor.name,
      completed_date: ts, rejection_reason: input.rejection_reason ?? input.comments, updated_at: ts,
    } as DocumentData);
    await updateDoc(reqSnap.ref, {
      current_status: 'Rejected', approval_decision: 'rejected',
      rejection_reason: input.rejection_reason ?? input.comments,
      completed_date: ts, updated_at: ts, updated_by: actor.id, updated_by_name: actor.name,
    });
    await notify('Request Rejected', `${request.reference_number} was rejected`, input.request_id, ['training_coordinator']);
    await audit(actor, 'rejected', input.request_id, { reason: input.rejection_reason });
  }

  if (input.action === 'Return for Revision' && currentStep) {
    await updateDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.steps, currentStep.id), {
      status: 'Returned', comments: input.comments, updated_at: ts,
    } as DocumentData);
    await updateDoc(reqSnap.ref, {
      current_status: 'Returned for Revision', updated_at: ts,
      updated_by: actor.id, updated_by_name: actor.name,
    });
    await audit(actor, 'returned', input.request_id, { comments: input.comments });
  }

  if (input.action === 'Escalate' && currentStep) {
    await updateDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.steps, currentStep.id), {
      status: 'Escalated', updated_at: ts,
    } as DocumentData);
    await updateDoc(reqSnap.ref, { current_status: 'Under Review', priority: 'High', updated_at: ts });
    await notify('Approval Escalated', `${request.reference_number} escalated`, input.request_id, ['head_qa', 'qa_manager']);
    await audit(actor, 'escalated', input.request_id, null);
  }

  if (input.action === 'Cancel') {
    await updateDoc(reqSnap.ref, {
      current_status: 'Cancelled', completed_date: ts,
      updated_at: ts, updated_by: actor.id, updated_by_name: actor.name,
    });
    await audit(actor, 'cancelled', input.request_id, null);
  }

  await saveHistory({
    request_id: input.request_id, workflow_number: request.workflow_number,
    action: input.action, step_name: currentStep?.step_name ?? '',
    user_id: actor.id, user_name: actor.name, user_role: actor.role,
    comments: input.comments, created_at: ts,
  }, actor);
}

async function applyFinalApproval(request: ApprovalRequest, actor: TrainingApprovalActor): Promise<void> {
  try {
    if (request.workflow_type.includes('Completion') || request.workflow_type.includes('Assignment')) {
      await updateDoc(doc(db(), TRAINING_APPROVAL_COLLECTIONS.assignments, request.reference_id), {
        status: 'completed', training_status: 'Completed', updated_at: now(),
      });
    }
    if (request.workflow_type.includes('Certificate')) {
      await addDoc(collection(db(), TRAINING_APPROVAL_COLLECTIONS.certificates), {
        reference_id: request.reference_id,
        certificate_number: `CERT-${request.reference_number}`,
        issued_date: now(),
        approved_by: actor.name,
        status: 'Active',
        created_at: now(),
      });
      await audit(actor, 'certificate issued', request.reference_id, { request_id: request.id });
    }
  } catch { /* reference may not exist yet */ }
}

export async function escalateOverdueApprovals(actor: TrainingApprovalActor): Promise<number> {
  const requests = await listApprovalRequests();
  const todayStr = today();
  let count = 0;
  for (const r of requests) {
    if (r.due_date && r.due_date < todayStr && ['Pending Approval', 'Under Review'].includes(r.current_status)) {
      try {
        await processApprovalAction({ request_id: r.id, action: 'Escalate', comments: 'Auto-escalated due to overdue SLA' }, actor);
        count++;
      } catch { /* skip */ }
    }
  }
  return count;
}

function computeKpis(requests: ApprovalRequest[], steps: ApprovalStep[]): ApprovalDashboardKpis {
  const todayStr = today();
  const pending = requests.filter((r) => ['Pending Approval', 'Under Review'].includes(r.current_status));
  const approvedToday = requests.filter((r) => r.current_status === 'Approved' && r.completed_date?.startsWith(todayStr));
  const rejectedToday = requests.filter((r) => r.current_status === 'Rejected' && r.completed_date?.startsWith(todayStr));
  const overdue = pending.filter((r) => r.due_date && r.due_date < todayStr);
  const escalated = requests.filter((r) => r.priority === 'Critical' || steps.some((s) => s.request_id === r.id && s.status === 'Escalated'));
  const completed = requests.filter((r) => r.completed_date && r.created_at);
  const avgHours = completed.length
    ? Math.round(completed.reduce((s, r) => {
      const start = new Date(r.created_at).getTime();
      const end = new Date(r.completed_date!).getTime();
      return s + (end - start) / 3600000;
    }, 0) / completed.length)
    : 0;
  const slaMet = completed.filter((r) => !r.due_date || (r.completed_date && r.completed_date <= r.due_date)).length;
  const slaPercent = completed.length ? Math.round((slaMet / completed.length) * 100) : 100;
  const esignCount = steps.filter((s) => s.e_signature_id).length;

  return {
    pendingApprovals: pending.length,
    approvedToday: approvedToday.length,
    rejectedToday: rejectedToday.length,
    overdueApprovals: overdue.length,
    averageApprovalTimeHours: avgHours,
    slaCompliancePercent: slaPercent,
    electronicSignaturesCompleted: esignCount,
    escalatedRequests: escalated.length,
  };
}

function computeCharts(requests: ApprovalRequest[]): ApprovalDashboardCharts {
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(d.toISOString().slice(0, 10));
  }

  const statusMap = new Map<string, number>();
  requests.forEach((r) => statusMap.set(r.current_status, (statusMap.get(r.current_status) ?? 0) + 1));
  const typeMap = new Map<string, number>();
  requests.forEach((r) => typeMap.set(r.workflow_type, (typeMap.get(r.workflow_type) ?? 0) + 1));
  const deptMap = new Map<string, number>();
  requests.forEach((r) => deptMap.set(r.department, (deptMap.get(r.department) ?? 0) + 1));

  return {
    statusDistribution: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
    approvalTrend: last7.map((date) => ({
      date: date.slice(5),
      approved: requests.filter((r) => r.completed_date?.startsWith(date) && r.current_status === 'Approved').length,
      rejected: requests.filter((r) => r.completed_date?.startsWith(date) && r.current_status === 'Rejected').length,
    })),
    avgApprovalTime: Array.from(typeMap.entries()).slice(0, 5).map(([type]) => ({
      type: type.slice(0, 20), hours: 24,
    })),
    departmentApprovals: Array.from(deptMap.entries()).map(([name, value]) => ({ name, value })),
    workflowTypeDistribution: Array.from(typeMap.entries()).map(([name, value]) => ({ name: name.slice(0, 25), value })),
    slaComplianceTrend: last7.map((date) => ({ date: date.slice(5), percent: 90 })),
  };
}

export async function fetchApprovalDashboard(filters?: ApprovalFilters): Promise<ApprovalDashboardData> {
  await seedTrainingWorkflowTemplates();
  const [requests, workflowSnap] = await Promise.all([
    listApprovalRequests(filters),
    getDocs(query(collection(db(), TRAINING_APPROVAL_COLLECTIONS.workflows), where('module', '==', 'Training'))),
  ]);

  const allSteps: ApprovalStep[] = [];
  for (const r of requests.slice(0, 50)) {
    allSteps.push(...await getApprovalSteps(r.id));
  }

  let history: ApprovalHistoryEntry[] = [];
  try {
    const histSnap = await getDocs(query(
      collection(db(), `${TRAINING_APPROVAL_COLLECTIONS.requests}_history`),
      orderBy('created_at', 'desc'),
      limit(100),
    ));
    history = histSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalHistoryEntry));
  } catch { /* optional */ }

  const todayStr = today();
  const pending = requests.filter((r) => ['Pending Approval', 'Under Review'].includes(r.current_status));
  const overdue = pending.filter((r) => r.due_date && r.due_date < todayStr);

  return {
    kpis: computeKpis(requests, allSteps),
    charts: computeCharts(requests),
    requests,
    steps: allSteps,
    pendingApprovals: pending,
    recentDecisions: requests.filter((r) => ['Approved', 'Rejected', 'Closed'].includes(r.current_status)).slice(0, 20),
    overdueApprovals: overdue,
    escalatedRequests: requests.filter((r) => r.priority === 'Critical'),
    history,
    workflows: workflowSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalWorkflowTemplate)),
  };
}

export function exportApprovalRequestsCsv(requests: ApprovalRequest[]): void {
  const headers = ['Workflow #', 'Type', 'Reference', 'Status', 'Priority', 'Department', 'Initiated By', 'Due Date', 'Decision'];
  const rows = requests.map((r) => [
    r.workflow_number, r.workflow_type, r.reference_number, r.current_status,
    r.priority, r.department, r.initiated_by_name, r.due_date, r.approval_decision,
  ]);
  downloadCsv('training-approval-requests.csv', headers, rows);
}

export async function bulkApprove(requestIds: string[], actor: TrainingApprovalActor, eSignatureId?: string): Promise<number> {
  let count = 0;
  for (const id of requestIds) {
    try {
      await processApprovalAction({ request_id: id, action: 'Approve', comments: 'Bulk approved', e_signature_id: eSignatureId }, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}

export async function bulkReject(requestIds: string[], actor: TrainingApprovalActor, reason: string): Promise<number> {
  let count = 0;
  for (const id of requestIds) {
    try {
      await processApprovalAction({ request_id: id, action: 'Reject', comments: reason, rejection_reason: reason }, actor);
      count++;
    } catch { /* skip */ }
  }
  return count;
}
