'use client';

import { AlertTriangle } from 'lucide-react';
import { useSystemSettings } from '@/contexts/system-settings-context';

export function MaintenanceBanner() {
  const { maintenanceActive, settings, loading } = useSystemSettings();
  if (loading || !maintenanceActive) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-sm flex items-center gap-2 justify-center">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{settings?.maintenanceMessage || 'System is under maintenance.'}</span>
    </div>
  );
}
