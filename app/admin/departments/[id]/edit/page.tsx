'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DepartmentAccessGuard } from '@/components/admin/departments/department-access-guard';
import { DepartmentForm } from '@/components/admin/departments/department-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDepartments } from '@/lib/permissions';
import { fetchDepartmentById, updateDepartment } from '@/lib/admin/department-service';
import type { DepartmentFormData } from '@/lib/admin/schemas';

function EditDepartmentContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role, hasPermission } = useAdminPermissions();
  const [initial, setInitial] = useState<DepartmentFormData | null>(null);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof fetchDepartmentById>>>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<DepartmentFormData | null>(null);

  useEffect(() => {
    fetchDepartmentById(id, true).then((d) => {
      if (!d || d.isDeleted) {
        setLoading(false);
        return;
      }
      setExisting(d);
      setInitial({
        departmentCode: d.departmentCode,
        departmentName: d.departmentName,
        shortName: d.shortName || '',
        departmentType: (d.departmentType as DepartmentFormData['departmentType']) || 'Other',
        parentDepartmentId: d.parentDepartmentId || '',
        departmentHead: d.departmentHead || '',
        departmentHeadId: d.departmentHeadId || '',
        manager: d.manager || '',
        managerId: d.managerId || '',
        hodEmail: d.hodEmail || '',
        email: d.email || '',
        phone: d.phone || '',
        extension: d.extension || '',
        businessUnit: d.businessUnit || '',
        siteId: d.siteId || '',
        siteLocation: d.siteLocation || '',
        location: d.location || '',
        costCenter: d.costCenter || '',
        description: d.description || '',
        remarks: d.remarks || '',
        status: (d.status as DepartmentFormData['status']) || 'Active',
        changeReason: '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (!canEditDepartments(role) || !hasPermission('Admin', 'edit')) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can edit departments." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!initial || !existing) return <ErrorCard title="Not Found" message="Department not found" />;

  const confirmSave = async (data: DepartmentFormData) => {
    setSubmitting(true);
    const result = await updateDepartment(id, data, existing, {
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
      toast.success(`Department updated. ${result.cascadeCount} linked reference(s) synchronized.`);
    } else {
      toast.success('Department updated');
    }
    router.push(`/admin/departments/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Department" description={existing.departmentName} basePath="/admin" />
      <DepartmentForm
        initial={initial}
        currentId={id}
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push(`/admin/departments/${id}`)}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => !submitting && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save changes to &quot;{pending?.departmentName}&quot;?
              Linked users and designations will be synchronized if the name changes.
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

export default function EditDepartmentPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <DepartmentAccessGuard>
      <EditDepartmentContent id={params.id} />
    </DepartmentAccessGuard>
  );
}
