'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { NotificationSettingsAccessGuard } from '@/components/admin/notifications/notification-settings-access-guard';
import { NotificationSettingForm } from '@/components/admin/notifications/notification-setting-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditNotificationSettings } from '@/lib/permissions';
import { createNotificationSetting } from '@/lib/admin/notification-settings-service';
import { fetchActiveUsers, fetchDepartments } from '@/lib/admin/department-service';
import type { NotificationSettingFormData } from '@/lib/admin/schemas';

function CreateNotificationSettingContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchActiveUsers(), fetchDepartments()]).then(([u, d]) => {
      setUsers(u.map((x) => ({ id: x.id || x.userId || '', name: x.fullName || x.email || '' })));
      setDepartments(d.map((dept) => dept.departmentName).filter(Boolean));
    });
  }, []);

  if (!canEditNotificationSettings(role)) {
    return <ErrorCard accessDenied message="You do not have permission to create notification rules." />;
  }

  const onSubmit = async (data: NotificationSettingFormData) => {
    setSubmitting(true);
    const result = await createNotificationSetting(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Notification rule created');
    router.push(`/admin/notifications/${result.setting?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Notification Rule" description="Configure event-based notifications" basePath="/admin" />
      <NotificationSettingForm
        users={users}
        departments={departments}
        onSubmit={onSubmit}
        onCancel={() => router.push('/admin/notifications')}
        submitting={submitting}
      />
    </div>
  );
}

export default function CreateNotificationSettingPage() {
  return (
    <NotificationSettingsAccessGuard>
      <CreateNotificationSettingContent />
    </NotificationSettingsAccessGuard>
  );
}
