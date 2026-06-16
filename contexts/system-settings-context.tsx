'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { SystemSettings } from '@/lib/admin/schemas';
import {
  fetchSystemSettings,
  isMaintenanceModeActive,
  canAccessDuringMaintenance,
} from '@/lib/admin/system-settings-service';
import { useAuth } from '@/contexts/auth-context';

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
  const { profile } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await fetchSystemSettings();
      setSettings(s);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 120000);
    return () => window.clearInterval(interval);
  }, [load]);

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
