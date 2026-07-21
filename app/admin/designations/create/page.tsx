'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DesignationAccessGuard } from '@/components/admin/designations/designation-access-guard';
import { DesignationForm } from '@/components/admin/designations/designation-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDesignations } from '@/lib/permissions';
import { createDesignation } from '@/lib/admin/designation-service';
import type { DesignationFormData } from '@/lib/admin/schemas';

function CreateDesignationContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role, hasPermission } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<DesignationFormData | null>(null);

  if (!canEditDesignations(role) || !hasPermission('Admin', 'create')) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can create designations." />;
  }

  const submit = async (data: DesignationFormData) => {
    setSubmitting(true);
    const result = await createDesignation(data, {
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
    toast.success('Designation created');
    router.push(`/admin/designations/${result.designation?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Designation" description="Add a new employee designation" basePath="/admin" />
      <DesignationForm
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push('/admin/designations')}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => !submitting && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Designation Creation</AlertDialogTitle>
            <AlertDialogDescription>
              Create designation &quot;{pending?.designationName}&quot;?
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
              {submitting ? 'Creating…' : 'Create Designation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CreateDesignationPage() {
  return (
    <DesignationAccessGuard>
      <CreateDesignationContent />
    </DesignationAccessGuard>
  );
}
