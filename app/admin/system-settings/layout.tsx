'use client';

import { SystemSettingsAccessGuard } from '@/components/admin/system-settings/system-settings-access-guard';
import { SystemSettingsShell } from '@/components/admin/system-settings/system-settings-shell';

export default function SystemSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SystemSettingsAccessGuard>
      <SystemSettingsShell>{children}</SystemSettingsShell>
    </SystemSettingsAccessGuard>
  );
}
