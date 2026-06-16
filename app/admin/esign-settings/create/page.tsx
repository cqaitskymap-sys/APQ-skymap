'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EsignSettingsAccessGuard } from '@/components/admin/esign-settings/esign-settings-access-guard';
import { EsignSettingForm } from '@/components/admin/esign-settings/esign-setting-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditEsignSettings } from '@/lib/permissions';
import { createEsignSetting } from '@/lib/admin/esign-settings-service';
import type { EsignSettingFormData } from '@/lib/admin/schemas';
import { useState } from 'react';

function CreateEsignSettingContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);

  if (!canEditEsignSettings(role)) {
    return <ErrorCard accessDenied message="You do not have permission to create e-signature settings." />;
  }

  const onSubmit = async (data: EsignSettingFormData) => {
    setSubmitting(true);
    const result = await createEsignSetting(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('E-signature setting created');
    router.push(`/admin/esign-settings/${result.setting?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create E-Signature Setting" description="Configure module and action e-signature rules" basePath="/admin" />
      <EsignSettingForm
        onSubmit={onSubmit}
        onCancel={() => router.push('/admin/esign-settings')}
        submitting={submitting}
      />
    </div>
  );
}

export default function CreateEsignSettingPage() {
  return (
    <EsignSettingsAccessGuard>
      <CreateEsignSettingContent />
    </EsignSettingsAccessGuard>
  );
}
