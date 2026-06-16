import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS, APPROVAL_WORKFLOW_TYPES } from './constants';
import type { Workflow, WorkflowStep, WorkflowFormData } from './schemas';

export interface WorkflowAuditMeta {
  userId: string;
  userName: string;
}

async function logWorkflowAudit(
  action: string,
  recordId: string,
  meta: WorkflowAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Workflow Configuration',
    recordId,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason: '',
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.workflows,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Workflow Configuration',
  });
}

export function buildWorkflowId(code: string): string {
  return `WF-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeWorkflow(w: Workflow): Workflow {
  const escalationDays = Number(w.escalationDays ?? w.autoEscalationDays ?? 3);
  return {
    ...w,
    workflowId: w.workflowId || buildWorkflowId(w.workflowCode || w.moduleName || 'WF'),
    workflowCode: w.workflowCode || w.moduleName || '',
    workflowName: w.workflowName || `${w.moduleName} Workflow`,
    workflowType: (w.workflowType as Workflow['workflowType']) || 'Multi Level Approval',
    finalApproverRole: w.finalApproverRole || w.approverRole || '',
    approverRole: w.finalApproverRole || w.approverRole || '',
    reviewerRoles: w.reviewerRoles || w.reviewerRole || '',
    reviewerRole: w.reviewerRoles || w.reviewerRole || '',
    approverRoles: w.approverRoles || '',
    escalationDays,
    autoEscalationDays: escalationDays,
    autoEscalationEnabled: w.autoEscalationEnabled ?? false,
    targetCompletionDays: Number(w.targetCompletionDays ?? 30),
    requireRemarks: w.requireRemarks ?? true,
    allowDelegation: w.allowDelegation ?? false,
    description: w.description || w.workflowChain || '',
  };
}

export function isWorkflowActive(w: Workflow): boolean {
  return w.status === 'Active' && !w.isDeleted;
}

export function workflowRequiresESign(w: Workflow): boolean {
  return w.requireESignature === true;
}

export async function fetchWorkflows(): Promise<Workflow[]> {
  try {
    const records = await getAdminRecords<Workflow>(ADMIN_COLLECTIONS.workflows);
    return records.filter((w) => !w.isDeleted).map(normalizeWorkflow);
  } catch {
    return [];
  }
}

export async function fetchWorkflowById(id: string): Promise<Workflow | null> {
  const workflows = await fetchWorkflows();
  return workflows.find((w) => w.id === id) ?? null;
}

export async function fetchActiveWorkflowForModule(moduleName: string): Promise<Workflow | null> {
  const workflows = await fetchWorkflows();
  return workflows.find((w) => w.moduleName === moduleName && isWorkflowActive(w)) ?? null;
}

export async function fetchWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
  try {
    const all = await getAdminRecords<WorkflowStep>(ADMIN_COLLECTIONS.workflowSteps);
    return all
      .filter((s) => s.workflowId === workflowId && !s.isDeleted)
      .sort((a, b) => Number(a.stepNumber) - Number(b.stepNumber));
  } catch {
    return [];
  }
}

export function getWorkflowSummaryCounts(workflows: Workflow[]) {
  return {
    total: workflows.length,
    active: workflows.filter((w) => w.status === 'Active').length,
    inactive: workflows.filter((w) => w.status === 'Inactive').length,
    multiLevel: workflows.filter((w) => w.workflowType === 'Multi Level Approval').length,
    eSignRequired: workflows.filter((w) => w.requireESignature).length,
    escalationEnabled: workflows.filter((w) => w.autoEscalationEnabled).length,
  };
}

function buildWorkflowChain(steps: WorkflowFormData['steps']): string {
  return steps.map((s) => s.stepName || s.assignedRole.replace(/_/g, ' ')).join(' → ');
}

function formToWorkflowPayload(data: WorkflowFormData, meta: WorkflowAuditMeta, status = 'Active') {
  const workflowId = buildWorkflowId(data.workflowCode);
  const chain = buildWorkflowChain(data.steps);
  return {
    workflowId,
    workflowCode: data.workflowCode,
    workflowName: data.workflowName,
    moduleName: data.moduleName,
    department: data.department,
    workflowType: data.workflowType,
    initiatorRole: data.initiatorRole,
    reviewerRoles: data.reviewerRoles,
    reviewerRole: data.reviewerRoles,
    approverRoles: data.approverRoles,
    finalApproverRole: data.finalApproverRole,
    approverRole: data.finalApproverRole,
    escalationRole: data.escalationRole,
    approvalLevels: data.approvalLevels,
    requireESignature: data.requireESignature,
    requireRemarks: data.requireRemarks,
    allowRejection: data.allowRejection,
    allowResubmission: data.allowResubmission,
    allowDelegation: data.allowDelegation,
    autoEscalationEnabled: data.autoEscalationEnabled,
    autoEscalationDays: data.escalationDays,
    escalationDays: data.escalationDays,
    targetCompletionDays: data.targetCompletionDays,
    description: data.description,
    workflowChain: chain,
    status,
    updatedBy: meta.userId,
  };
}

async function syncWorkflowSteps(
  workflowId: string,
  steps: WorkflowFormData['steps'],
  meta: WorkflowAuditMeta,
  existingSteps: WorkflowStep[] = [],
) {
  const existingIds = new Set(existingSteps.map((s) => s.id).filter(Boolean));
  const newIds = new Set(steps.map((s) => s.id).filter(Boolean));

  for (const old of existingSteps) {
    if (old.id && !newIds.has(old.id)) {
      await updateAdminRecord(ADMIN_COLLECTIONS.workflowSteps, old.id, { isDeleted: true }, {
        userId: meta.userId, userName: meta.userName, module: 'Workflow Configuration',
        oldValue: JSON.stringify(old),
      });
      await logWorkflowAudit('DELETE_STEP', workflowId, meta, old, null);
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = { ...steps[i], stepNumber: i + 1, workflowId };
    const payload = {
      ...step,
      workflowId,
      stepNumber: i + 1,
    };

    if (step.id && existingIds.has(step.id)) {
      const prev = existingSteps.find((s) => s.id === step.id);
      await updateAdminRecord(ADMIN_COLLECTIONS.workflowSteps, step.id, payload, {
        userId: meta.userId, userName: meta.userName, module: 'Workflow Configuration',
        oldValue: JSON.stringify(prev),
      });
      await logWorkflowAudit('EDIT_STEP', workflowId, meta, prev, payload);
    } else {
      const created = await createAdminRecord(ADMIN_COLLECTIONS.workflowSteps, payload as Omit<WorkflowStep, 'id'>, {
        userId: meta.userId, userName: meta.userName, module: 'Workflow Configuration', action: 'ADD_STEP',
      });
      await logWorkflowAudit('ADD_STEP', workflowId, meta, null, created);
    }
  }

  if (existingSteps.length && steps.length) {
    const orderChanged = steps.some((s, i) => existingSteps[i]?.id !== s.id);
    if (orderChanged) await logWorkflowAudit('REORDER_STEPS', workflowId, meta, existingSteps, steps);
  }
}

export async function createWorkflow(
  data: WorkflowFormData,
  meta: WorkflowAuditMeta,
): Promise<{ workflow: Workflow | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.workflows, 'workflowCode', data.workflowCode);
    if (!unique) return { workflow: null, error: 'Workflow code already exists' };

    const payload = {
      ...formToWorkflowPayload(data, meta),
      createdBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.workflows, payload as Omit<Workflow, 'id'>, {
      userId: meta.userId, userName: meta.userName, module: 'Workflow Configuration', action: 'CREATE_WORKFLOW',
    });

    const workflowId = created.id!;
    await syncWorkflowSteps(workflowId, data.steps, meta);
    await logWorkflowAudit('CREATE_WORKFLOW', workflowId, meta, null, payload);
    return { workflow: normalizeWorkflow(created as Workflow), error: null };
  } catch (e) {
    return { workflow: null, error: (e as Error).message };
  }
}

export async function updateWorkflow(
  id: string,
  data: WorkflowFormData,
  existing: Workflow,
  meta: WorkflowAuditMeta,
): Promise<{ workflow: Workflow | null; error: string | null }> {
  try {
    if (data.workflowCode !== existing.workflowCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.workflows, 'workflowCode', data.workflowCode, id);
      if (!unique) return { workflow: null, error: 'Workflow code already exists' };
    }

    const updates = formToWorkflowPayload(data, meta, existing.status);
    delete (updates as { createdBy?: string }).createdBy;

    const existingSteps = await fetchWorkflowSteps(id);
    await syncWorkflowSteps(id, data.steps, meta, existingSteps);

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.workflows, id, updates, {
      userId: meta.userId, userName: meta.userName, module: 'Workflow Configuration',
      oldValue: JSON.stringify(existing),
    });

    await logWorkflowAudit('EDIT_WORKFLOW', id, meta, existing, updates);
    return { workflow: normalizeWorkflow(updated as Workflow), error: null };
  } catch (e) {
    return { workflow: null, error: (e as Error).message };
  }
}

export async function setWorkflowStatus(
  id: string,
  workflow: Workflow,
  status: 'Active' | 'Inactive',
  meta: WorkflowAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.workflows, id, { status }, {
      userId: meta.userId, userName: meta.userName, module: 'Workflow Configuration',
      oldValue: JSON.stringify(workflow),
    });
    const action = status === 'Active' ? 'ACTIVATE_WORKFLOW' : 'DEACTIVATE_WORKFLOW';
    await logWorkflowAudit(action, id, meta, workflow.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function copyWorkflow(
  sourceId: string,
  newCode: string,
  newName: string,
  meta: WorkflowAuditMeta,
): Promise<{ workflow: Workflow | null; error: string | null }> {
  const source = await fetchWorkflowById(sourceId);
  if (!source) return { workflow: null, error: 'Source workflow not found' };

  const steps = await fetchWorkflowSteps(sourceId);
  const formData: WorkflowFormData = {
    workflowCode: newCode,
    workflowName: newName,
    moduleName: source.moduleName as WorkflowFormData['moduleName'],
    department: source.department || '',
    workflowType: source.workflowType,
    initiatorRole: source.initiatorRole || '',
    reviewerRoles: source.reviewerRoles || '',
    approverRoles: source.approverRoles || '',
    finalApproverRole: source.finalApproverRole || '',
    escalationRole: source.escalationRole || '',
    approvalLevels: Number(source.approvalLevels) || steps.length,
    requireESignature: source.requireESignature ?? true,
    requireRemarks: source.requireRemarks ?? true,
    allowRejection: source.allowRejection ?? true,
    allowResubmission: source.allowResubmission ?? true,
    allowDelegation: source.allowDelegation ?? false,
    autoEscalationEnabled: source.autoEscalationEnabled ?? false,
    escalationDays: Number(source.escalationDays ?? 3),
    targetCompletionDays: Number(source.targetCompletionDays ?? 30),
    description: `Copied from ${source.workflowName}`,
    steps: steps.map((s) => ({
      stepNumber: s.stepNumber,
      stepName: s.stepName,
      stepType: s.stepType,
      department: s.department || '',
      assignedRole: s.assignedRole,
      assignedUser: s.assignedUser || '',
      isMandatory: s.isMandatory ?? true,
      canApprove: s.canApprove ?? false,
      canReject: s.canReject ?? false,
      canSendBack: s.canSendBack ?? false,
      requireESignature: s.requireESignature ?? false,
      requireComment: s.requireComment ?? false,
      dueDays: Number(s.dueDays ?? 3),
      escalationRole: s.escalationRole || '',
      status: (s.status as WorkflowStep['status']) || 'Active',
    })),
  };

  const result = await createWorkflow(formData, meta);
  if (result.workflow) {
    await logWorkflowAudit('COPY_WORKFLOW', result.workflow.id!, meta, sourceId, { newCode, newName });
  }
  return result;
}

export async function fetchWorkflowAuditTrail(recordId: string) {
  try {
    const [trail, logs] = await Promise.all([
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditTrail).catch(() => []),
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditLogs).catch(() => []),
    ]);
    return [...trail, ...logs]
      .filter((l) => l.documentId === recordId || l.recordId === recordId)
      .sort((a, b) => String(b.timestamp ?? b.dateTime).localeCompare(String(a.timestamp ?? a.dateTime)))
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function exportWorkflowsCsv(workflows: Workflow[]): string {
  const headers = ['Code', 'Name', 'Module', 'Type', 'Levels', 'Status', 'E-Sign', 'Escalation'];
  const rows = workflows.map((w) => [
    w.workflowCode, w.workflowName, w.moduleName, w.workflowType,
    w.approvalLevels, w.status, w.requireESignature ? 'Yes' : 'No',
    w.autoEscalationEnabled ? 'Yes' : 'No',
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logWorkflowExport(meta: WorkflowAuditMeta, count: number) {
  await logWorkflowAudit('EXPORT_WORKFLOW_LIST', 'export', meta, null, { count });
}

type StepDef = {
  stepName: string;
  stepType: WorkflowStep['stepType'];
  assignedRole: string;
  department?: string;
  canApprove?: boolean;
  canReject?: boolean;
  requireESignature?: boolean;
};

function makeSteps(defs: StepDef[]): WorkflowFormData['steps'] {
  return defs.map((d, i) => ({
    stepNumber: i + 1,
    stepName: d.stepName,
    stepType: d.stepType,
    department: d.department || 'QA',
    assignedRole: d.assignedRole,
    assignedUser: '',
    isMandatory: true,
    canApprove: d.canApprove ?? d.stepType.includes('Approve'),
    canReject: d.canReject ?? false,
    canSendBack: true,
    requireESignature: d.requireESignature ?? d.stepType.includes('Approve'),
    requireComment: true,
    dueDays: 3,
    escalationRole: 'head_qa',
    status: 'Active' as const,
  }));
}

export const DEFAULT_WORKFLOW_PRESETS: Array<{
  code: string;
  name: string;
  moduleName: WorkflowFormData['moduleName'];
  workflowType: WorkflowFormData['workflowType'];
  steps: WorkflowFormData['steps'];
  finalApproverRole: string;
}> = [
  {
    code: 'PQR-DEFAULT',
    name: 'PQR Review Workflow',
    moduleName: 'PQR',
    workflowType: 'Multi Level Approval',
    finalApproverRole: 'head_qa',
    steps: makeSteps([
      { stepName: 'QA Executive', stepType: 'Review', assignedRole: 'qa_executive', department: 'QA' },
      { stepName: 'QA Manager', stepType: 'Review', assignedRole: 'qa_manager', department: 'QA' },
      { stepName: 'QC Manager', stepType: 'Review', assignedRole: 'qc_manager', department: 'QC' },
      { stepName: 'Production Manager', stepType: 'Review', assignedRole: 'production_manager', department: 'Production' },
      { stepName: 'Warehouse Manager', stepType: 'Review', assignedRole: 'warehouse_manager', department: 'Warehouse' },
      { stepName: 'Engineering Manager', stepType: 'Review', assignedRole: 'engineering_manager', department: 'Engineering' },
      { stepName: 'Head QA', stepType: 'Final Approve', assignedRole: 'head_qa', department: 'QA', canApprove: true, canReject: true, requireESignature: true },
    ]),
  },
  {
    code: 'DEV-DEFAULT',
    name: 'Deviation Workflow',
    moduleName: 'Deviation',
    workflowType: 'Investigation + Approval',
    finalApproverRole: 'head_qa',
    steps: makeSteps([
      { stepName: 'Initiator', stepType: 'Submit', assignedRole: 'qa_executive' },
      { stepName: 'Department Head', stepType: 'Review', assignedRole: 'department_head' },
      { stepName: 'QA Review', stepType: 'Review', assignedRole: 'qa_manager' },
      { stepName: 'Investigation', stepType: 'Investigate', assignedRole: 'qa_executive' },
      { stepName: 'CAPA if required', stepType: 'Execute', assignedRole: 'qa_manager' },
      { stepName: 'Head QA Approval', stepType: 'Final Approve', assignedRole: 'head_qa', canApprove: true, canReject: true },
      { stepName: 'Close', stepType: 'Close', assignedRole: 'qa_manager' },
    ]),
  },
  {
    code: 'OOS-DEFAULT',
    name: 'OOS Workflow',
    moduleName: 'OOS',
    workflowType: 'Investigation + Approval',
    finalApproverRole: 'head_qa',
    steps: makeSteps([
      { stepName: 'QC Analyst', stepType: 'Submit', assignedRole: 'qc_executive', department: 'QC' },
      { stepName: 'QC Manager', stepType: 'Review', assignedRole: 'qc_manager', department: 'QC' },
      { stepName: 'QA Review', stepType: 'Review', assignedRole: 'qa_manager' },
      { stepName: 'Phase-I', stepType: 'Investigate', assignedRole: 'qc_manager' },
      { stepName: 'Phase-II', stepType: 'Investigate', assignedRole: 'qa_manager' },
      { stepName: 'Head QA Approval', stepType: 'Final Approve', assignedRole: 'head_qa', canApprove: true },
      { stepName: 'Close', stepType: 'Close', assignedRole: 'qa_manager' },
    ]),
  },
  {
    code: 'CAPA-DEFAULT',
    name: 'CAPA Workflow',
    moduleName: 'CAPA',
    workflowType: 'Execution + Review + Approval',
    finalApproverRole: 'head_qa',
    steps: makeSteps([
      { stepName: 'QA Create', stepType: 'Prepare', assignedRole: 'qa_executive' },
      { stepName: 'Implementation', stepType: 'Execute', assignedRole: 'production_manager' },
      { stepName: 'Effectiveness Check', stepType: 'Verify', assignedRole: 'qa_manager' },
      { stepName: 'Head QA Approval', stepType: 'Final Approve', assignedRole: 'head_qa', canApprove: true },
      { stepName: 'Close', stepType: 'Close', assignedRole: 'qa_manager' },
    ]),
  },
  {
    code: 'CC-DEFAULT',
    name: 'Change Control Workflow',
    moduleName: 'Change Control',
    workflowType: 'Execution + Review + Approval',
    finalApproverRole: 'head_qa',
    steps: makeSteps([
      { stepName: 'Initiator', stepType: 'Submit', assignedRole: 'qa_executive' },
      { stepName: 'QA Review', stepType: 'Review', assignedRole: 'qa_manager' },
      { stepName: 'Impact Assessment', stepType: 'Review', assignedRole: 'qa_manager' },
      { stepName: 'Department Reviews', stepType: 'Review', assignedRole: 'department_head' },
      { stepName: 'Head QA Approval', stepType: 'Approve', assignedRole: 'head_qa', canApprove: true },
      { stepName: 'Implementation', stepType: 'Execute', assignedRole: 'production_manager' },
      { stepName: 'Effectiveness', stepType: 'Verify', assignedRole: 'qa_manager' },
      { stepName: 'Close', stepType: 'Close', assignedRole: 'qa_manager' },
    ]),
  },
  {
    code: 'DMS-DEFAULT',
    name: 'DMS Workflow',
    moduleName: 'DMS',
    workflowType: 'Sequential Review',
    finalApproverRole: 'head_qa',
    steps: makeSteps([
      { stepName: 'Author', stepType: 'Prepare', assignedRole: 'qa_executive' },
      { stepName: 'Reviewer', stepType: 'Review', assignedRole: 'qa_manager' },
      { stepName: 'Approver', stepType: 'Approve', assignedRole: 'head_qa', canApprove: true },
      { stepName: 'Effective', stepType: 'Close', assignedRole: 'qa_manager' },
    ]),
  },
  {
    code: 'TRN-DEFAULT',
    name: 'Training Workflow',
    moduleName: 'Training',
    workflowType: 'Sequential Review',
    finalApproverRole: 'qa_manager',
    steps: makeSteps([
      { stepName: 'QA/HR Assign', stepType: 'Submit', assignedRole: 'qa_executive' },
      { stepName: 'Employee Complete', stepType: 'Execute', assignedRole: 'qa_executive' },
      { stepName: 'Trainer Verify', stepType: 'Verify', assignedRole: 'qa_manager' },
      { stepName: 'QA Close', stepType: 'Close', assignedRole: 'qa_manager' },
    ]),
  },
];

export async function seedDefaultWorkflows(meta: WorkflowAuditMeta): Promise<{ created: number; skipped: number }> {
  const existing = await fetchWorkflows();
  const codes = new Set(existing.map((w) => w.workflowCode));
  let created = 0;
  let skipped = 0;

  for (const preset of DEFAULT_WORKFLOW_PRESETS) {
    if (codes.has(preset.code)) {
      skipped += 1;
      continue;
    }
    const formData: WorkflowFormData = {
      workflowCode: preset.code,
      workflowName: preset.name,
      moduleName: preset.moduleName,
      department: 'QA',
      workflowType: preset.workflowType,
      initiatorRole: preset.steps[0]?.assignedRole || 'qa_executive',
      reviewerRoles: preset.steps.filter((s) => s.stepType === 'Review').map((s) => s.assignedRole).join(','),
      approverRoles: preset.steps.filter((s) => s.stepType === 'Approve' || s.stepType === 'Final Approve').map((s) => s.assignedRole).join(','),
      finalApproverRole: preset.finalApproverRole,
      escalationRole: 'head_qa',
      approvalLevels: preset.steps.length,
      requireESignature: true,
      requireRemarks: true,
      allowRejection: true,
      allowResubmission: true,
      allowDelegation: false,
      autoEscalationEnabled: true,
      escalationDays: 3,
      targetCompletionDays: 30,
      description: `Default ${preset.moduleName} workflow`,
      steps: preset.steps,
    };
    const result = await createWorkflow(formData, meta);
    if (result.workflow) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}

export function isApprovalWorkflowType(type: string): boolean {
  return APPROVAL_WORKFLOW_TYPES.includes(type as typeof APPROVAL_WORKFLOW_TYPES[number]);
}
