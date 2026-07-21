'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RoleAccessGuard } from '@/components/admin/roles/role-access-guard';
import { RoleForm } from '@/components/admin/roles/role-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditRoles } from '@/lib/permissions';
import { createRole } from '@/lib/admin/role-service';
import type { RoleFormData } from '@/lib/admin/schemas';

function CreateRoleContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role, hasPermission } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<RoleFormData | null>(null);

  if (!canEditRoles(role) || !hasPermission('Admin', 'create')) {
    return <ErrorCard accessDenied title="Access Denied" message="Only Super Admin and Admin can create roles." />;
  }

  const submit = async (data: RoleFormData) => {
    setSubmitting(true);
    const result = await createRole(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
      role,
    }, role);
    setSubmitting(false);
    setPendingData(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Role created successfully');
    router.push(`/admin/roles/${result.role?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Role" description="Define a new role, scopes, and permission matrix" basePath="/admin" />
      <RoleForm
        onSubmit={(data) => setPendingData(data)}
        onCancel={() => router.push('/admin/roles')}
        submitting={submitting}
      />
      <AlertDialog open={!!pendingData} onOpenChange={() => !submitting && setPendingData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Creation</AlertDialogTitle>
            <AlertDialogDescription>
              Create role &quot;{pendingData?.roleName}&quot; with the configured permissions?
              Reason: {pendingData?.changeReason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600"
              disabled={submitting}
              onClick={() => pendingData && submit(pendingData)}
            >
              {submitting ? 'Creating…' : 'Create Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CreateRolePage() {
  return (
    <RoleAccessGuard>
      <CreateRoleContent />
    </RoleAccessGuard>
  );
}
