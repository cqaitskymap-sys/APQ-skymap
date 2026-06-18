'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  resolveUserPermissions,
  canAccessModuleFromMatrix,
  canPerformActionFromMatrix,
  canViewDashboard,
  logAccessDenied,
  type PermissionMatrixData,
} from '@/services/permissionService';
import {
  normalizeRole,
  isReadOnlyRole,
  canAccessAdminPanel,
  canManageUsers,
  type AppModule,
  type PermissionAction,
  type AdminModule,
  hasPermission,
} from '@/lib/permissions';
import type { PermissionMatrix } from '@/lib/admin/schemas';

export function usePermissions() {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [matrix, setMatrix] = useState<PermissionMatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid) {
        setMatrix(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const perms = await resolveUserPermissions(user.uid, profile?.role);
        if (!cancelled) setMatrix(perms);
      } catch {
        if (!cancelled) setMatrix(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.uid, profile?.role]);

  const permissionsMatrix = useMemo((): PermissionMatrix | null => {
    if (!matrix) return null;
    return {
      roleId: role,
      roleName: role,
      permissions: matrix,
      status: 'Active',
      createdBy: 'system',
      updatedBy: 'system',
    };
  }, [matrix, role]);

  const canAccessModule = useCallback(
    (module: AppModule) => canAccessModuleFromMatrix(matrix, module, profile?.role),
    [matrix, profile?.role],
  );

  const canPerformAction = useCallback(
    (module: AppModule, action: PermissionAction) =>
      canPerformActionFromMatrix(matrix, module, action, profile?.role),
    [matrix, profile?.role],
  );

  const hasAdminPermission = useCallback(
    (module: AdminModule, action: PermissionAction) =>
      hasPermission(permissionsMatrix, module, action, profile?.role),
    [permissionsMatrix, profile?.role],
  );

  const logDenied = useCallback(
    (module: string, path: string) => {
      if (!user?.uid) return;
      void logAccessDenied({
        userId: user.uid,
        userName: profile?.full_name || profile?.email || 'User',
        module,
        path,
      });
    },
    [user?.uid, profile?.full_name, profile?.email],
  );

  return {
    loading,
    role,
    matrix,
    permissions: permissionsMatrix,
    isSuperAdmin: role === 'super_admin',
    isReadOnly: isReadOnlyRole(profile?.role),
    canAccessAdmin: canAccessAdminPanel(profile?.role) && canAccessModule('admin'),
    canManageUsers: canManageUsers(profile?.role),
    canViewDashboard: canViewDashboard(matrix, profile?.role),
    canAccessModule,
    canPerformAction,
    hasAdminPermission,
    canView: (module: AppModule) => canPerformAction(module, 'view'),
    canCreate: (module: AppModule) => canPerformAction(module, 'create'),
    canEdit: (module: AppModule) => canPerformAction(module, 'edit'),
    canDelete: (module: AppModule) => canPerformAction(module, 'delete'),
    canApprove: (module: AppModule) => canPerformAction(module, 'approve'),
    canExport: (module: AppModule) => canPerformAction(module, 'export'),
    logDenied,
  };
}
