'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { SystemSettings } from '@/lib/admin/schemas';
import { useAuth } from '@/contexts/auth-context';

function isMaintenanceModeActive(settings: SystemSettings | null): boolean {
  return Boolean(settings?.maintenanceModeEnabled ?? settings?.maintenanceMode);
}

function canAccessDuringMaintenance(role?: string | null): boolean {
  return ['super_admin', 'admin'].includes(role?.toLowerCase() || '');
}

interface SystemSettingsContextValue {
  settings: SystemSettings | null;
  loading: boolean;
  maintenanceActive: boolean;
  canBypassMaintenance: boolean;
  refresh: () => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextValue>({
  settings: null,
  loading: true,
  maintenanceActive: false,
  canBypassMaintenance: false,
  refresh: async () => {},
});

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    try {
      const { fetchSystemSettings } = await import('@/lib/admin/system-settings-service');
      const s = await fetchSystemSettings();
      setSettings(s);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    const refreshIfVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load();
    };

    refreshIfVisible();
    const interval = window.setInterval(refreshIfVisible, 120000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshIfVisible();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [load, authLoading]);

  const maintenanceActive = isMaintenanceModeActive(settings);
  const canBypass = canAccessDuringMaintenance(profile?.role);

  return (
    <SystemSettingsContext.Provider
      value={{
        settings,
        loading,
        maintenanceActive,
        canBypassMaintenance: canBypass,
        refresh: load,
      }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  return useContext(SystemSettingsContext);
}
