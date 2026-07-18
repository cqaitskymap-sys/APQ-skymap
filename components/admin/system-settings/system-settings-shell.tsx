'use client';

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Save, RotateCcw, Download, Upload, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditSystemSettings, canEditSecuritySystemSettings } from '@/lib/permissions';
import { SYSTEM_SETTINGS_TABS } from '@/lib/admin/constants';
import type { SystemSettings } from '@/lib/admin/schemas';
import {
  fetchSystemSettings,
  updateSystemSettings,
  resetSystemSettingsToDefault,
  exportSystemSettingsJson,
  importSystemSettingsJson,
  getDefaultSystemSettings,
} from '@/lib/admin/system-settings-service';
import { useSystemSettings } from '@/contexts/system-settings-context';

export function SystemSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const { refresh: refreshGlobal } = useSystemSettings();
  const canEdit = canEditSystemSettings(role);
  const canEditSecurity = canEditSecuritySystemSettings(role);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const auditMeta = useMemo(() => ({
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  }), [profile?.email, profile?.full_name, user?.uid]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchSystemSettings();
      setSettings(s || normalizeDefaults());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function normalizeDefaults(): SystemSettings {
    return { ...getDefaultSystemSettings(), id: '' } as SystemSettings;
  }

  const handleExport = () => {
    if (!settings) return;
    const json = exportSystemSettingsJson(settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_settings_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Settings exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await importSystemSettingsJson(text, auditMeta);
    if (result.settings) {
      setSettings(result.settings);
      await refreshGlobal();
      toast.success('Settings imported');
    } else toast.error(result.error || 'Import failed');
    e.target.value = '';
  };

  const handleReset = async () => {
    const result = await resetSystemSettingsToDefault(auditMeta);
    if (result) {
      setSettings(result);
      await refreshGlobal();
      toast.success('Settings reset to defaults');
    } else toast.error('Reset failed');
    setResetOpen(false);
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Global application configuration for Pharma QMS, PQR, and CPV"
        actions={
          <div className="flex gap-2 flex-wrap">
            {(canEdit || canEditSecurity) && (
              <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                <RotateCcw className="h-4 w-4 mr-1" />Reset
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            {canEditSecurity && (
              <>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />Import
                </Button>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 border-b pb-2">
        {SYSTEM_SETTINGS_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              pathname === tab.href || pathname.startsWith(tab.href + '/')
                ? 'bg-blue-600 text-white'
                : 'text-muted-foreground hover:bg-slate-100',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <SettingsFormProvider
        settings={settings!}
        auditMeta={auditMeta}
        canEdit={canEdit}
        canEditSecurity={canEditSecurity}
        onSaved={async (s) => {
          setSettings(s);
          await refreshGlobal();
        }}
      >
        {children}
      </SettingsFormProvider>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Default Settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all system settings to factory defaults. This action is audited and cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-red-600">Reset Defaults</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SettingsFormContextValue {
  settings: SystemSettings;
  auditMeta: { userId: string; userName: string };
  canEdit: boolean;
  canEditSecurity: boolean;
  onSaved: (s: SystemSettings) => void;
  saveSection: (section: string, data: Partial<SystemSettings>) => Promise<void>;
}

const SettingsFormContext = createContext<SettingsFormContextValue | null>(null);

export function useSettingsForm() {
  const ctx = useContext(SettingsFormContext);
  if (!ctx) throw new Error('useSettingsForm must be used within SystemSettingsShell');
  return ctx;
}

function SettingsFormProvider({
  settings, auditMeta, canEdit, canEditSecurity, onSaved, children,
}: {
  settings: SystemSettings;
  auditMeta: { userId: string; userName: string };
  canEdit: boolean;
  canEditSecurity: boolean;
  onSaved: (s: SystemSettings) => void;
  children: React.ReactNode;
}) {
  const saveSection = async (section: string, data: Partial<SystemSettings>) => {
    const updated = await updateSystemSettings(data, auditMeta, section);
    if (updated) {
      onSaved(updated);
      toast.success('Settings saved');
    } else toast.error('Failed to save settings');
  };

  return (
    <SettingsFormContext.Provider value={{
      settings, auditMeta, canEdit, canEditSecurity, onSaved, saveSection,
    }}>
      {children}
    </SettingsFormContext.Provider>
  );
}

export function SectionSaveBar({
  section,
  onSave,
  readOnly,
  saving,
}: {
  section: string;
  onSave: () => void;
  readOnly?: boolean;
  saving?: boolean;
}) {
  if (readOnly) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Settings className="h-3 w-3" />View only — you cannot edit {section} settings
      </p>
    );
  }
  return (
    <Button onClick={onSave} disabled={saving} className="bg-blue-600">
      <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}
