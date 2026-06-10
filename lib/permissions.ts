import {
  ADMIN_MODULES, PERMISSION_ACTIONS, ADMIN_ROLES, ADMIN_COLLECTIONS,
} from './admin/constants';
import type { PermissionMatrix } from './admin/schemas';

export type AdminRoleId = typeof ADMIN_ROLES[number]['id'];
export type AdminModule = typeof ADMIN_MODULES[number];
export type PermissionAction = typeof PERMISSION_ACTIONS[number];

const LEGACY_ROLE_MAP: Record<string, AdminRoleId> = {
  super_admin: 'super_admin',
  admin: 'admin',
  qa: 'qa_manager',
  qc: 'qc_manager',
  production: 'production_manager',
  engineering: 'engineering_manager',
  warehouse: 'warehouse_manager',
  regulatory: 'regulatory_affairs',
  auditor: 'auditor',
  viewer: 'viewer',
};

export function normalizeRole(role?: string | null): AdminRoleId {
  if (!role) return 'viewer';
  return (LEGACY_ROLE_MAP[role] || role) as AdminRoleId;
}

function buildDefaultPermissions(roleId: AdminRoleId): Record<AdminModule, Record<PermissionAction, boolean>> {
  const matrix = {} as Record<AdminModule, Record<PermissionAction, boolean>>;
  const isSuperAdmin = roleId === 'super_admin';
  const isAdmin = roleId === 'admin' || isSuperAdmin;
  const isAuditor = roleId === 'auditor' || roleId === 'viewer';
  const isDeptHead = ['head_qa', 'qa_manager', 'qc_manager', 'production_manager',
    'warehouse_manager', 'engineering_manager'].includes(roleId);

  for (const mod of ADMIN_MODULES) {
    matrix[mod] = {} as Record<PermissionAction, boolean>;
    for (const action of PERMISSION_ACTIONS) {
      if (isSuperAdmin) {
        matrix[mod][action] = true;
      } else if (isAdmin) {
        matrix[mod][action] = mod !== 'Admin' || action !== 'delete';
      } else if (isAuditor) {
        matrix[mod][action] = action === 'view' || action === 'export';
      } else if (isDeptHead) {
        matrix[mod][action] = ['view', 'create', 'edit', 'review', 'export'].includes(action);
      } else {
        matrix[mod][action] = ['view', 'create', 'edit'].includes(action) &&
          !['Admin'].includes(mod);
      }
    }
  }
  return matrix;
}

export function getDefaultPermissionMatrix(roleId: AdminRoleId): PermissionMatrix {
  const role = ADMIN_ROLES.find((r) => r.id === roleId);
  return {
    roleId,
    roleName: role?.name || roleId,
    permissions: buildDefaultPermissions(roleId),
    status: 'Active',
    createdBy: 'system',
    updatedBy: 'system',
  };
}

export function canAccessAdminPanel(role?: string | null): boolean {
  const r = normalizeRole(role);
  return !['viewer'].includes(r) || r === 'auditor';
}

export function canManageRoles(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function canManagePermissions(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function canDeleteRecords(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function canChangeSystemSettings(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function canRestoreBackup(role?: string | null): boolean {
  return normalizeRole(role) === 'super_admin';
}

export function canManageUsers(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin'].includes(r);
}

export function canManageMasterData(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(r);
}

export function isReadOnlyRole(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['auditor', 'viewer'].includes(r);
}

export function hasPermission(
  permissions: PermissionMatrix | null | undefined,
  module: AdminModule,
  action: PermissionAction,
  role?: string | null
): boolean {
  if (canManagePermissions(role)) return true;
  if (isReadOnlyRole(role)) return action === 'view' || action === 'export';
  if (!permissions?.permissions?.[module]) {
    const defaults = buildDefaultPermissions(normalizeRole(role));
    return defaults[module]?.[action] ?? false;
  }
  return permissions.permissions[module]?.[action] ?? false;
}

export function canViewDepartmentUsers(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager',
    'production_manager', 'warehouse_manager', 'engineering_manager'].includes(r);
}

export { ADMIN_COLLECTIONS, ADMIN_MODULES, PERMISSION_ACTIONS, ADMIN_ROLES };
