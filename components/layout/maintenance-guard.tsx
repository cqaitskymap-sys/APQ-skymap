'use client';

import { Wrench } from 'lucide-react';
import { useSystemSettings } from '@/contexts/system-settings-context';
import { useAuth } from '@/contexts/auth-context';

function canAccessDuringMaintenance(role?: string | null): boolean {
  return ['super_admin', 'admin'].includes(role?.toLowerCase() || '');
}

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { maintenanceActive, settings, loading, canBypassMaintenance } = useSystemSettings();
  const { profile } = useAuth();

  if (loading) return <>{children}</>;

  const allowed = settings?.allowedAdminAccessDuringMaintenance && (
    canBypassMaintenance || canAccessDuringMaintenance(profile?.role)
  );

  if (maintenanceActive && !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <Wrench className="h-12 w-12 text-amber-600 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Mode</h1>
          <p className="text-muted-foreground">
            {settings?.maintenanceMessage || 'The system is temporarily unavailable for scheduled maintenance.'}
          </p>
          {settings?.scheduledMaintenanceEnd && (
            <p className="text-sm text-muted-foreground">
              Expected completion: {new Date(settings.scheduledMaintenanceEnd).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
