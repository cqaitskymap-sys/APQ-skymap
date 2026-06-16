'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DesignationAccessGuard } from '@/components/admin/designations/designation-access-guard';
import { DesignationForm } from '@/components/admin/designations/designation-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDesignations } from '@/lib/permissions';
import { createDesignation } from '@/lib/admin/designation-service';
import type { DesignationFormData } from '@/lib/admin/schemas';

function CreateDesignationContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);

  if (!canEditDesignations(role)) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can create designations." />;
  }

  const onSubmit = async (data: DesignationFormData) => {
    setSubmitting(true);
    const result = await createDesignation(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
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
        onSubmit={onSubmit}
        onCancel={() => router.push('/admin/designations')}
        submitting={submitting}
      />
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
