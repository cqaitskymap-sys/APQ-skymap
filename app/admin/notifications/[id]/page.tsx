'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { NotificationSettingsAccessGuard } from '@/components/admin/notifications/notification-settings-access-guard';
import { NotificationSettingDetailView } from '@/components/admin/notifications/notification-setting-detail-view';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { fetchNotificationSettingById } from '@/lib/admin/notification-settings-service';
import type { NotificationSetting } from '@/lib/admin/schemas';

function NotificationSettingDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const [setting, setSetting] = useState<NotificationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await fetchNotificationSettingById(id);
      if (!record) setError('Notification rule not found');
      setSetting(record);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !setting) return <ErrorCard message={error || 'Not found'} onRetry={load} />;

  return <NotificationSettingDetailView setting={setting} onRefresh={load} />;
}

export default function NotificationSettingDetailPage() {
  return (
    <NotificationSettingsAccessGuard>
      <NotificationSettingDetailContent />
    </NotificationSettingsAccessGuard>
  );
}
