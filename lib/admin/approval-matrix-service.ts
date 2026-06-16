import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { ApprovalMatrix, ApprovalMatrixFormData } from './schemas';

export interface ApprovalMatrixAuditMeta {
  userId: string;
  userName: string;
}

async function logMatrixAudit(
  action: string,
  recordId: string,
  meta: ApprovalMatrixAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Approval Matrix',
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
    collectionName: ADMIN_COLLECTIONS.approvalMatrix,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Approval Matrix',
  });
}

export function buildMatrixId(code: string): string {
  return `AMX-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeApprovalMatrix(m: ApprovalMatrix): ApprovalMatrix {
  const prepared = m.preparedByRole || m.level1Reviewer || '';
  const reviewed = m.reviewedByRole || m.level2Reviewer || '';
  const finalAp = m.finalApproverRole || m.finalApprover || '';
  return {
    ...m,
    approvalMatrixId: m.approvalMatrixId || m.matrixId || buildMatrixId(m.matrixCode || m.module || 'MATRIX'),
    matrixId: m.approvalMatrixId || m.matrixId || buildMatrixId(m.matrixCode || ''),
    moduleName: m.moduleName || m.module || '',
    module: m.moduleName || m.module || '',
    preparedByRole: prepared,
    level1Reviewer: prepared,
    reviewedByRole: reviewed,
    level2Reviewer: reviewed,
    finalApproverRole: finalAp,
    finalApprover: finalAp,
    eSignatureRequired: m.eSignatureRequired ?? m.eSignRequired ?? true,
    eSignRequired: m.eSignatureRequired ?? m.eSignRequired ?? true,
    approvalCommentRequired: m.approvalCommentRequired ?? m.mandatoryRemarks ?? true,
    mandatoryRemarks: m.approvalCommentRequired ?? m.mandatoryRemarks ?? true,
    minimumApprovalLevel: Number(m.minimumApprovalLevel ?? 1),
    parallelApprovalAllowed: m.parallelApprovalAllowed ?? false,
    sequentialApprovalRequired: m.sequentialApprovalRequired ?? true,
    delegationAllowed: m.delegationAllowed ?? false,
    riskLevel: (m.riskLevel as ApprovalMatrix['riskLevel']) || 'Medium',
  };
}

export function isMatrixActive(m: ApprovalMatrix): boolean {
  return m.status === 'Active' && !m.isDeleted;
}

export function matrixRequiresESign(m: ApprovalMatrix): boolean {
  return m.eSignatureRequired === true;
}

export function matrixRequiresComment(m: ApprovalMatrix): boolean {
  return m.approvalCommentRequired === true;
}

export async function fetchApprovalMatrices(): Promise<ApprovalMatrix[]> {
  try {
    const records = await getAdminRecords<ApprovalMatrix>(ADMIN_COLLECTIONS.approvalMatrix);
    return records.filter((m) => !m.isDeleted).map(normalizeApprovalMatrix);
  } catch {
    return [];
  }
}

export async function fetchApprovalMatrixById(id: string): Promise<ApprovalMatrix | null> {
  const all = await fetchApprovalMatrices();
  return all.find((m) => m.id === id) ?? null;
}

export async function fetchActiveMatrixForModule(
  moduleName: string,
  department?: string,
  riskLevel?: string,
): Promise<ApprovalMatrix | null> {
  const matrices = await fetchApprovalMatrices();
  return matrices.find((m) =>
    isMatrixActive(m) &&
    m.moduleName === moduleName &&
    (!department || m.department === department || m.department === 'All') &&
    (!riskLevel || m.riskLevel === riskLevel || m.riskLevel === 'All'),
  ) ?? null;
}

export function getApprovalMatrixSummaryCounts(matrices: ApprovalMatrix[]) {
  return {
    total: matrices.length,
    active: matrices.filter((m) => m.status === 'Active').length,
    inactive: matrices.filter((m) => m.status === 'Inactive').length,
    critical: matrices.filter((m) => m.riskLevel === 'Critical').length,
    eSignRequired: matrices.filter((m) => m.eSignatureRequired).length,
    departmentWise: matrices.filter((m) => m.department && m.department !== 'All').length,
    productSpecific: matrices.filter((m) => m.productOptional?.trim()).length,
  };
}

export function buildApprovalFlow(m: ApprovalMatrix): Array<{ label: string; roles: string }> {
  const flow: Array<{ label: string; roles: string }> = [];
  if (m.preparedByRole) flow.push({ label: 'Prepared By', roles: m.preparedByRole });
  if (m.reviewedByRole) flow.push({ label: 'Reviewed By', roles: m.reviewedByRole });
  if (m.verifiedByRole) flow.push({ label: 'Verified By', roles: m.verifiedByRole });
  if (m.approvedByRole) flow.push({ label: 'Approved By', roles: m.approvedByRole });
  if (m.finalApproverRole) flow.push({ label: 'Final Approver', roles: m.finalApproverRole });
  return flow;
}

function formToPayload(data: ApprovalMatrixFormData, meta: ApprovalMatrixAuditMeta, status = 'Active') {
  const matrixId = buildMatrixId(data.matrixCode);
  return {
    approvalMatrixId: matrixId,
    matrixId,
    matrixCode: data.matrixCode,
    matrixName: data.matrixName,
    moduleName: data.moduleName,
    module: data.moduleName,
    department: data.department,
    siteLocation: data.siteLocation,
    productOptional: data.productOptional,
    processOptional: data.processOptional,
    riskLevel: data.riskLevel,
    preparedByRole: data.preparedByRole,
    level1Reviewer: data.preparedByRole,
    reviewedByRole: data.reviewedByRole,
    level2Reviewer: data.reviewedByRole,
    verifiedByRole: data.verifiedByRole,
    approvedByRole: data.approvedByRole,
    finalApproverRole: data.finalApproverRole,
    finalApprover: data.finalApproverRole,
    escalationRole: data.escalationRole,
    minimumApprovalLevel: data.minimumApprovalLevel,
    eSignatureRequired: data.eSignatureRequired,
    eSignRequired: data.eSignatureRequired,
    approvalCommentRequired: data.approvalCommentRequired,
    mandatoryRemarks: data.approvalCommentRequired,
    parallelApprovalAllowed: data.parallelApprovalAllowed,
    sequentialApprovalRequired: data.sequentialApprovalRequired,
    delegationAllowed: data.delegationAllowed,
    remarks: data.remarks,
    status,
    updatedBy: meta.userId,
  };
}

export async function createApprovalMatrix(
  data: ApprovalMatrixFormData,
  meta: ApprovalMatrixAuditMeta,
): Promise<{ matrix: ApprovalMatrix | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.approvalMatrix, 'matrixCode', data.matrixCode);
    if (!unique) return { matrix: null, error: 'Matrix code already exists' };

    const payload = { ...formToPayload(data, meta), createdBy: meta.userId };
    const created = await createAdminRecord(ADMIN_COLLECTIONS.approvalMatrix, payload as Omit<ApprovalMatrix, 'id'>, {
      userId: meta.userId, userName: meta.userName, module: 'Approval Matrix', action: 'CREATE_APPROVAL_MATRIX',
    });

    await logMatrixAudit('CREATE_APPROVAL_MATRIX', created.id || payload.matrixId, meta, null, payload);
    return { matrix: normalizeApprovalMatrix(created as ApprovalMatrix), error: null };
  } catch (e) {
    return { matrix: null, error: (e as Error).message };
  }
}

export async function updateApprovalMatrix(
  id: string,
  data: ApprovalMatrixFormData,
  existing: ApprovalMatrix,
  meta: ApprovalMatrixAuditMeta,
): Promise<{ matrix: ApprovalMatrix | null; error: string | null }> {
  try {
    if (data.matrixCode !== existing.matrixCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.approvalMatrix, 'matrixCode', data.matrixCode, id);
      if (!unique) return { matrix: null, error: 'Matrix code already exists' };
    }

    const updates = formToPayload(data, meta, existing.status);
    delete (updates as { createdBy?: string }).createdBy;

    if (existing.riskLevel !== data.riskLevel) {
      await logMatrixAudit('RISK_LEVEL_CHANGE', id, meta, existing.riskLevel, data.riskLevel);
    }
    if (existing.eSignatureRequired !== data.eSignatureRequired) {
      await logMatrixAudit('ESIGN_SETTING_CHANGE', id, meta, existing.eSignatureRequired, data.eSignatureRequired);
    }
    if (
      existing.preparedByRole !== data.preparedByRole ||
      existing.reviewedByRole !== data.reviewedByRole ||
      existing.finalApproverRole !== data.finalApproverRole
    ) {
      await logMatrixAudit('ROLE_CHANGE', id, meta, {
        prepared: existing.preparedByRole, reviewed: existing.reviewedByRole, final: existing.finalApproverRole,
      }, {
        prepared: data.preparedByRole, reviewed: data.reviewedByRole, final: data.finalApproverRole,
      });
    }

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.approvalMatrix, id, updates, {
      userId: meta.userId, userName: meta.userName, module: 'Approval Matrix',
      oldValue: JSON.stringify(existing),
    });

    await logMatrixAudit('EDIT_APPROVAL_MATRIX', id, meta, existing, updates);
    return { matrix: normalizeApprovalMatrix(updated as ApprovalMatrix), error: null };
  } catch (e) {
    return { matrix: null, error: (e as Error).message };
  }
}

export async function setApprovalMatrixStatus(
  id: string,
  matrix: ApprovalMatrix,
  status: 'Active' | 'Inactive',
  meta: ApprovalMatrixAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.approvalMatrix, id, { status }, {
      userId: meta.userId, userName: meta.userName, module: 'Approval Matrix',
      oldValue: JSON.stringify(matrix),
    });
    const action = status === 'Active' ? 'ACTIVATE_MATRIX' : 'DEACTIVATE_MATRIX';
    await logMatrixAudit(action, id, meta, matrix.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function copyApprovalMatrix(
  sourceId: string,
  newCode: string,
  newName: string,
  meta: ApprovalMatrixAuditMeta,
): Promise<{ matrix: ApprovalMatrix | null; error: string | null }> {
  const source = await fetchApprovalMatrixById(sourceId);
  if (!source) return { matrix: null, error: 'Source matrix not found' };

  const formData: ApprovalMatrixFormData = {
    matrixCode: newCode,
    matrixName: newName,
    moduleName: source.moduleName as ApprovalMatrixFormData['moduleName'],
    department: source.department,
    siteLocation: source.siteLocation || '',
    productOptional: source.productOptional || '',
    processOptional: source.processOptional || '',
    riskLevel: source.riskLevel,
    preparedByRole: source.preparedByRole || '',
    reviewedByRole: source.reviewedByRole || '',
    verifiedByRole: source.verifiedByRole || '',
    approvedByRole: source.approvedByRole || '',
    finalApproverRole: source.finalApproverRole || '',
    escalationRole: source.escalationRole || '',
    minimumApprovalLevel: Number(source.minimumApprovalLevel ?? 1),
    eSignatureRequired: source.eSignatureRequired ?? true,
    approvalCommentRequired: source.approvalCommentRequired ?? true,
    parallelApprovalAllowed: source.parallelApprovalAllowed ?? false,
    sequentialApprovalRequired: source.sequentialApprovalRequired ?? true,
    delegationAllowed: source.delegationAllowed ?? false,
    remarks: `Copied from ${source.matrixName}`,
  };

  const result = await createApprovalMatrix(formData, meta);
  if (result.matrix) {
    await logMatrixAudit('COPY_MATRIX', result.matrix.id!, meta, sourceId, { newCode, newName });
  }
  return result;
}

export async function fetchApprovalMatrixAuditTrail(recordId: string) {
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

export function exportApprovalMatricesCsv(matrices: ApprovalMatrix[]): string {
  const headers = ['Code', 'Name', 'Module', 'Department', 'Risk', 'Final Approver', 'E-Sign', 'Status'];
  const rows = matrices.map((m) => [
    m.matrixCode, m.matrixName, m.moduleName, m.department, m.riskLevel,
    m.finalApproverRole, m.eSignatureRequired ? 'Yes' : 'No', m.status,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logApprovalMatrixExport(meta: ApprovalMatrixAuditMeta, count: number) {
  await logMatrixAudit('EXPORT_MATRIX_LIST', 'export', meta, null, { count });
}

export const DEFAULT_APPROVAL_MATRIX_PRESETS: ApprovalMatrixFormData[] = [
  {
    matrixCode: 'PQR-DEFAULT', matrixName: 'PQR Approval Matrix', moduleName: 'PQR',
    department: 'QA', siteLocation: '', productOptional: '', processOptional: '',
    riskLevel: 'High', preparedByRole: 'qa_executive',
    reviewedByRole: 'qa_manager,qc_manager,production_manager,warehouse_manager,engineering_manager',
    verifiedByRole: '', approvedByRole: '', finalApproverRole: 'head_qa',
    escalationRole: 'head_qa', minimumApprovalLevel: 2, eSignatureRequired: true,
    approvalCommentRequired: true, parallelApprovalAllowed: true, sequentialApprovalRequired: false,
    delegationAllowed: false, remarks: 'Default PQR matrix',
  },
  {
    matrixCode: 'DEV-MINOR', matrixName: 'Deviation Minor', moduleName: 'Deviation',
    department: 'QA', riskLevel: 'Low', preparedByRole: 'qa_executive',
    reviewedByRole: 'department_head', verifiedByRole: '', approvedByRole: 'qa_manager',
    finalApproverRole: 'qa_manager', escalationRole: 'head_qa', minimumApprovalLevel: 2,
    eSignatureRequired: true, approvalCommentRequired: true, parallelApprovalAllowed: false,
    sequentialApprovalRequired: true, delegationAllowed: false, remarks: 'Minor deviation',
    siteLocation: '', productOptional: '', processOptional: '',
  },
  {
    matrixCode: 'DEV-CRITICAL', matrixName: 'Deviation Critical', moduleName: 'Deviation',
    department: 'QA', riskLevel: 'Critical', preparedByRole: 'qa_executive',
    reviewedByRole: 'department_head,qa_manager', verifiedByRole: '', approvedByRole: '',
    finalApproverRole: 'head_qa', escalationRole: 'head_qa', minimumApprovalLevel: 3,
    eSignatureRequired: true, approvalCommentRequired: true, parallelApprovalAllowed: false,
    sequentialApprovalRequired: true, delegationAllowed: false, remarks: 'Critical deviation',
    siteLocation: '', productOptional: '', processOptional: '',
  },
  {
    matrixCode: 'OOS-DEFAULT', matrixName: 'OOS Approval Matrix', moduleName: 'OOS',
    department: 'QC', riskLevel: 'High', preparedByRole: 'qc_executive',
    reviewedByRole: 'qc_manager', verifiedByRole: '', approvedByRole: 'qa_manager',
    finalApproverRole: 'head_qa', escalationRole: 'head_qa', minimumApprovalLevel: 3,
    eSignatureRequired: true, approvalCommentRequired: true, parallelApprovalAllowed: false,
    sequentialApprovalRequired: true, delegationAllowed: false, remarks: 'Default OOS',
    siteLocation: '', productOptional: '', processOptional: '',
  },
  {
    matrixCode: 'CAPA-DEFAULT', matrixName: 'CAPA Approval Matrix', moduleName: 'CAPA',
    department: 'QA', riskLevel: 'Medium', preparedByRole: 'qa_executive',
    reviewedByRole: 'qa_manager', verifiedByRole: '', approvedByRole: 'head_qa',
    finalApproverRole: 'head_qa', escalationRole: 'head_qa', minimumApprovalLevel: 2,
    eSignatureRequired: true, approvalCommentRequired: true, parallelApprovalAllowed: false,
    sequentialApprovalRequired: true, delegationAllowed: false, remarks: 'Default CAPA',
    siteLocation: '', productOptional: '', processOptional: '',
  },
  {
    matrixCode: 'CC-CRITICAL', matrixName: 'Change Control Critical', moduleName: 'Change Control',
    department: 'QA', riskLevel: 'Critical', preparedByRole: 'qa_executive',
    reviewedByRole: 'qa_manager,qc_manager,production_manager,engineering_manager,regulatory_affairs',
    verifiedByRole: '', approvedByRole: '', finalApproverRole: 'head_qa',
    escalationRole: 'head_qa', minimumApprovalLevel: 3, eSignatureRequired: true,
    approvalCommentRequired: true, parallelApprovalAllowed: true, sequentialApprovalRequired: false,
    delegationAllowed: false, remarks: 'Critical change control',
    siteLocation: '', productOptional: '', processOptional: '',
  },
  {
    matrixCode: 'DMS-DEFAULT', matrixName: 'DMS Approval Matrix', moduleName: 'DMS',
    department: 'QA', riskLevel: 'Medium', preparedByRole: 'qa_executive',
    reviewedByRole: 'qa_manager', verifiedByRole: '', approvedByRole: 'head_qa',
    finalApproverRole: 'head_qa', escalationRole: 'head_qa', minimumApprovalLevel: 2,
    eSignatureRequired: true, approvalCommentRequired: true, parallelApprovalAllowed: false,
    sequentialApprovalRequired: true, delegationAllowed: false, remarks: 'DMS workflow',
    siteLocation: '', productOptional: '', processOptional: '',
  },
];

export async function seedDefaultApprovalMatrices(meta: ApprovalMatrixAuditMeta): Promise<{ created: number; skipped: number }> {
  const existing = await fetchApprovalMatrices();
  const codes = new Set(existing.map((m) => m.matrixCode));
  let created = 0;
  let skipped = 0;

  for (const preset of DEFAULT_APPROVAL_MATRIX_PRESETS) {
    if (codes.has(preset.matrixCode)) {
      skipped += 1;
      continue;
    }
    const result = await createApprovalMatrix(preset, meta);
    if (result.matrix) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}
