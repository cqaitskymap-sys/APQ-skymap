'use client';

import { EsignSettingsAccessGuard } from '@/components/admin/esign-settings/esign-settings-access-guard';
import { EsignSettingsListPage } from '@/components/admin/esign-settings/esign-settings-list-page';

export default function AdminEsignSettingsPage() {
  return (
    <EsignSettingsAccessGuard>
      <EsignSettingsListPage />
    </EsignSettingsAccessGuard>
  );
}
