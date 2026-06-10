'use client';

import { ReactNode } from 'react';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import type { AdminModule, PermissionAction } from '@/lib/permissions';

interface PermissionGateProps {
  module: AdminModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const { hasPermission: check, loading } = useAdminPermissions();
  if (loading) return null;
  if (!check(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}
