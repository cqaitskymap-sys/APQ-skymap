import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import { writeAuditTrail } from '@/lib/audit-trail';
import {
  buildDefaultRoleMatrix, canEditSuperAdminRole,
} from '@/lib/permissions';
import type { AdminRole, PermissionMatrix, RoleFormData } from './schemas';

export interface RoleAuditMeta {
  userId: string;
  userName: string;
}

async function logRoleAudit(
  action: string,
  recordId: string,
  meta: RoleAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Role Management',
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
    collectionName: ADMIN_COLLECTIONS.roles,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Role Management',
  });
}

export function enforceSuperAdminMatrix(
  roleId: string,
  permissions: Record<string, Record<string, boolean>>,
): Record<string, Record<string, boolean>> {
  if (roleId !== 'super_admin') return permissions;
  return buildDefaultRoleMatrix('super_admin');
}

export function countPermissionChanges(
  oldPerms: Record<string, Record<string, boolean>>,
  newPerms: Record<string, Record<string, boolean>>,
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  const allMods = new Set([...Object.keys(oldPerms), ...Object.keys(newPerms)]);
  allMods.forEach((mod) => {
    const oldM = oldPerms[mod] || {};
    const newM = newPerms[mod] || {};
    const actions = new Set([...Object.keys(oldM), ...Object.keys(newM)]);
    actions.forEach((a) => {
      if (!oldM[a] && newM[a]) added += 1;
      if (oldM[a] && !newM[a]) removed += 1;
    });
  });
  return { added, removed };
}

export async function fetchRoles(): Promise<AdminRole[]> {
  try {
    const records = await getAdminRecords<AdminRole>(ADMIN_COLLECTIONS.roles);
    return records.filter((r) => !r.isDeleted);
  } catch {
    return [];
  }
}

export async function fetchRoleById(id: string): Promise<AdminRole | null> {
  const roles = await fetchRoles();
  return roles.find((r) => r.id === id) ?? null;
}

export async function fetchRolePermissions(roleId: string): Promise<PermissionMatrix | null> {
  try {
    const all = await getAdminRecords<PermissionMatrix>(ADMIN_COLLECTIONS.permissions);
    return all.find((p) => p.roleId === roleId) ?? null;
  } catch {
    return null;
  }
}

export async function fetchRoleWithPermissions(id: string): Promise<{
  role: AdminRole | null;
  permissions: PermissionMatrix | null;
}> {
  const role = await fetchRoleById(id);
  if (!role) return { role: null, permissions: null };
  const permissions = await fetchRolePermissions(role.roleId);
  return { role, permissions };
}

export async function countUsersWithRole(roleId: string): Promise<number> {
  try {
    const users = await getAdminRecords<{ role?: string }>(ADMIN_COLLECTIONS.users);
    return users.filter((u) => u.role === roleId).length;
  } catch {
    return 0;
  }
}

export function canModifyRole(
  currentRole: string,
  targetRoleId: string,
): { allowed: boolean; reason?: string } {
  if (targetRoleId === 'super_admin' && !canEditSuperAdminRole(currentRole)) {
    return { allowed: false, reason: 'Only Super Admin can modify the Super Admin role.' };
  }
  if (currentRole === 'admin' && targetRoleId === 'super_admin') {
    return { allowed: false, reason: 'Admin cannot grant or modify Super Admin permissions.' };
  }
  return { allowed: true };
}

export async function createRole(
  data: RoleFormData,
  meta: RoleAuditMeta,
  currentRole: string,
): Promise<{ role: AdminRole | null; error: string | null }> {
  const check = canModifyRole(currentRole, data.roleId);
  if (!check.allowed) return { role: null, error: check.reason ?? 'Action not allowed' };

  try {
    const nameUnique = await checkUniqueField(ADMIN_COLLECTIONS.roles, 'roleName', data.roleName);
    if (!nameUnique) return { role: null, error: 'Role name already exists' };

    const permissions = enforceSuperAdminMatrix(data.roleId, data.permissions);

    const rolePayload = {
      roleId: data.roleId,
      roleName: data.roleName,
      roleDescription: data.roleDescription,
      description: data.roleDescription,
      roleLevel: data.roleLevel,
      level: data.roleLevel,
      departmentAccess: data.departmentAccess,
      status: data.status,
      createdBy: meta.userId,
      updatedBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.roles, rolePayload as Omit<AdminRole, 'id'>, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Role Management',
      action: 'CREATE_ROLE',
    });

    const permPayload: Omit<PermissionMatrix, 'id'> = {
      roleId: data.roleId,
      roleName: data.roleName,
      permissions,
      status: data.status,
      createdBy: meta.userId,
      updatedBy: meta.userId,
    };

    await createAdminRecord(ADMIN_COLLECTIONS.permissions, permPayload, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Role Management',
      action: 'CREATE_PERMISSIONS',
    });

    await logRoleAudit('CREATE_ROLE', created.id || data.roleId, meta, null, { role: rolePayload, permissions });
    return { role: created, error: null };
  } catch (e) {
    return { role: null, error: (e as Error).message };
  }
}

export async function updateRole(
  id: string,
  data: RoleFormData,
  existing: AdminRole,
  existingPerms: PermissionMatrix | null,
  meta: RoleAuditMeta,
  currentRole: string,
): Promise<{ role: AdminRole | null; error: string | null; affectedUsers: number }> {
  const check = canModifyRole(currentRole, existing.roleId);
  if (!check.allowed) return { role: null, error: check.reason ?? 'Action not allowed', affectedUsers: 0 };

  if (data.roleName !== existing.roleName) {
    const nameUnique = await checkUniqueField(ADMIN_COLLECTIONS.roles, 'roleName', data.roleName, id);
    if (!nameUnique) return { role: null, error: 'Role name already exists', affectedUsers: 0 };
  }

  try {
    let permissions = enforceSuperAdminMatrix(existing.roleId, data.permissions);
    const oldPerms = existingPerms?.permissions || {};

    if (existing.roleId === 'super_admin') {
      permissions = buildDefaultRoleMatrix('super_admin');
    }

    const roleUpdates: Partial<AdminRole> = {
      roleName: data.roleName,
      roleDescription: data.roleDescription,
      description: data.roleDescription,
      roleLevel: data.roleLevel,
      level: data.roleLevel,
      departmentAccess: data.departmentAccess,
      status: data.status,
    };

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.roles, id, roleUpdates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Role Management',
      oldValue: JSON.stringify(existing),
    });

    const permData: Partial<PermissionMatrix> = {
      roleName: data.roleName,
      permissions,
      status: data.status,
    };

    if (existingPerms?.id) {
      await updateAdminRecord(ADMIN_COLLECTIONS.permissions, existingPerms.id, permData, {
        userId: meta.userId,
        userName: meta.userName,
        module: 'Role Management',
        oldValue: JSON.stringify(existingPerms),
      });
    } else {
      await createAdminRecord(ADMIN_COLLECTIONS.permissions, {
        roleId: existing.roleId,
        roleName: data.roleName,
        permissions,
        status: data.status,
        createdBy: meta.userId,
        updatedBy: meta.userId,
      } as Omit<PermissionMatrix, 'id'>, {
        userId: meta.userId,
        userName: meta.userName,
        module: 'Role Management',
        action: 'CREATE_PERMISSIONS',
      });
    }

    const changes = countPermissionChanges(oldPerms, permissions);
    if (changes.added) await logRoleAudit('PERMISSION_ADDED', id, meta, oldPerms, { added: changes.added });
    if (changes.removed) await logRoleAudit('PERMISSION_REMOVED', id, meta, oldPerms, { removed: changes.removed });
    await logRoleAudit('EDIT_ROLE', id, meta, existing, { ...roleUpdates, permissions });

    const affectedUsers = await countUsersWithRole(existing.roleId);
    return { role: updated, error: null, affectedUsers };
  } catch (e) {
    return { role: null, error: (e as Error).message, affectedUsers: 0 };
  }
}

export async function setRoleStatus(
  id: string,
  role: AdminRole,
  status: 'Active' | 'Inactive',
  meta: RoleAuditMeta,
  currentRole: string,
): Promise<{ success: boolean; error?: string }> {
  if (role.roleId === 'super_admin') {
    return { success: false, error: 'Super Admin role cannot be deactivated' };
  }
  const check = canModifyRole(currentRole, role.roleId);
  if (!check.allowed) return { success: false, error: check.reason ?? 'Action not allowed' };

  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.roles, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Role Management',
      oldValue: JSON.stringify(role),
    });
    const action = status === 'Active' ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED';
    await logRoleAudit(action, id, meta, role.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function fetchRoleAuditTrail(recordId: string) {
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

export function exportRolesCsv(roles: AdminRole[]): string {
  const headers = ['Role ID', 'Role Name', 'Level', 'Department Access', 'Status'];
  const rows = roles.map((r) => [
    r.roleId, r.roleName, r.roleLevel ?? r.level, r.departmentAccess, r.status,
  ]);
  return [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
}
