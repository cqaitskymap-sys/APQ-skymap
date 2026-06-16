import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { AdminUser, Department, DepartmentFormData } from './schemas';

export interface DepartmentAuditMeta {
  userId: string;
  userName: string;
}

async function logDepartmentAudit(
  action: string,
  recordId: string,
  meta: DepartmentAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Department Master',
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
    collectionName: ADMIN_COLLECTIONS.departments,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Department Master',
  });
}

export function buildDepartmentId(code: string): string {
  return `DEPT-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export async function fetchDepartments(): Promise<Department[]> {
  try {
    const records = await getAdminRecords<Department>(ADMIN_COLLECTIONS.departments);
    return records.filter((d) => !d.isDeleted);
  } catch {
    return [];
  }
}

export async function fetchDepartmentById(id: string): Promise<Department | null> {
  const departments = await fetchDepartments();
  return departments.find((d) => d.id === id) ?? null;
}

export async function fetchActiveUsers(): Promise<AdminUser[]> {
  try {
    const users = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return users.filter((u) => !u.isDeleted && u.userStatus === 'Active');
  } catch {
    return [];
  }
}

export async function fetchCompanySites(): Promise<{ siteName: string; id?: string }[]> {
  try {
    return await getAdminRecords<{ siteName: string; id?: string }>(ADMIN_COLLECTIONS.companySites);
  } catch {
    return [];
  }
}

export function departmentMatchesUser(dept: Department, userDept: string): boolean {
  if (!userDept) return false;
  return userDept === dept.departmentName ||
    userDept === dept.departmentCode ||
    userDept === dept.departmentId;
}

export async function countUsersInDepartment(dept: Department): Promise<number> {
  try {
    const users = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return users.filter((u) => !u.isDeleted && departmentMatchesUser(dept, u.department)).length;
  } catch {
    return 0;
  }
}

export async function fetchUsersInDepartment(dept: Department): Promise<AdminUser[]> {
  try {
    const users = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return users.filter((u) => !u.isDeleted && departmentMatchesUser(dept, u.department));
  } catch {
    return [];
  }
}

export async function isDepartmentActiveForAssignment(departmentName: string): Promise<boolean> {
  const departments = await fetchDepartments();
  const dept = departments.find(
    (d) => d.departmentName === departmentName || d.departmentCode === departmentName,
  );
  if (!dept) return true;
  return dept.status === 'Active';
}

export function validateDepartmentHead(
  headName: string,
  activeUsers: AdminUser[],
): { valid: boolean; email?: string; error?: string } {
  if (!headName) return { valid: false, error: 'Department head must be selected from active users' };
  const user = activeUsers.find(
    (u) => u.fullName === headName || u.id === headName || u.userId === headName,
  );
  if (!user) return { valid: false, error: 'Department head must be an active user' };
  return { valid: true, email: user.email };
}

export async function createDepartment(
  data: DepartmentFormData,
  meta: DepartmentAuditMeta,
): Promise<{ department: Department | null; error: string | null }> {
  try {
    const codeUnique = await checkUniqueField(ADMIN_COLLECTIONS.departments, 'departmentCode', data.departmentCode);
    if (!codeUnique) return { department: null, error: 'Department code already exists' };

    const nameUnique = await checkUniqueField(ADMIN_COLLECTIONS.departments, 'departmentName', data.departmentName);
    if (!nameUnique) return { department: null, error: 'Department name already exists' };

    const activeUsers = await fetchActiveUsers();
    const headCheck = validateDepartmentHead(data.departmentHead, activeUsers);
    if (!headCheck.valid) return { department: null, error: headCheck.error ?? 'Invalid department head' };

    const departmentId = buildDepartmentId(data.departmentCode);
    const payload = {
      departmentId,
      departmentCode: data.departmentCode,
      departmentName: data.departmentName,
      departmentType: data.departmentType,
      departmentHead: data.departmentHead,
      hodEmail: data.hodEmail || headCheck.email || '',
      siteLocation: data.siteLocation,
      description: data.description,
      status: data.status,
      createdBy: meta.userId,
      updatedBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.departments, payload as Omit<Department, 'id'>, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Department Master',
      action: 'CREATE_DEPARTMENT',
    });

    await logDepartmentAudit('CREATE_DEPARTMENT', created.id || departmentId, meta, null, payload);
    return { department: created, error: null };
  } catch (e) {
    return { department: null, error: (e as Error).message };
  }
}

export async function updateDepartment(
  id: string,
  data: DepartmentFormData,
  existing: Department,
  meta: DepartmentAuditMeta,
): Promise<{ department: Department | null; error: string | null }> {
  try {
    if (data.departmentCode !== existing.departmentCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.departments, 'departmentCode', data.departmentCode, id);
      if (!unique) return { department: null, error: 'Department code already exists' };
    }
    if (data.departmentName !== existing.departmentName) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.departments, 'departmentName', data.departmentName, id);
      if (!unique) return { department: null, error: 'Department name already exists' };
    }

    const activeUsers = await fetchActiveUsers();
    const headCheck = validateDepartmentHead(data.departmentHead, activeUsers);
    if (!headCheck.valid) return { department: null, error: headCheck.error ?? 'Invalid department head' };

    const updates: Partial<Department> = {
      departmentCode: data.departmentCode,
      departmentName: data.departmentName,
      departmentType: data.departmentType,
      departmentHead: data.departmentHead,
      hodEmail: data.hodEmail || headCheck.email || '',
      siteLocation: data.siteLocation,
      description: data.description,
      status: data.status,
    };

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.departments, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Department Master',
      oldValue: JSON.stringify(existing),
    });

    if (existing.departmentHead !== data.departmentHead) {
      await logDepartmentAudit('DEPARTMENT_HEAD_CHANGE', id, meta, existing.departmentHead, data.departmentHead);
    }
    await logDepartmentAudit('EDIT_DEPARTMENT', id, meta, existing, updates);
    return { department: updated, error: null };
  } catch (e) {
    return { department: null, error: (e as Error).message };
  }
}

export async function setDepartmentStatus(
  id: string,
  dept: Department,
  status: 'Active' | 'Inactive',
  meta: DepartmentAuditMeta,
): Promise<{ success: boolean; error?: string; linkedUsers?: number }> {
  const linkedUsers = await countUsersInDepartment(dept);

  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.departments, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Department Master',
      oldValue: JSON.stringify(dept),
    });

    const action = status === 'Active' ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED';
    await logDepartmentAudit(action, id, meta, dept.status, status);
    return { success: true, linkedUsers };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteDepartment(
  id: string,
  dept: Department,
  meta: DepartmentAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  const linked = await countUsersInDepartment(dept);
  if (linked > 0) {
    return { success: false, error: `Cannot delete department: ${linked} user(s) are linked` };
  }

  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.departments, id, { isDeleted: true, status: 'Inactive' }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Department Master',
      oldValue: JSON.stringify(dept),
    });
    await logDepartmentAudit('DELETE_DEPARTMENT', id, meta, dept, { isDeleted: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function linkUsersToDepartment(
  dept: Department,
  userIds: string[],
  meta: DepartmentAuditMeta,
): Promise<{ success: boolean; error?: string; count?: number }> {
  if (dept.status !== 'Active') {
    return { success: false, error: 'Cannot assign users to an inactive department' };
  }

  try {
    const users = await fetchUsers();
    let count = 0;
    for (const uid of userIds) {
      const user = users.find((u) => u.id === uid);
      if (!user) continue;
      await updateAdminRecord(ADMIN_COLLECTIONS.users, uid, { department: dept.departmentName }, {
        userId: meta.userId,
        userName: meta.userName,
        module: 'Department Master',
        oldValue: JSON.stringify({ department: user.department }),
      });
      count += 1;
    }
    if (count) {
      await logDepartmentAudit('LINK_USERS', dept.id || '', meta, null, { userIds, department: dept.departmentName });
    }
    return { success: true, count };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function fetchUsers(): Promise<AdminUser[]> {
  try {
    const records = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return records.filter((u) => !u.isDeleted);
  } catch {
    return [];
  }
}

export async function fetchDepartmentAuditTrail(recordId: string) {
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

export function exportDepartmentsCsv(departments: Department[]): string {
  const headers = [
    'Department ID', 'Code', 'Name', 'Type', 'Head', 'HOD Email',
    'Site', 'Status', 'Description',
  ];
  const rows = departments.map((d) => [
    d.departmentId, d.departmentCode, d.departmentName, d.departmentType,
    d.departmentHead, d.hodEmail, d.siteLocation, d.status, d.description,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logDepartmentExport(meta: DepartmentAuditMeta, count: number) {
  await logDepartmentAudit('EXPORT_DEPARTMENT_LIST', 'export', meta, null, { count });
}
