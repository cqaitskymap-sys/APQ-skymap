'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { getAdminRecords, createAdminRecord, updateAdminRecord } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import { systemSettingsSchema, type SystemSettings } from '@/lib/admin/schemas';

export default function SystemSettingsPage() {
  return (
    <AdminAuthGuard requireSuperAdmin>
      <SystemSettingsContent />
    </AdminAuthGuard>
  );
}

function SystemSettingsContent() {
  const { user, profile } = useAuth();
  const [existingId, setExistingId] = useState<string | null>(null);

  const form = useForm<SystemSettings>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      applicationName: 'Skymap PharmaQMS',
      defaultTheme: 'light',
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      passwordPolicy: 'Min 8 chars, 1 uppercase, 1 number, 1 special character',
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      accountLockDuration: 30,
      allowedFileTypes: '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png',
      maxUploadSize: 10,
      status: 'Active',
    },
  });

  useEffect(() => {
    getAdminRecords<SystemSettings>(ADMIN_COLLECTIONS.systemSettings).then((records) => {
      if (records[0]) {
        form.reset(records[0]);
        setExistingId(records[0].id || null);
      }
    });
  }, [form]);

  const onSave = async (data: SystemSettings) => {
    const auditMeta = { userId: user?.uid || 'system', userName: profile?.full_name || 'Admin', module: 'Admin' as const };
    try {
      if (existingId) {
        await updateAdminRecord(ADMIN_COLLECTIONS.systemSettings, existingId, data, auditMeta);
      } else {
        const created = await createAdminRecord(ADMIN_COLLECTIONS.systemSettings, data, auditMeta);
        if (created && 'id' in created && typeof created.id === 'string') {
          setExistingId(created.id);
        }
      }
      toast.success('System settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="System Settings"
        description="Global application configuration — Super Admin access only"
        actions={
          <Button onClick={form.handleSubmit(onSave)} className="bg-blue-600">
            <Save className="h-4 w-4 mr-2" />Save Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Application Name</Label><Input {...form.register('applicationName')} /></div>
            <div className="space-y-2">
              <Label>Default Theme</Label>
              <Select value={form.watch('defaultTheme')} onValueChange={(v) => form.setValue('defaultTheme', v as SystemSettings['defaultTheme'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Default Language</Label><Input {...form.register('defaultLanguage')} /></div>
            <div className="space-y-2"><Label>Date Format</Label><Input {...form.register('dateFormat')} /></div>
            <div className="space-y-2"><Label>Time Format</Label><Input {...form.register('timeFormat')} placeholder="24h or 12h" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Password Policy</Label><Textarea {...form.register('passwordPolicy')} /></div>
            <div className="space-y-2"><Label>Session Timeout (minutes)</Label><Input type="number" {...form.register('sessionTimeout', { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label>Max Login Attempts</Label><Input type="number" {...form.register('maxLoginAttempts', { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label>Account Lock Duration (minutes)</Label><Input type="number" {...form.register('accountLockDuration', { valueAsNumber: true })} /></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">File Upload</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Allowed File Types</Label><Input {...form.register('allowedFileTypes')} /></div>
            <div className="space-y-2"><Label>Max Upload Size (MB)</Label><Input type="number" {...form.register('maxUploadSize', { valueAsNumber: true })} /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
