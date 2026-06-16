import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { shouldUseDemoAuth } from '@/lib/demo-auth-config';
import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import { isDepartmentActiveForAssignment } from './department-service';
import { isDesignationActiveForAssignment } from './designation-service';
import type { AdminUser } from './schemas';

export interface UserAuditMeta {
  userId: string;
  userName: string;
}

async function logUserAudit(
  action: string,
  recordId: string,
  meta: UserAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'User Management',
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
    collectionName: ADMIN_COLLECTIONS.users,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'User Management',
  });
}

export function canModifyTargetUser(
  currentRole: string,
  currentUid: string,
  target: AdminUser,
): { allowed: boolean; reason?: string } {
  if (target.authUid === currentUid || target.id === currentUid) {
    return { allowed: false, reason: 'You cannot modify your own account status.' };
  }
  const isSuperAdmin = currentRole === 'super_admin';
  const targetIsSuperAdmin = target.role === 'super_admin';
  if (targetIsSuperAdmin && !isSuperAdmin) {
    return { allowed: false, reason: 'Only Super Admin can modify Super Admin accounts.' };
  }
  return { allowed: true };
}

export async function fetchUsers(): Promise<AdminUser[]> {
  try {
    const records = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    return records.filter((u) => !u.isDeleted);
  } catch {
    return [];
  }
}

export async function fetchUserById(id: string): Promise<AdminUser | null> {
  const users = await fetchUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function fetchUserMasters() {
  const [departments, designations, roles] = await Promise.all([
    getAdminRecords<{ departmentName: string; departmentCode: string; status?: string }>(ADMIN_COLLECTIONS.departments).catch(() => []),
    getAdminRecords<{ designationName: string; designationCode: string; department: string; status?: string }>(ADMIN_COLLECTIONS.designations).catch(() => []),
    getAdminRecords<{ roleName: string; roleId: string }>(ADMIN_COLLECTIONS.roles).catch(() => []),
  ]);
  return { departments, designations, roles };
}

export async function createSystemUser(
  data: AdminUser,
  temporaryPassword: string,
  meta: UserAuditMeta,
): Promise<{ user: AdminUser | null; error: string | null }> {
  try {
    const emailUnique = await checkUniqueField(ADMIN_COLLECTIONS.users, 'email', data.email);
    const empUnique = await checkUniqueField(ADMIN_COLLECTIONS.users, 'employeeId', data.employeeId);
    if (!emailUnique) return { user: null, error: 'Email already exists' };
    if (!empUnique) return { user: null, error: 'Employee ID already exists' };

    if (!await isDepartmentActiveForAssignment(data.department)) {
      return { user: null, error: 'Cannot assign user to an inactive department' };
    }

    if (data.designation && !await isDesignationActiveForAssignment(data.designation)) {
      return { user: null, error: 'Cannot assign user to an inactive designation' };
    }

    let authUid = data.authUid;
    const useDemo = shouldUseDemoAuth();

    if (!useDemo && isFirebaseConfigured()) {
      if (!temporaryPassword || temporaryPassword.length < 8) {
        return { user: null, error: 'Temporary password required (min 8 characters)' };
      }
      const authResult = await createUserWithEmailAndPassword(getFirebaseAuth(), data.email, temporaryPassword);
      authUid = authResult.user.uid;
      await setDoc(doc(getFirebaseFirestore(), 'profiles', authUid), {
        id: authUid,
        full_name: data.fullName,
        email: data.email,
        role: data.role,
        department: data.department,
        employee_id: data.employeeId,
        phone: data.mobileNumber,
        is_active: data.userStatus === 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (useDemo) {
      authUid = `demo-${data.employeeId.toLowerCase()}`;
    }

    const userId = data.userId || `USR-${data.employeeId}`;
    const payload = {
      ...data,
      userId,
      authUid,
      accountLocked: data.accountLocked ?? false,
      status: data.userStatus === 'Active' ? 'Active' : 'Inactive',
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.users, payload as Omit<AdminUser, 'id'>, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'User Management',
      action: 'CREATE_USER',
    });

    await logUserAudit('CREATE_USER', created.id || '', meta, null, payload);
    return { user: created, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

export async function updateSystemUser(
  id: string,
  updates: Partial<AdminUser>,
  existing: AdminUser,
  meta: UserAuditMeta,
  action = 'EDIT_USER',
): Promise<{ user: AdminUser | null; error: string | null }> {
  try {
    if (updates.email && updates.email !== existing.email) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.users, 'email', updates.email, id);
      if (!unique) return { user: null, error: 'Email already exists' };
    }

    if (updates.department && updates.department !== existing.department) {
      if (!await isDepartmentActiveForAssignment(updates.department)) {
        return { user: null, error: 'Cannot assign user to an inactive department' };
      }
    }

    if (updates.designation && updates.designation !== existing.designation) {
      if (!await isDesignationActiveForAssignment(updates.designation)) {
        return { user: null, error: 'Cannot assign user to an inactive designation' };
      }
    }

    const record = await updateAdminRecord(ADMIN_COLLECTIONS.users, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'User Management',
      oldValue: JSON.stringify(existing),
    });

    if (existing.authUid && isFirebaseConfigured() && !shouldUseDemoAuth()) {
      await setDoc(doc(getFirebaseFirestore(), 'profiles', existing.authUid), {
        full_name: updates.fullName ?? existing.fullName,
        email: updates.email ?? existing.email,
        role: updates.role ?? existing.role,
        department: updates.department ?? existing.department,
        employee_id: updates.employeeId ?? existing.employeeId,
        phone: updates.mobileNumber ?? existing.mobileNumber,
        is_active: (updates.userStatus ?? existing.userStatus) === 'Active',
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }

    const auditAction = updates.role && updates.role !== existing.role ? 'ROLE_CHANGE' : action;
    await logUserAudit(auditAction, id, meta, existing, { ...existing, ...updates });
    return { user: record, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

export async function setUserStatus(
  target: AdminUser,
  userStatus: AdminUser['userStatus'],
  meta: UserAuditMeta,
  currentRole: string,
  currentUid: string,
): Promise<{ success: boolean; error?: string }> {
  const check = canModifyTargetUser(currentRole, currentUid, target);
  if (!check.allowed) return { success: false, error: check.reason };

  if (!target.id) return { success: false, error: 'Invalid user' };

  const updates: Partial<AdminUser> = {
    userStatus,
    status: userStatus === 'Active' ? 'Active' : 'Inactive',
    accountLocked: userStatus === 'Locked',
  };

  const result = await updateSystemUser(target.id, updates, target, meta, 'STATUS_CHANGE');
  return result.error ? { success: false, error: result.error } : { success: true };
}

export async function lockUser(
  target: AdminUser,
  locked: boolean,
  meta: UserAuditMeta,
  currentRole: string,
  currentUid: string,
): Promise<{ success: boolean; error?: string }> {
  const check = canModifyTargetUser(currentRole, currentUid, target);
  if (!check.allowed) return { success: false, error: check.reason };
  if (!target.id) return { success: false, error: 'Invalid user' };

  const updates: Partial<AdminUser> = {
    accountLocked: locked,
    userStatus: locked ? 'Locked' : target.userStatus === 'Locked' ? 'Active' : target.userStatus,
  };

  const result = await updateSystemUser(target.id, updates, target, meta, locked ? 'LOCK_USER' : 'UNLOCK_USER');
  return result.error ? { success: false, error: result.error } : { success: true };
}

export async function softDeleteUser(
  target: AdminUser,
  meta: UserAuditMeta,
  currentRole: string,
  currentUid: string,
): Promise<{ success: boolean; error?: string }> {
  const check = canModifyTargetUser(currentRole, currentUid, target);
  if (!check.allowed) return { success: false, error: check.reason };
  if (!target.id) return { success: false, error: 'Invalid user' };

  const result = await updateSystemUser(
    target.id,
    { userStatus: 'Inactive', status: 'Inactive', isDeleted: true },
    target,
    meta,
    'DEACTIVATE_USER',
  );
  return result.error ? { success: false, error: result.error } : { success: true };
}

export async function resetUserPassword(
  target: AdminUser,
  meta: UserAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  if (shouldUseDemoAuth()) {
    await updateAdminRecord(ADMIN_COLLECTIONS.users, target.id!, { passwordResetRequired: true }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'User Management',
    });
    await logUserAudit('PASSWORD_RESET', target.id!, meta, null, { email: target.email });
    return { success: true };
  }
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), target.email);
    await updateAdminRecord(ADMIN_COLLECTIONS.users, target.id!, { passwordResetRequired: true }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'User Management',
    });
    await logUserAudit('PASSWORD_RESET', target.id!, meta, null, { email: target.email });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function fetchUserLoginActivity(userId: string, email: string) {
  try {
    const logs = await getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.loginActivity);
    return logs
      .filter((l) => l.userId === userId || l.email === email)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export async function fetchUserAuditTrail(recordId: string) {
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

export function exportUsersCsv(users: AdminUser[]): string {
  const headers = ['User ID', 'Employee ID', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Role', 'Status', 'Last Login'];
  const rows = users.map((u) => [
    u.userId || u.id,
    u.employeeId,
    u.fullName,
    u.email,
    u.mobileNumber,
    u.department,
    u.designation,
    u.role,
    u.userStatus,
    u.lastLogin || '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
}
