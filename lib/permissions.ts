import {
  ADMIN_MODULES, PERMISSION_ACTIONS, ADMIN_ROLES, ADMIN_COLLECTIONS,
} from './admin/constants';
import type { PermissionMatrix } from './admin/schemas';
import type { UserRole } from './firebase';

export type AdminRoleId = typeof ADMIN_ROLES[number]['id'];
export type AdminModule = typeof ADMIN_MODULES[number];
export type PermissionAction = typeof PERMISSION_ACTIONS[number];

/** Maps Firebase auth roles to internal admin role IDs */
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
  head_qa: 'head_qa',
  qa_manager: 'qa_manager',
  qc_manager: 'qc_manager',
  production_manager: 'production_manager',
  engineering_manager: 'engineering_manager',
  warehouse_manager: 'warehouse_manager',
  regulatory_affairs: 'regulatory_affairs',
};

export const ROLE_DEFINITIONS: { id: UserRole; label: string; description: string }[] = [
  { id: 'super_admin', label: 'Super Admin', description: 'Full system access' },
  { id: 'admin', label: 'Admin', description: 'Admin panel and master data management' },
  { id: 'qa', label: 'QA', description: 'QMS, PQR, CPV review and approval' },
  { id: 'qc', label: 'QC', description: 'Testing, CQA, and OOS management' },
  { id: 'production', label: 'Production', description: 'Batch records, eBMR, and CPP entry' },
  { id: 'engineering', label: 'Engineering', description: 'Equipment, utility, and validation' },
  { id: 'warehouse', label: 'Warehouse', description: 'Material, inventory, and dispensing' },
  { id: 'regulatory', label: 'Regulatory', description: 'Change control, recall, and documents' },
  { id: 'auditor', label: 'Auditor', description: 'Read-only access across modules' },
];

export function normalizeRole(role?: string | null): AdminRoleId {
  if (!role) return 'viewer';
  return (LEGACY_ROLE_MAP[role] || role) as AdminRoleId;
}

function buildDefaultPermissions(roleId: AdminRoleId): Record<AdminModule, Record<PermissionAction, boolean>> {
  const matrix = {} as Record<AdminModule, Record<PermissionAction, boolean>>;
  const isSuperAdmin = roleId === 'super_admin';
  const isAdmin = roleId === 'admin' || isSuperAdmin;
  const isAuditor = roleId === 'auditor' || roleId === 'viewer';
  const isQa = ['head_qa', 'qa_manager', 'qa_executive'].includes(roleId);
  const isQc = ['qc_manager', 'qc_executive'].includes(roleId);
  const isProduction = ['production_manager', 'production_executive'].includes(roleId);
  const isEngineering = ['engineering_manager', 'engineering_executive'].includes(roleId);
  const isWarehouse = ['warehouse_manager', 'warehouse_executive'].includes(roleId);
  const isRegulatory = roleId === 'regulatory_affairs';

  for (const mod of ADMIN_MODULES) {
    matrix[mod] = {} as Record<PermissionAction, boolean>;
    for (const action of PERMISSION_ACTIONS) {
      if (isSuperAdmin) {
        matrix[mod][action] = true;
      } else if (isAdmin) {
        matrix[mod][action] = mod !== 'Admin' || action !== 'delete';
      } else if (isAuditor) {
        matrix[mod][action] = action === 'view' || action === 'export';
      } else if (isQa) {
        matrix[mod][action] = ['Dashboard', 'PQR', 'CPV', 'CPP', 'CQA', 'Deviation', 'CAPA', 'Change Control',
          'Complaint', 'Recall', 'Stability', 'Document', 'Training', 'Reports'].includes(mod)
          ? ['view', 'create', 'edit', 'review', 'approve', 'reject', 'export', 'eSign'].includes(action)
          : action === 'view' || action === 'export';
      } else if (isQc) {
        matrix[mod][action] = ['Dashboard', 'CQA', 'OOS', 'CPV', 'Batch', 'Stability', 'Reports'].includes(mod)
          ? ['view', 'create', 'edit', 'review', 'export'].includes(action)
          : action === 'view';
      } else if (isProduction) {
        matrix[mod][action] = ['Dashboard', 'Batch', 'CPP', 'CPV', 'Product'].includes(mod)
          ? ['view', 'create', 'edit', 'export'].includes(action)
          : action === 'view';
      } else if (isEngineering) {
        matrix[mod][action] = ['Dashboard', 'Equipment', 'Validation', 'CPV'].includes(mod)
          ? ['view', 'create', 'edit', 'export'].includes(action)
          : action === 'view';
      } else if (isWarehouse) {
        matrix[mod][action] = ['Dashboard', 'Material', 'Vendor', 'Batch'].includes(mod)
          ? ['view', 'create', 'edit', 'export'].includes(action)
          : action === 'view';
      } else if (isRegulatory) {
        matrix[mod][action] = ['Dashboard', 'Change Control', 'Recall', 'Document', 'PQR', 'Complaint'].includes(mod)
          ? ['view', 'create', 'edit', 'review', 'approve', 'export'].includes(action)
          : action === 'view';
      } else {
        matrix[mod][action] = ['view', 'create', 'edit'].includes(action) && !['Admin'].includes(mod);
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
  return r !== 'viewer';
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
  role?: string | null,
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

export type AppModule =
  | 'admin' | 'cpv' | 'pqr' | 'qms' | 'deviation' | 'oos' | 'capa' | 'change_control'
  | 'stability' | 'complaints' | 'recall' | 'dms' | 'training' | 'audit' | 'vendors'
  | 'validation' | 'csv' | 'equipment' | 'monitoring' | 'warehouse' | 'ebmr';

const MODULE_ROLE_ACCESS: Record<AppModule, AdminRoleId[]> = {
  admin: ['super_admin', 'admin'],
  cpv: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager', 'production_manager'],
  pqr: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager', 'regulatory_affairs'],
  qms: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager', 'production_manager',
    'warehouse_manager', 'engineering_manager', 'regulatory_affairs'],
  deviation: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'production_manager', 'regulatory_affairs'],
  oos: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager'],
  capa: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager', 'production_manager'],
  change_control: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'regulatory_affairs'],
  stability: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qc_manager'],
  complaints: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'regulatory_affairs'],
  recall: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'regulatory_affairs'],
  dms: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'regulatory_affairs'],
  training: ['super_admin', 'admin', 'head_qa', 'qa_manager'],
  audit: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'auditor'],
  vendors: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'warehouse_manager'],
  validation: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'engineering_manager'],
  csv: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'engineering_manager'],
  equipment: ['super_admin', 'admin', 'engineering_manager', 'production_manager'],
  monitoring: ['super_admin', 'admin', 'engineering_manager', 'qc_manager'],
  warehouse: ['super_admin', 'admin', 'warehouse_manager', 'production_manager'],
  ebmr: ['super_admin', 'admin', 'production_manager', 'warehouse_manager', 'head_qa', 'qa_manager', 'qc_manager', 'engineering_manager'],
};

export function canAccessModule(role: string | null | undefined, module: AppModule): boolean {
  const r = normalizeRole(role);
  if (r === 'super_admin') return true;
  if (['auditor', 'viewer'].includes(r)) {
    return ['audit', 'qms', 'pqr', 'dms', 'training', 'stability', 'complaints', 'recall',
      'deviation', 'oos', 'capa', 'change_control', 'cpv', 'vendors', 'validation', 'csv',
      'equipment', 'monitoring', 'warehouse', 'ebmr'].includes(module);
  }
  return MODULE_ROLE_ACCESS[module]?.includes(r) ?? false;
}

export function canEditModule(role: string | null | undefined, module: AppModule): boolean {
  if (isReadOnlyRole(role)) return false;
  return canAccessModule(role, module);
}

export { ADMIN_COLLECTIONS, ADMIN_MODULES, PERMISSION_ACTIONS, ADMIN_ROLES };
