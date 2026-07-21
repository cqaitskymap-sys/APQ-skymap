'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DepartmentAccessGuard } from '@/components/admin/departments/department-access-guard';
import { DepartmentForm } from '@/components/admin/departments/department-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDepartments } from '@/lib/permissions';
import { createDepartment } from '@/lib/admin/department-service';
import type { DepartmentFormData } from '@/lib/admin/schemas';

function CreateDepartmentContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role, hasPermission } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<DepartmentFormData | null>(null);

  if (!canEditDepartments(role) || !hasPermission('Admin', 'create')) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can create departments." />;
  }

  const submit = async (data: DepartmentFormData) => {
    setSubmitting(true);
    const result = await createDepartment(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
      role,
    });
    setSubmitting(false);
    setPending(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Department created');
    router.push(`/admin/departments/${result.department?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Department" description="Add a new organizational department" basePath="/admin" />
      <DepartmentForm
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push('/admin/departments')}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => !submitting && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Department Creation</AlertDialogTitle>
            <AlertDialogDescription>
              Create department &quot;{pending?.departmentName}&quot;?
              Reason: {pending?.changeReason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600"
              disabled={submitting}
              onClick={() => pending && submit(pending)}
            >
              {submitting ? 'Creating…' : 'Create Department'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CreateDepartmentPage() {
  return (
    <DepartmentAccessGuard>
      <CreateDepartmentContent />
    </DepartmentAccessGuard>
  );
}
