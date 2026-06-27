import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { normalizeRole } from '@/lib/permissions';
import {
  allMandatoryTasksComplete,
  buildImplementationPlanId,
  buildTaskId,
  canApproveCcImplementation,
  canStartImplementation,
  CC_IMPLEMENTATION_MODULE,
  computeCcImplementationChartData,
  computeCcImplementationDashboardMetrics,
  computeImplementationProgress,
  deriveImplementationStatus,
  detectCircularDependency,
  getMandatoryTaskTemplates,
  isTaskOverdue,
  refreshTaskOverdueStatus,
  requiresHeadQaImplementationReview,
  type CcImplementationActor,
  type CcImplementationPlanInput,
  type CcImplementationQaReviewInput,
  type CcImplementationTaskInput,
  validateTaskDependency,
} from '@/lib/cc-implementation-records';
import {
  CC_COLLECTIONS,
  type CcImplementationChartData,
  type CcImplementationDashboardMetrics,
  type CcImplementationPlan,
  type CcImplementationTask,
  type ChangeControlRecord,
} from '@/lib/change-control-types';
import {
  getAuditLogsForChange,
  getChangeById,
  listChanges,
  updateChange,
} from '@/lib/change-control-service';

export type { CcImplementationActor, CcImplementationPlanInput, CcImplementationTaskInput, CcImplementationQaReviewInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(
  actor: CcImplementationActor,
  actionType: string,
  changeId: string,
  detail?: string,
  recordId?: string,
) {
  try {
    await createAuditLog({
      moduleName: CC_IMPLEMENTATION_MODULE,
      collectionName: CC_COLLECTIONS.implementationPlans,
      recordId: recordId || changeId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('cc implementation audit', e);
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
      title, message, module: CC_IMPLEMENTATION_MODULE, record_id: changeId,
      ...(opts?.userId ? { user_id: opts.userId } : {}),
      ...(opts?.targetRole ? { target_role: opts.targetRole } : {}),
      read: false, created_at: nowIso(),
    });
  } catch (e) {
    console.error('cc implementation notify', e);
  }
}

function normalizePlan(docId: string, data: Record<string, unknown>): CcImplementationPlan {
  const p = { id: docId, ...data } as CcImplementationPlan;
  return { ...p, implementation_progress: p.implementation_progress ?? 0, is_deleted: p.is_deleted ?? false };
}

function normalizeTask(docId: string, data: Record<string, unknown>): CcImplementationTask {
  const t = { id: docId, ...data } as CcImplementationTask;
  return {
    ...t,
    completion_percentage: t.completion_percentage ?? 0,
    task_status: t.task_status || 'Not Started',
    is_deleted: t.is_deleted ?? false,
  };
}

async function recalcPlanProgress(planId: string, changeId: string, actor: CcImplementationActor) {
  const tasks = await getCcImplementationTasks(changeId);
  const progress = computeImplementationProgress(tasks);
  const plan = await getCcImplementationPlan(changeId);
  if (!plan) return;
  const status = deriveImplementationStatus({ ...plan, implementation_progress: progress }, tasks);
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans, planId), {
    implementation_progress: progress,
    implementation_status: status,
    updated_at: nowIso(),
    updated_by: actor.id,
  });
  if (progress === 100 && status === 'Pending Verification') {
    await audit(actor, 'implementation completed', changeId, `All tasks completed (${progress}%)`, planId);
    if (plan.implementation_owner) {
      await notify('Implementation Tasks Complete', 'All tasks completed — pending QA verification.', changeId, { userId: plan.implementation_owner });
    }
    await notify('Implementation Pending QA', 'All implementation tasks completed — QA verification required.', changeId, { targetRole: 'qa' });
  }
}

async function ensureMandatoryTasks(
  planId: string,
  input: CcImplementationPlanInput,
  actor: CcImplementationActor,
) {
  const mandatory = getMandatoryTaskTemplates(input);
  const existingTasks = await getCcImplementationTasks(input.change_id);
  for (let i = 0; i < mandatory.length; i += 1) {
    const tmpl = mandatory[i];
    const exists = existingTasks.some((t) => t.task_category === tmpl.task_category && t.is_mandatory);
    if (!exists) {
      await createCcImplementationTask({ ...tmpl, plan_id: planId }, actor, existingTasks.length + i + 1);
    }
  }
}

export async function getCcImplementationPlan(changeId: string): Promise<CcImplementationPlan | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans),
      where('change_id', '==', changeId),
      orderBy('updated_at', 'desc'),
      limit(1),
    ));
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() as Record<string, unknown>;
    if (data.is_deleted) return null;
    return normalizePlan(d.id, data);
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans),
      where('change_id', '==', changeId),
      limit(1),
    ));
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() as Record<string, unknown>;
    if (data.is_deleted) return null;
    return normalizePlan(d.id, data);
  }
}

export async function getCcImplementationTasks(changeId: string): Promise<CcImplementationTask[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks),
      where('change_id', '==', changeId),
      orderBy('created_at', 'asc'),
    ));
    return refreshTaskOverdueStatus(
      snap.docs.map((d) => normalizeTask(d.id, d.data() as Record<string, unknown>)).filter((t) => !t.is_deleted),
    );
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks),
      where('change_id', '==', changeId),
    ));
    return refreshTaskOverdueStatus(
      snap.docs.map((d) => normalizeTask(d.id, d.data() as Record<string, unknown>))
        .filter((t) => !t.is_deleted)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    );
  }
}

export async function listCcImplementationPlans(max = 300) {
  if (!isFirebaseConfigured()) return { plans: [] as (CcImplementationPlan & { change?: ChangeControlRecord | null; tasks?: CcImplementationTask[] })[], tasks: [] as CcImplementationTask[] };
  const [planSnap, taskSnap, changes] = await Promise.all([
    getDocs(query(collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans), orderBy('updated_at', 'desc'), limit(max))),
    getDocs(query(collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks), limit(2000))),
    listChanges(),
  ]);
  const changeById = new Map(changes.map((c) => [c.id, c]));
  const allTasks = taskSnap.docs.map((d) => normalizeTask(d.id, d.data() as Record<string, unknown>)).filter((t) => !t.is_deleted);
  const plans = planSnap.docs
    .map((d) => normalizePlan(d.id, d.data() as Record<string, unknown>))
    .filter((p) => !p.is_deleted)
    .map((p) => ({
      ...p,
      change: changeById.get(p.change_id) || null,
      tasks: allTasks.filter((t) => t.change_id === p.change_id),
    }));
  return { plans, tasks: allTasks };
}

export async function fetchCcImplementationPageData(changeId: string) {
  try {
    const [change, plan, tasks, auditLogs] = await Promise.all([
      getChangeById(changeId),
      getCcImplementationPlan(changeId),
      getCcImplementationTasks(changeId),
      getAuditLogsForChange(changeId),
    ]);
    if (!change) return { error: 'Change control not found' };
    const metrics = computeCcImplementationDashboardMetrics(tasks);
    return { change, plan, tasks, auditLogs, metrics, canStart: canStartImplementation(change) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load implementation plan' };
  }
}

export async function fetchCcImplementationListData() {
  try {
    const { plans, tasks } = await listCcImplementationPlans();
    const changes = await listChanges();
    const metrics = computeCcImplementationDashboardMetrics(tasks);
    const charts = computeCcImplementationChartData(tasks);
    return { plans, tasks, changes, metrics, charts };
  } catch (e) {
    return {
      plans: [] as (CcImplementationPlan & { change?: ChangeControlRecord | null })[],
      tasks: [] as CcImplementationTask[],
      changes: [] as ChangeControlRecord[],
      metrics: computeCcImplementationDashboardMetrics([]),
      charts: computeCcImplementationChartData([]),
      error: e instanceof Error ? e.message : 'Failed to load list',
    };
  }
}

export async function saveCcImplementationPlan(
  input: CcImplementationPlanInput,
  actor: CcImplementationActor,
): Promise<{ plan?: CcImplementationPlan; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const change = await getChangeById(input.change_id);
  if (!change) return { error: 'Change control not found' };
  if (!canStartImplementation(change)) {
    return { error: 'Change control must be approved before creating an implementation plan.' };
  }

  const existing = await getCcImplementationPlan(input.change_id);
  const timestamp = nowIso();
  const payload: Partial<CcImplementationPlan> = {
    change_id: change.id,
    change_control_number: change.change_control_number,
    implementation_plan_id: existing?.implementation_plan_id || buildImplementationPlanId(change.change_control_number),
    implementation_title: input.implementation_title,
    implementation_description: input.implementation_description,
    implementation_owner: input.implementation_owner,
    implementation_owner_name: input.implementation_owner_name || actor.name,
    department: input.department,
    planned_start_date: input.planned_start_date,
    planned_end_date: input.planned_end_date,
    validation_required: input.validation_required,
    training_required: input.training_required,
    document_revision_required: input.document_revision_required,
    capa_required: input.capa_required,
    overall_remarks: input.overall_remarks,
    implementation_status: existing?.implementation_status || 'Draft',
    implementation_progress: existing?.implementation_progress ?? 0,
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
    created_by: existing?.created_by || actor.id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    is_deleted: false,
  };

  let refId = existing?.id;
  if (existing) {
    await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans, existing.id), payload);
    await ensureMandatoryTasks(existing.id, input, actor);
  } else {
    const ref = await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans), payload);
    refId = ref.id;
    await audit(actor, 'implementation plan created', change.id, payload.implementation_title, refId);
    await ensureMandatoryTasks(ref.id, input, actor);
  }

  return { plan: { id: refId!, ...payload } as CcImplementationPlan };
}

export async function startCcImplementation(
  changeId: string,
  actor: CcImplementationActor,
): Promise<{ plan?: CcImplementationPlan; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const [change, plan] = await Promise.all([getChangeById(changeId), getCcImplementationPlan(changeId)]);
  if (!change) return { error: 'Change control not found' };
  if (!plan) return { error: 'Save implementation plan before starting.' };
  if (!canStartImplementation(change)) {
    return { error: 'Change control must be approved before starting implementation.' };
  }
  if (plan.actual_start_date && !['Draft', 'Approved For Implementation'].includes(plan.implementation_status)) {
    return { plan };
  }

  const updates: Partial<CcImplementationPlan> = {
    implementation_status: 'In Progress',
    actual_start_date: today(),
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans, plan.id), updates);
  await updateChange(change.id, { status: 'implementation_in_progress' }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
  await audit(actor, 'implementation started', change.id, 'Implementation approved to start', plan.id);
  if (plan.implementation_owner) {
    await notify('Implementation Started', `Implementation started for ${change.change_control_number}.`, change.id, { userId: plan.implementation_owner });
  }
  await notify('Implementation Started', `Change ${change.change_control_number} implementation has begun.`, change.id, { targetRole: 'qa' });

  return { plan: { ...plan, ...updates } };
}

export async function createCcImplementationTask(
  input: CcImplementationTaskInput,
  actor: CcImplementationActor,
  seq?: number,
): Promise<{ task?: CcImplementationTask; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const change = await getChangeById(input.change_id);
  if (!change) return { error: 'Change control not found' };

  const existingTasks = await getCcImplementationTasks(input.change_id);
  if (input.dependency_task_id && detectCircularDependency('new', input.dependency_task_id, existingTasks)) {
    return { error: 'Circular dependency detected.' };
  }

  const timestamp = nowIso();
  const taskNumber = buildTaskId(change.change_control_number, seq ?? existingTasks.length + 1);
  const dep = input.dependency_task_id
    ? existingTasks.find((t) => t.id === input.dependency_task_id)
    : null;

  const payload: Omit<CcImplementationTask, 'id'> = {
    task_id: taskNumber,
    task_number: taskNumber,
    change_id: input.change_id,
    plan_id: input.plan_id,
    task_title: input.task_title,
    task_description: input.task_description || '',
    task_category: input.task_category,
    assigned_to: input.assigned_to,
    assigned_to_name: input.assigned_to_name || actor.name,
    department: input.department,
    priority: input.priority,
    dependency_task_id: input.dependency_task_id || null,
    dependency_task_number: dep?.task_number || null,
    planned_start_date: input.planned_start_date,
    planned_end_date: input.planned_end_date,
    actual_start_date: null,
    actual_end_date: null,
    completion_percentage: 0,
    evidence_attached: false,
    task_status: 'Assigned',
    remarks: input.remarks || '',
    is_mandatory: input.is_mandatory ?? false,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    updated_by: actor.id,
    is_deleted: false,
  };

  const ref = await addDoc(collection(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks), payload);
  await audit(actor, 'task created', input.change_id, input.task_title, ref.id);
  await audit(actor, 'task assigned', input.change_id, `Assigned to ${input.assigned_to_name || input.assigned_to}`, ref.id);
  await notify('Task Assigned', `Task "${input.task_title}" assigned for ${change.change_control_number}.`, input.change_id, { userId: input.assigned_to });
  if (input.dependency_task_id) {
    await audit(actor, 'dependency added', input.change_id, `Depends on ${input.dependency_task_id}`, ref.id);
  }
  const plan = await getCcImplementationPlan(input.change_id);
  if (plan?.implementation_owner && plan.implementation_owner !== input.assigned_to) {
    await notify('New Implementation Task', `Task "${input.task_title}" added to plan.`, input.change_id, { userId: plan.implementation_owner });
  }
  if (plan) await recalcPlanProgress(plan.id, input.change_id, actor);

  return { task: { id: ref.id, ...payload } };
}

export async function updateCcImplementationTask(
  taskId: string,
  updates: Partial<CcImplementationTask>,
  actor: CcImplementationActor,
): Promise<{ task?: CcImplementationTask; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase not configured' };
  const ref = doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { error: 'Task not found' };
  const existing = normalizeTask(snap.id, snap.data() as Record<string, unknown>);
  const allTasks = await getCcImplementationTasks(existing.change_id);

  if (updates.dependency_task_id && detectCircularDependency(taskId, updates.dependency_task_id, allTasks)) {
    return { error: 'Circular dependency detected.' };
  }

  const merged = { ...existing, ...updates, updated_at: nowIso(), updated_by: actor.id };
  const { id: _id, ...payload } = merged;
  if (updates.dependency_task_id) {
    await audit(actor, 'dependency added', existing.change_id, `Dependency: ${updates.dependency_task_id}`, taskId);
  }
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, taskId), payload);
  await audit(actor, 'task updated', existing.change_id, merged.task_title, taskId);

  const plan = await getCcImplementationPlan(existing.change_id);
  if (plan) await recalcPlanProgress(plan.id, existing.change_id, actor);

  return { task: merged };
}

export async function completeCcImplementationTask(
  taskId: string,
  actor: CcImplementationActor,
  evidence?: string,
): Promise<{ task?: CcImplementationTask; error?: string }> {
  const ref = doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { error: 'Task not found' };
  const existing = normalizeTask(snap.id, snap.data() as Record<string, unknown>);
  if (existing.is_deleted) return { error: 'Task not found' };

  const allTasks = await getCcImplementationTasks(existing.change_id);
  const depCheck = validateTaskDependency(existing, allTasks);
  if (!depCheck.ok) return { error: depCheck.error };

  const isCritical = existing.priority === 'Critical';
  const taskStatus = isCritical ? 'Pending Review' : 'Completed';
  const completionPct = isCritical ? Math.max(existing.completion_percentage ?? 0, 90) : 100;

  if (isCritical) {
    await notify('Critical Task Pending QA Review', existing.task_title, existing.change_id, { targetRole: 'qa' });
  }

  const updates: Partial<CcImplementationTask> = {
    task_status: taskStatus,
    completion_percentage: completionPct,
    actual_end_date: isCritical ? null : today(),
    actual_start_date: existing.actual_start_date || today(),
    evidence_attached: Boolean(evidence?.trim()),
    evidence_url: evidence || existing.evidence_url,
    updated_at: nowIso(),
    updated_by: actor.id,
  };

  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, taskId), updates);
  if (taskStatus === 'Completed') {
    await audit(actor, 'task completed', existing.change_id, existing.task_title, taskId);
    await notify('Task Completed', `"${existing.task_title}" completed.`, existing.change_id, { userId: existing.assigned_to });
  } else {
    await audit(actor, 'task updated', existing.change_id, 'Submitted for QA review (critical task)', taskId);
  }

  const plan = await getCcImplementationPlan(existing.change_id);
  if (plan) await recalcPlanProgress(plan.id, existing.change_id, actor);

  return { task: { ...existing, ...updates } };
}

export async function approveCcImplementationTask(
  taskId: string,
  actor: CcImplementationActor,
): Promise<{ task?: CcImplementationTask; error?: string }> {
  if (!canApproveCcImplementation(actor.role)) {
    return { error: 'QA approval permission required' };
  }
  const ref = doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { error: 'Task not found' };
  const existing = normalizeTask(snap.id, snap.data() as Record<string, unknown>);
  if (existing.task_status !== 'Pending Review') {
    return { error: 'Task is not pending QA review' };
  }

  const updates: Partial<CcImplementationTask> = {
    task_status: 'Completed',
    completion_percentage: 100,
    actual_end_date: today(),
    updated_at: nowIso(),
    updated_by: actor.id,
  };
  await updateDoc(ref, updates);
  await audit(actor, 'task completed', existing.change_id, `QA approved: ${existing.task_title}`, taskId);
  await notify('Critical Task Approved', `"${existing.task_title}" approved by QA.`, existing.change_id, { userId: existing.assigned_to });

  const plan = await getCcImplementationPlan(existing.change_id);
  if (plan) await recalcPlanProgress(plan.id, existing.change_id, actor);

  return { task: { ...existing, ...updates } };
}

export async function submitCcImplementationQaReview(
  changeId: string,
  input: CcImplementationQaReviewInput,
  actor: CcImplementationActor,
): Promise<{ plan?: CcImplementationPlan; error?: string }> {
  const [change, plan, tasks] = await Promise.all([
    getChangeById(changeId),
    getCcImplementationPlan(changeId),
    getCcImplementationTasks(changeId),
  ]);
  if (!plan || !change) return { error: 'Implementation plan not found' };
  if (!canApproveCcImplementation(actor.role)) {
    return { error: 'QA approval permission required' };
  }
  if (input.decision === 'approved') {
    if (!allMandatoryTasksComplete(tasks)) {
      return { error: 'All mandatory tasks must be completed before QA verification.' };
    }
    const pendingCritical = tasks.some((t) => t.task_status === 'Pending Review');
    if (pendingCritical) {
      return { error: 'Critical tasks pending QA review must be approved first.' };
    }
  }

  const headQaRequired = input.decision === 'approved' && requiresHeadQaImplementationReview(change, tasks);
  const isHeadQa = ['super_admin', 'head_qa'].includes(normalizeRole(actor.role || ''));

  if (plan.head_qa_review_pending && !isHeadQa) {
    return { error: 'Head QA approval required for critical implementation' };
  }

  let status: string;
  let headQaPending = false;
  if (input.decision === 'rejected') {
    status = deriveImplementationStatus(plan, tasks);
    if (status === 'Pending Verification') status = 'Partially Completed';
  } else if (headQaRequired && !isHeadQa) {
    status = 'Pending Verification';
    headQaPending = true;
  } else {
    status = 'Verified';
  }

  const updates: Partial<CcImplementationPlan> = {
    qa_comments: input.qa_comments,
    qa_review_completed: input.decision === 'approved' && !headQaPending,
    head_qa_review_pending: headQaPending,
    implementation_status: status,
    actual_end_date: input.decision === 'approved' && !headQaPending ? today() : plan.actual_end_date,
    updated_at: nowIso(),
    updated_by: actor.id,
  };
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationPlans, plan.id), updates);
  await audit(actor, 'QA review completed', changeId, input.qa_comments, plan.id);

  if (headQaPending) {
    await notify('Head QA Implementation Review', `Critical implementation for ${change.change_control_number} requires Head QA approval.`, changeId, { targetRole: 'head_qa' });
    return { plan: { ...plan, ...updates } };
  }

  if (input.decision === 'approved') {
    await updateChange(changeId, {
      status: change.effectiveness_check_required ? 'effectiveness_pending' : 'implemented',
      actual_implementation_date: today(),
    }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
    await audit(actor, 'implementation completed', changeId, 'QA verification approved', plan.id);
    await notify('Implementation Verified', `Implementation plan verified for ${change.change_control_number}.`, changeId, { userId: plan.implementation_owner });
  }

  return { plan: { ...plan, ...updates } };
}

export async function escalateOverdueCcTasks(actor: CcImplementationActor): Promise<number> {
  const { tasks } = await listCcImplementationPlans();
  let count = 0;
  for (const t of tasks) {
    if (isTaskOverdue(t) && t.task_status !== 'Overdue') {
      await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, t.id), {
        task_status: 'Overdue', updated_at: nowIso(),
      });
      await notify('Overdue Implementation Task', `"${t.task_title}" is overdue.`, t.change_id, { userId: t.assigned_to });
      await notify('Overdue Task Alert', `"${t.task_title}" requires attention.`, t.change_id, { targetRole: 'qa' });
      const plan = await getCcImplementationPlan(t.change_id);
      if (plan?.implementation_owner) {
        await notify('Overdue Implementation Task', `"${t.task_title}" is overdue.`, t.change_id, { userId: plan.implementation_owner });
      }
      count += 1;
    }
  }
  if (count > 0) await audit(actor, 'task updated', 'global', `${count} overdue tasks escalated`);
  return count;
}

export async function softDeleteCcImplementationTask(taskId: string, actor: CcImplementationActor) {
  await updateDoc(doc(getFirebaseFirestore(), CC_COLLECTIONS.implementationTasks, taskId), {
    is_deleted: true, updated_at: nowIso(), updated_by: actor.id,
  });
  return { ok: true };
}

export { computeCcImplementationDashboardMetrics, computeCcImplementationChartData };

export type { CcImplementationDashboardMetrics, CcImplementationChartData };
