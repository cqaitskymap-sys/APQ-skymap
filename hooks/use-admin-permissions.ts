'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  hasPermission, normalizeRole, canManageRoles, canManagePermissions,
  canDeleteRecords, canChangeSystemSettings, canRestoreBackup,
  canManageUsers, canManageMasterData, isReadOnlyRole, canAccessAdminPanel,
  type AdminModule, type PermissionAction,
} from '@/lib/permissions';
import { getRecords } from '@/lib/firestore-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import type { PermissionMatrix } from '@/lib/admin/schemas';

export function useAdminPermissions() {
  const { profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [permissions, setPermissions] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.role) {
        setLoading(false);
        return;
      }
      try {
        const all = await getRecords<PermissionMatrix>(ADMIN_COLLECTIONS.permissions);
        const match = all.find((p) => p.roleId === role);
        setPermissions(match || null);
      } catch {
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile?.role, role]);

  return {
    role,
    permissions,
    loading,
    canAccessAdmin: canAccessAdminPanel(profile?.role),
    canManageRoles: canManageRoles(profile?.role),
    canManagePermissions: canManagePermissions(profile?.role),
    canDelete: canDeleteRecords(profile?.role),
    canChangeSystemSettings: canChangeSystemSettings(profile?.role),
    canRestoreBackup: canRestoreBackup(profile?.role),
    canManageUsers: canManageUsers(profile?.role),
    canManageMasterData: canManageMasterData(profile?.role),
    isReadOnly: isReadOnlyRole(profile?.role),
    hasPermission: (module: AdminModule, action: PermissionAction) =>
      hasPermission(permissions, module, action, profile?.role),
  };
}
