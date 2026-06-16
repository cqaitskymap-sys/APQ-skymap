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
  const { role } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<RoleFormData | null>(null);

  if (!canEditRoles(role)) {
    return <ErrorCard accessDenied title="Access Denied" message="Only Super Admin and Admin can create roles." />;
  }

  const submit = async (data: RoleFormData) => {
    setSubmitting(true);
    const result = await createRole(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    }, role);
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Role created successfully');
    router.push(`/admin/roles/${result.role?.id}`);
  };

  const onSubmit = (data: RoleFormData) => {
    setPendingData(data);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Role" description="Define a new role and permission matrix" basePath="/admin" />
      <RoleForm
        onSubmit={onSubmit}
        onCancel={() => router.push('/admin/roles')}
        submitting={submitting}
      />
      <AlertDialog open={!!pendingData} onOpenChange={() => setPendingData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Creation</AlertDialogTitle>
            <AlertDialogDescription>
              Create role &quot;{pendingData?.roleName}&quot; with the configured permissions?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600"
              onClick={() => pendingData && submit(pendingData)}
            >
              Create Role
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
