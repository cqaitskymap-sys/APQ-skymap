'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EsignSettingsAccessGuard } from '@/components/admin/esign-settings/esign-settings-access-guard';
import { EsignSettingDetailView } from '@/components/admin/esign-settings/esign-setting-detail-view';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { fetchEsignSettingById } from '@/lib/admin/esign-settings-service';
import type { EsignSettings } from '@/lib/admin/schemas';

function EsignSettingDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const [setting, setSetting] = useState<EsignSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await fetchEsignSettingById(id);
      if (!record) setError('E-signature setting not found');
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

  return <EsignSettingDetailView setting={setting} onRefresh={load} />;
}

export default function EsignSettingDetailPage() {
  return (
    <EsignSettingsAccessGuard>
      <EsignSettingDetailContent />
    </EsignSettingsAccessGuard>
  );
}
