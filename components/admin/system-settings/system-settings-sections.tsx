'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { RefreshCw, Shield, KeyRound, Clock, Upload, Palette, Wrench, Cloud, FileText, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DATE_FORMATS, TIME_FORMATS, CURRENCY_OPTIONS, TIMEZONE_OPTIONS,
  SYSTEM_ENVIRONMENTS, FINANCIAL_YEAR_MONTHS, SIDEBAR_MODES, LOGO_DISPLAY_MODES,
  RECORD_STATUSES,
} from '@/lib/admin/constants';
import type { SystemSettings } from '@/lib/admin/schemas';
import {
  buildPasswordPolicyPreview,
  logFirebaseHealthCheck,
  type FirebaseHealthStatus,
} from '@/lib/admin/system-settings-service';
import { fetchCompanySites } from '@/lib/admin/company-site-service';
import { SettingsStatusBadge } from './settings-status-badge';
import { useSettingsForm, SectionSaveBar } from './system-settings-shell';

export function GeneralSettingsSection() {
  const { settings, saveSection, canEdit } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });

  useEffect(() => {
    fetchCompanySites().then((list) =>
      setSites(list.map((s) => ({ id: s.id || '', name: s.siteName || s.siteCode || '' }))),
    );
  }, []);

  const onSave = async () => {
    setSaving(true);
    await saveSection('general', form.getValues());
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-5 w-5" />General Settings</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Application Name *</Label><Input {...form.register('applicationName')} disabled={!canEdit} /></div>
        <div className="space-y-2"><Label>Short Name</Label><Input {...form.register('applicationShortName')} disabled={!canEdit} /></div>
        <div className="space-y-2">
          <Label>Default Site</Label>
          <Select value={form.watch('companyDefaultSite') || ''} disabled={!canEdit} onValueChange={(v) => form.setValue('companyDefaultSite', v)}>
            <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
            <SelectContent>
              {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Language</Label><Input {...form.register('defaultLanguage')} disabled={!canEdit} /></div>
        <div className="space-y-2">
          <Label>Timezone *</Label>
          <Select value={form.watch('timezone')} disabled={!canEdit} onValueChange={(v) => form.setValue('timezone', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIMEZONE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date Format *</Label>
          <Select value={form.watch('dateFormat')} disabled={!canEdit} onValueChange={(v) => form.setValue('dateFormat', v as SystemSettings['dateFormat'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_FORMATS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Time Format</Label>
          <Select value={form.watch('timeFormat')} disabled={!canEdit} onValueChange={(v) => form.setValue('timeFormat', v as SystemSettings['timeFormat'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIME_FORMATS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={form.watch('defaultCurrency')} disabled={!canEdit} onValueChange={(v) => form.setValue('defaultCurrency', v as SystemSettings['defaultCurrency'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Financial Year Start</Label>
          <Select value={form.watch('financialYearStartMonth')} disabled={!canEdit} onValueChange={(v) => form.setValue('financialYearStartMonth', v as SystemSettings['financialYearStartMonth'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FINANCIAL_YEAR_MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Support Email</Label><Input {...form.register('supportEmail')} disabled={!canEdit} /></div>
        <div className="space-y-2"><Label>Support Phone</Label><Input {...form.register('supportPhone')} disabled={!canEdit} /></div>
        <div className="space-y-2"><Label>Version</Label><Input {...form.register('applicationVersion')} disabled={!canEdit} /></div>
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select value={form.watch('environment')} disabled={!canEdit} onValueChange={(v) => form.setValue('environment', v as SystemSettings['environment'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SYSTEM_ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.watch('status')} disabled={!canEdit} onValueChange={(v) => form.setValue('status', v as SystemSettings['status'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 pt-2"><SectionSaveBar section="general" onSave={onSave} readOnly={!canEdit} saving={saving} /></div>
      </CardContent>
    </Card>
  );
}

export function SecuritySettingsSection() {
  const { settings, saveSection, canEditSecurity } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });

  const onSave = async () => {
    setSaving(true);
    await saveSection('security', form.getValues());
    setSaving(false);
  };

  const toggles: { key: keyof SystemSettings; label: string }[] = [
    { key: 'enableRoleBasedAccess', label: 'Enable Role Based Access' },
    { key: 'enablePermissionGuard', label: 'Enable Permission Guard' },
    { key: 'enableAuditTrail', label: 'Enable Audit Trail' },
    { key: 'enableESignature', label: 'Enable E-Signature' },
    { key: 'enableTwoFactorAuth', label: 'Enable Two Factor Authentication' },
    { key: 'allowMultipleSessions', label: 'Allow Multiple Sessions' },
    { key: 'allowIpRestriction', label: 'Allow IP Restriction' },
    { key: 'enableAccountLockout', label: 'Enable Account Lockout' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-5 w-5" />Security Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {toggles.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <Label>{label}</Label>
            <Switch checked={Boolean(form.watch(key))} disabled={!canEditSecurity}
              onCheckedChange={(v) => form.setValue(key, v as never)} />
          </div>
        ))}
        <div className="space-y-2"><Label>Allowed IP List</Label><Textarea {...form.register('allowedIpList')} disabled={!canEditSecurity} rows={2} placeholder="Comma-separated IPs" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Max Failed Login Attempts</Label><Input type="number" {...form.register('maxFailedLoginAttempts', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
          <div className="space-y-2"><Label>Lock Duration (minutes)</Label><Input type="number" {...form.register('accountLockDurationMinutes', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
        </div>
        <SectionSaveBar section="security" onSave={onSave} readOnly={!canEditSecurity} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function PasswordPolicySection() {
  const { settings, saveSection, canEditSecurity } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });
  const preview = buildPasswordPolicyPreview({ ...settings, ...form.watch() } as SystemSettings);

  const onSave = async () => {
    setSaving(true);
    await saveSection('password policy', form.getValues());
    setSaving(false);
  };

  const toggles: { key: keyof SystemSettings; label: string }[] = [
    { key: 'requireUppercase', label: 'Require Uppercase' },
    { key: 'requireLowercase', label: 'Require Lowercase' },
    { key: 'requireNumber', label: 'Require Number' },
    { key: 'requireSpecialChar', label: 'Require Special Character' },
    { key: 'forcePasswordChangeOnFirstLogin', label: 'Force Change On First Login' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-5 w-5" />Password Policy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Minimum Length</Label><Input type="number" {...form.register('minPasswordLength', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
            <div className="space-y-2"><Label>Password Expiry Days</Label><Input type="number" {...form.register('passwordExpiryDays', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
            <div className="space-y-2"><Label>Prevent Reuse Count</Label><Input type="number" {...form.register('preventLastPasswordReuseCount', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
          </div>
          {toggles.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch checked={Boolean(form.watch(key))} disabled={!canEditSecurity}
                onCheckedChange={(v) => form.setValue(key, v as never)} />
            </div>
          ))}
          <SectionSaveBar section="password policy" onSave={onSave} readOnly={!canEditSecurity} saving={saving} />
        </CardContent>
      </Card>
      <Card className="bg-slate-50">
        <CardHeader><CardTitle className="text-sm">Policy Preview</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{preview}</p></CardContent>
      </Card>
    </div>
  );
}

export function SessionSettingsSection() {
  const { settings, saveSection, canEditSecurity } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });

  const onSave = async () => {
    setSaving(true);
    await saveSection('session', form.getValues());
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-5 w-5" />Session Settings</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Session Timeout (minutes)</Label><Input type="number" {...form.register('sessionTimeoutMinutes', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
        <div className="space-y-2"><Label>Idle Timeout (minutes)</Label><Input type="number" {...form.register('idleTimeoutMinutes', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
        <div className="space-y-2"><Label>Auto Logout Warning (minutes)</Label><Input type="number" {...form.register('autoLogoutWarningMinutes', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
        <div className="flex items-center justify-between col-span-2">
          <Label>Remember Me Enabled</Label>
          <Switch checked={form.watch('rememberMeEnabled')} disabled={!canEditSecurity}
            onCheckedChange={(v) => form.setValue('rememberMeEnabled', v)} />
        </div>
        <div className="col-span-2"><SectionSaveBar section="session" onSave={onSave} readOnly={!canEditSecurity} saving={saving} /></div>
      </CardContent>
    </Card>
  );
}

export function FileUploadSettingsSection() {
  const { settings, saveSection, canEdit } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });

  const onSave = async () => {
    setSaving(true);
    await saveSection('file upload', form.getValues());
    setSaving(false);
  };

  const toggles: { key: keyof SystemSettings; label: string }[] = [
    { key: 'allowPdf', label: 'Allow PDF' },
    { key: 'allowExcel', label: 'Allow Excel' },
    { key: 'allowWord', label: 'Allow Word' },
    { key: 'allowImages', label: 'Allow Images' },
    { key: 'enableVirusScanPlaceholder', label: 'Enable Virus Scan (placeholder)' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-5 w-5" />File Upload Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>Allowed File Types</Label><Input {...form.register('allowedFileTypes')} disabled={!canEdit} /></div>
        <div className="space-y-2"><Label>Max File Size (MB)</Label><Input type="number" {...form.register('maxFileSizeMb', { valueAsNumber: true })} disabled={!canEdit} /></div>
        <div className="space-y-2"><Label>Storage Path Format</Label><Input {...form.register('storagePathFormat')} disabled={!canEdit} placeholder="{module}/{year}/{recordId}" /></div>
        {toggles.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <Label>{label}</Label>
            <Switch checked={Boolean(form.watch(key))} disabled={!canEdit}
              onCheckedChange={(v) => form.setValue(key, v as never)} />
          </div>
        ))}
        <SectionSaveBar section="file upload" onSave={onSave} readOnly={!canEdit} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function ThemeSettingsSection() {
  const { settings, saveSection, canEdit } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });

  const onSave = async () => {
    setSaving(true);
    await saveSection('theme', form.getValues());
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="h-5 w-5" />Theme Settings</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Default Theme</Label>
          <Select value={form.watch('defaultTheme')} disabled={!canEdit} onValueChange={(v) => form.setValue('defaultTheme', v as SystemSettings['defaultTheme'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Primary Color</Label><Input type="color" {...form.register('primaryColor')} disabled={!canEdit} className="h-10 w-20" /></div>
        <div className="space-y-2">
          <Label>Sidebar Mode</Label>
          <Select value={form.watch('sidebarMode')} disabled={!canEdit} onValueChange={(v) => form.setValue('sidebarMode', v as SystemSettings['sidebarMode'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SIDEBAR_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Logo Display</Label>
          <Select value={form.watch('logoDisplayMode')} disabled={!canEdit} onValueChange={(v) => form.setValue('logoDisplayMode', v as SystemSettings['logoDisplayMode'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LOGO_DISPLAY_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between col-span-2">
          <Label>Enable Dark Mode</Label>
          <Switch checked={form.watch('enableDarkMode')} disabled={!canEdit} onCheckedChange={(v) => form.setValue('enableDarkMode', v)} />
        </div>
        <div className="flex items-center justify-between col-span-2">
          <Label>Compact Mode</Label>
          <Switch checked={form.watch('compactMode')} disabled={!canEdit} onCheckedChange={(v) => form.setValue('compactMode', v)} />
        </div>
        <div className="col-span-2"><SectionSaveBar section="theme" onSave={onSave} readOnly={!canEdit} saving={saving} /></div>
      </CardContent>
    </Card>
  );
}

export function MaintenanceSettingsSection() {
  const { settings, saveSection, canEditSecurity, canEdit } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });
  const canEditMaintenance = canEditSecurity;

  const onSave = async () => {
    setSaving(true);
    await saveSection('maintenance', form.getValues());
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {form.watch('maintenanceModeEnabled') && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">
            Maintenance mode is ON — non-admin users will see the maintenance page globally.
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-5 w-5" />Maintenance Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Maintenance Mode Enabled</Label>
            <Switch checked={form.watch('maintenanceModeEnabled')} disabled={!canEditSecurity}
              onCheckedChange={(v) => form.setValue('maintenanceModeEnabled', v)} />
          </div>
          <div className="space-y-2"><Label>Maintenance Message *</Label><Textarea {...form.register('maintenanceMessage')} disabled={!canEdit && !canEditSecurity} rows={3} /></div>
          <div className="flex items-center justify-between">
            <Label>Allow Admin Access During Maintenance</Label>
            <Switch checked={form.watch('allowedAdminAccessDuringMaintenance')} disabled={!canEditSecurity}
              onCheckedChange={(v) => form.setValue('allowedAdminAccessDuringMaintenance', v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Scheduled Start</Label><Input type="datetime-local" {...form.register('scheduledMaintenanceStart')} disabled={!canEditSecurity} /></div>
            <div className="space-y-2"><Label>Scheduled End</Label><Input type="datetime-local" {...form.register('scheduledMaintenanceEnd')} disabled={!canEditSecurity} /></div>
          </div>
          <SectionSaveBar section="maintenance" onSave={onSave} readOnly={!canEditMaintenance} saving={saving} />
        </CardContent>
      </Card>
    </div>
  );
}

export function FirebaseHealthSection() {
  const { auditMeta } = useSettingsForm();
  const [health, setHealth] = useState<FirebaseHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const h = await logFirebaseHealthCheck(auditMeta);
    setHealth(h);
    setLoading(false);
  }, [auditMeta]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Cloud className="h-5 w-5" />Firebase Health</CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {health && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 border rounded-lg"><p className="text-xs text-muted-foreground">Auth</p><SettingsStatusBadge status={health.authStatus} /></div>
              <div className="p-3 border rounded-lg"><p className="text-xs text-muted-foreground">Firestore</p><SettingsStatusBadge status={health.firestoreStatus} /></div>
              <div className="p-3 border rounded-lg"><p className="text-xs text-muted-foreground">Storage</p><SettingsStatusBadge status={health.storageStatus} /></div>
              <div className="p-3 border rounded-lg"><p className="text-xs text-muted-foreground">Latency</p><p className="font-semibold">{health.latencyMs}ms</p></div>
            </div>
            <p className="text-sm"><span className="text-muted-foreground">Project ID:</span> <span className="font-mono">{health.projectId || '—'}</span></p>
            <div className="space-y-1">
              <p className="text-sm font-medium">Environment Variables (no secrets exposed)</p>
              {health.envVars.map((v) => (
                <div key={v.key} className="flex justify-between text-xs border-b py-1">
                  <span className="font-mono">{v.key}</span>
                  <SettingsStatusBadge status={v.configured ? 'Connected' : 'Not Configured'} />
                </div>
              ))}
            </div>
            {health.error && <p className="text-sm text-red-600">{health.error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SystemLogsSection() {
  const { settings, saveSection, canEditSecurity } = useSettingsForm();
  const [saving, setSaving] = useState(false);
  const form = useForm<Partial<SystemSettings>>({ defaultValues: settings });

  const onSave = async () => {
    setSaving(true);
    await saveSection('system logs', form.getValues());
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5" />System Log Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enable System Logs</Label>
          <Switch checked={form.watch('enableSystemLogs')} disabled={!canEditSecurity}
            onCheckedChange={(v) => form.setValue('enableSystemLogs', v)} />
        </div>
        <div className="space-y-2"><Label>Log Retention Days</Label><Input type="number" {...form.register('logRetentionDays', { valueAsNumber: true })} disabled={!canEditSecurity} /></div>
        <div className="flex items-center justify-between">
          <Label>Enable Error Tracking</Label>
          <Switch checked={form.watch('enableErrorTracking')} disabled={!canEditSecurity}
            onCheckedChange={(v) => form.setValue('enableErrorTracking', v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Enable Performance Logs</Label>
          <Switch checked={form.watch('enablePerformanceLogs')} disabled={!canEditSecurity}
            onCheckedChange={(v) => form.setValue('enablePerformanceLogs', v)} />
        </div>
        <SectionSaveBar section="system logs" onSave={onSave} readOnly={!canEditSecurity} saving={saving} />
      </CardContent>
    </Card>
  );
}
