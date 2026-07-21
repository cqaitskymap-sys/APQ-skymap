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
  const { role, hasPermission } = useAdminPermissions();
  const [initial, setInitial] = useState<DesignationFormData | null>(null);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof fetchDesignationById>>>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<DesignationFormData | null>(null);

  useEffect(() => {
    fetchDesignationById(id, true).then((d) => {
      if (!d || d.isDeleted) {
        setLoading(false);
        return;
      }
      setExisting(d);
      setInitial({
        designationCode: d.designationCode,
        designationName: d.designationName,
        shortName: d.shortName || '',
        department: d.department,
        parentDesignationId: d.parentDesignationId || '',
        designationLevel: (d.designationLevel as DesignationFormData['designationLevel']) || 'Executive',
        reportingLevel: (d.reportingLevel as DesignationFormData['reportingLevel']) || '',
        jobGrade: (d.jobGrade as DesignationFormData['jobGrade']) || '',
        jobBand: (d.jobBand as DesignationFormData['jobBand']) || '',
        jobLevel: d.jobLevel || '',
        employmentCategory: (d.employmentCategory as DesignationFormData['employmentCategory']) || 'Permanent',
        minimumExperience: d.minimumExperience ?? 0,
        requiredQualification: d.requiredQualification || '',
        requiredSkills: d.requiredSkills || '',
        businessUnit: d.businessUnit || '',
        siteId: d.siteId || '',
        siteName: d.siteName || '',
        approvalAuthority: d.approvalAuthority ?? false,
        canReview: d.canReview ?? false,
        canApprove: d.canApprove ?? false,
        canESign: d.canESign ?? false,
        description: d.description || '',
        remarks: d.remarks || '',
        status: (d.status as DesignationFormData['status']) || 'Active',
        changeReason: '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (!canEditDesignations(role) || !hasPermission('Admin', 'edit')) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can edit designations." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!initial || !existing) {
    return (
      <ErrorCard
        title="Not Found"
        message="Designation not found or has been soft-deleted. Restore it from the list to edit."
      />
    );
  }

  const confirmSave = async (data: DesignationFormData) => {
    setSubmitting(true);
    const result = await updateDesignation(id, data, existing, {
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
    if (result.cascadeCount) {
      toast.success(`Designation updated. ${result.cascadeCount} linked reference(s) synchronized.`);
    } else {
      toast.success('Designation updated');
    }
    router.push(`/admin/designations/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Designation" description={existing.designationName} basePath="/admin" />
      <DesignationForm
        initial={initial}
        currentId={id}
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push(`/admin/designations/${id}`)}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => !submitting && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save changes to &quot;{pending?.designationName}&quot;?
              Linked users will be synchronized if the name changes.
              Reason: {pending?.changeReason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600"
              disabled={submitting}
              onClick={() => pending && confirmSave(pending)}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
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
