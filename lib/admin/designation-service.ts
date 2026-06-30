import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS, DESIGNATION_LEVEL_APPROVAL_MAP } from './constants';
import { fetchDepartments } from './department-service';
import type { AdminUser, Designation, DesignationFormData } from './schemas';

export interface DesignationAuditMeta {
  userId: string;
  userName: string;
}

async function logDesignationAudit(
  action: string,
  recordId: string,
  meta: DesignationAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Designation Master',
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
    collectionName: ADMIN_COLLECTIONS.designations,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Designation Master',
  });
}

export function buildDesignationId(code: string): string {
  return `DESG-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function approvalLevelFromDesignationLevel(level: string): number {
  return DESIGNATION_LEVEL_APPROVAL_MAP[level] ?? 1;
}

export async function fetchDesignations(): Promise<Designation[]> {
  try {
    const records = await getAdminRecords<Designation>(ADMIN_COLLECTIONS.designations);
    return records.filter((d) => !d.isDeleted);
  } catch {
    return [];
  }
}

export async function fetchDesignationById(id: string): Promise<Designation | null> {
  const items = await fetchDesignations();
  return items.find((d) => d.id === id) ?? null;
}

export async function fetchActiveDepartmentsForDesignation(): Promise<{ departmentName: string; departmentCode: string }[]> {
  const departments = await fetchDepartments();
  const seen = new Set<string>();
  return departments
    .filter((d) => d.status === 'Active')
    .filter((d) => {
      if (seen.has(d.departmentName)) return false;
      seen.add(d.departmentName);
      return true;
    })
    .map((d) => ({ departmentName: d.departmentName, departmentCode: d.departmentCode }));
}

export async function isDepartmentActive(departmentName: string): Promise<boolean> {
  const departments = await fetchDepartments();
  const dept = departments.find(
    (d) => d.departmentName === departmentName || d.departmentCode === departmentName,
  );
  if (!dept) return false;
  return dept.status === 'Active';
}

export async function checkDesignationNameInDepartment(
  name: string,
  department: string,
  excludeId?: string,
): Promise<boolean> {
  const all = await fetchDesignations();
  const conflict = all.find(
    (d) => d.designationName === name && d.department === department && d.id !== excludeId,
  );
  return !conflict;
}

export function designationMatchesUser(des: Designation, userDesignation: string): boolean {
  if (!userDesignation) return false;
  return userDesignation === des.designationName ||
    userDesignation === des.designationCode ||
    userDesignation === des.designationId;
}

export async function countUsersWithDesignation(des: Designation): Promise<number> {
  try {
    const users = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return users.filter((u) => !u.isDeleted && designationMatchesUser(des, u.designation)).length;
  } catch {
    return 0;
  }
}

export async function fetchUsersWithDesignation(des: Designation): Promise<AdminUser[]> {
  try {
    const users = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return users.filter((u) => !u.isDeleted && designationMatchesUser(des, u.designation));
  } catch {
    return [];
  }
}

export async function isDesignationActiveForAssignment(designationName: string): Promise<boolean> {
  const items = await fetchDesignations();
  const match = items.find(
    (d) => d.designationName === designationName || d.designationCode === designationName,
  );
  if (!match) return true;
  return match.status === 'Active';
}

export async function createDesignation(
  data: DesignationFormData,
  meta: DesignationAuditMeta,
): Promise<{ designation: Designation | null; error: string | null }> {
  try {
    if (!await isDepartmentActive(data.department)) {
      return { designation: null, error: 'Department must be active' };
    }

    const codeUnique = await checkUniqueField(ADMIN_COLLECTIONS.designations, 'designationCode', data.designationCode);
    if (!codeUnique) return { designation: null, error: 'Designation code already exists' };

    const nameUnique = await checkDesignationNameInDepartment(data.designationName, data.department);
    if (!nameUnique) return { designation: null, error: 'Designation name already exists in this department' };

    const designationId = buildDesignationId(data.designationCode);
    const approvalLevel = approvalLevelFromDesignationLevel(data.designationLevel);

    const payload = {
      designationId,
      designationCode: data.designationCode,
      designationName: data.designationName,
      department: data.department,
      designationLevel: data.designationLevel,
      approvalLevel,
      approvalAuthority: data.approvalAuthority,
      canReview: data.canReview,
      canApprove: data.canApprove,
      canESign: data.canESign,
      description: data.description,
      status: data.status,
      createdBy: meta.userId,
      updatedBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.designations, payload as Omit<Designation, 'id'>, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Designation Master',
      action: 'CREATE_DESIGNATION',
    });

    await logDesignationAudit('CREATE_DESIGNATION', created.id || designationId, meta, null, payload);
    return { designation: created, error: null };
  } catch (e) {
    return { designation: null, error: (e as Error).message };
  }
}

export async function updateDesignation(
  id: string,
  data: DesignationFormData,
  existing: Designation,
  meta: DesignationAuditMeta,
): Promise<{ designation: Designation | null; error: string | null }> {
  try {
    if (!await isDepartmentActive(data.department)) {
      return { designation: null, error: 'Department must be active' };
    }

    if (data.designationCode !== existing.designationCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.designations, 'designationCode', data.designationCode, id);
      if (!unique) return { designation: null, error: 'Designation code already exists' };
    }

    if (data.designationName !== existing.designationName || data.department !== existing.department) {
      const nameUnique = await checkDesignationNameInDepartment(data.designationName, data.department, id);
      if (!nameUnique) return { designation: null, error: 'Designation name already exists in this department' };
    }

    const approvalLevel = approvalLevelFromDesignationLevel(data.designationLevel);
    const updates: Partial<Designation> = {
      designationCode: data.designationCode,
      designationName: data.designationName,
      department: data.department,
      designationLevel: data.designationLevel,
      approvalLevel,
      approvalAuthority: data.approvalAuthority,
      canReview: data.canReview,
      canApprove: data.canApprove,
      canESign: data.canESign,
      description: data.description,
      status: data.status,
    };

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.designations, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Designation Master',
      oldValue: JSON.stringify(existing),
    });

    if (existing.department !== data.department) {
      await logDesignationAudit('DEPARTMENT_CHANGE', id, meta, existing.department, data.department);
    }
    if (existing.approvalAuthority !== data.approvalAuthority) {
      await logDesignationAudit('APPROVAL_AUTHORITY_CHANGE', id, meta, existing.approvalAuthority, data.approvalAuthority);
    }
    await logDesignationAudit('EDIT_DESIGNATION', id, meta, existing, updates);
    return { designation: updated, error: null };
  } catch (e) {
    return { designation: null, error: (e as Error).message };
  }
}

export async function setDesignationStatus(
  id: string,
  des: Designation,
  status: 'Active' | 'Inactive',
  meta: DesignationAuditMeta,
): Promise<{ success: boolean; error?: string; linkedUsers?: number }> {
  const linkedUsers = await countUsersWithDesignation(des);

  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.designations, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Designation Master',
      oldValue: JSON.stringify(des),
    });

    const action = status === 'Active' ? 'DESIGNATION_ACTIVATED' : 'DESIGNATION_DEACTIVATED';
    await logDesignationAudit(action, id, meta, des.status, status);
    return { success: true, linkedUsers };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteDesignation(
  id: string,
  des: Designation,
  meta: DesignationAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  const linked = await countUsersWithDesignation(des);
  if (linked > 0) {
    return { success: false, error: `Cannot delete designation: ${linked} user(s) are linked` };
  }

  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.designations, id, { isDeleted: true, status: 'Inactive' }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Designation Master',
      oldValue: JSON.stringify(des),
    });
    await logDesignationAudit('DELETE_DESIGNATION', id, meta, des, { isDeleted: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function fetchDesignationAuditTrail(recordId: string) {
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

export function exportDesignationsCsv(designations: Designation[]): string {
  const headers = [
    'Designation ID', 'Code', 'Name', 'Department', 'Level',
    'Approval Authority', 'Can Review', 'Can Approve', 'Can E-Sign', 'Status',
  ];
  const rows = designations.map((d) => [
    d.designationId, d.designationCode, d.designationName, d.department,
    d.designationLevel, d.approvalAuthority, d.canReview, d.canApprove, d.canESign, d.status,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logDesignationExport(meta: DesignationAuditMeta, count: number) {
  await logDesignationAudit('EXPORT_DESIGNATION_LIST', 'export', meta, null, { count });
}
