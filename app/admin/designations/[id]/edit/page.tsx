'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DesignationAccessGuard } from '@/components/admin/designations/designation-access-guard';
import { DesignationForm } from '@/components/admin/designations/designation-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDesignations } from '@/lib/permissions';
import { fetchDesignationById, updateDesignation } from '@/lib/admin/designation-service';
import type { DesignationFormData } from '@/lib/admin/schemas';

function EditDesignationContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [initial, setInitial] = useState<DesignationFormData | null>(null);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof fetchDesignationById>>>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<DesignationFormData | null>(null);

  useEffect(() => {
    fetchDesignationById(id).then((d) => {
      if (!d) {
        setLoading(false);
        return;
      }
      setExisting(d);
      setInitial({
        designationCode: d.designationCode,
        designationName: d.designationName,
        department: d.department,
        designationLevel: (d.designationLevel as DesignationFormData['designationLevel']) || 'Executive',
        approvalAuthority: d.approvalAuthority ?? false,
        canReview: d.canReview ?? false,
        canApprove: d.canApprove ?? false,
        canESign: d.canESign ?? false,
        description: d.description || '',
        status: (d.status as DesignationFormData['status']) || 'Active',
      });
      setLoading(false);
    });
  }, [id]);

  if (!canEditDesignations(role)) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can edit designations." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!initial || !existing) return <ErrorCard title="Not Found" message="Designation not found" />;

  const confirmSave = async (data: DesignationFormData) => {
    setSubmitting(true);
    const result = await updateDesignation(id, data, existing, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Designation updated');
    router.push(`/admin/designations/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Designation" description={existing.designationName} basePath="/admin" />
      <DesignationForm
        initial={initial}
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push(`/admin/designations/${id}`)}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save changes to &quot;{pending?.designationName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-blue-600" onClick={() => pending && confirmSave(pending)}>
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EditDesignationPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <DesignationAccessGuard>
      <EditDesignationContent id={params.id} />
    </DesignationAccessGuard>
  );
}
