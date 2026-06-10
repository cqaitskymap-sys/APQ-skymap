'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { getAdminRecords, createAdminRecord, updateAdminRecord } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS, SIGNATURE_MEANINGS } from '@/lib/admin/constants';
import { esignSettingsSchema, type EsignSettings } from '@/lib/admin/schemas';

export default function EsignSettingsPage() {
  return (
    <AdminAuthGuard requireSuperAdmin>
      <EsignContent />
    </AdminAuthGuard>
  );
}

function EsignContent() {
  const { user, profile } = useAuth();
  const [existingId, setExistingId] = useState<string | null>(null);

  const form = useForm<EsignSettings>({
    resolver: zodResolver(esignSettingsSchema),
    defaultValues: {
      requirePasswordConfirmation: true,
      requireReason: true,
      requireRoleVerification: true,
      sessionTimeout: 15,
      signatureMeanings: [...SIGNATURE_MEANINGS],
      status: 'Active',
    },
  });

  useEffect(() => {
    getAdminRecords<EsignSettings>(ADMIN_COLLECTIONS.esignSettings).then((records) => {
      if (records[0]) {
        form.reset(records[0]);
        setExistingId(records[0].id || null);
      }
    });
  }, [form]);

  const onSave = async (data: EsignSettings) => {
    const auditMeta = { userId: user?.uid || 'system', userName: profile?.full_name || 'Admin', module: 'Admin' as const };
    try {
      if (existingId) {
        await updateAdminRecord(ADMIN_COLLECTIONS.esignSettings, existingId, data, auditMeta);
      } else {
        const created = await createAdminRecord(ADMIN_COLLECTIONS.esignSettings, data, auditMeta);
        if (created && 'id' in created && typeof created.id === 'string') {
          setExistingId(created.id);
        }
      }
      toast.success('E-Signature settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="E-Signature Settings"
        description="Configure 21 CFR Part 11 compliant electronic signature requirements"
        actions={
          <Button onClick={form.handleSubmit(onSave)} className="bg-blue-600">
            <Save className="h-4 w-4 mr-2" />Save Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Signature Requirements</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Require Password Confirmation</Label>
              <Switch checked={form.watch('requirePasswordConfirmation')} onCheckedChange={(v) => form.setValue('requirePasswordConfirmation', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Require Reason for Signature</Label>
              <Switch checked={form.watch('requireReason')} onCheckedChange={(v) => form.setValue('requireReason', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Require Role Verification</Label>
              <Switch checked={form.watch('requireRoleVerification')} onCheckedChange={(v) => form.setValue('requireRoleVerification', v)} />
            </div>
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input type="number" {...form.register('sessionTimeout', { valueAsNumber: true })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Signature Meanings</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Each e-signature stores: User ID, Name, Role, Date Time, Meaning, Reason, IP Address
            </p>
            <div className="flex flex-wrap gap-2">
              {SIGNATURE_MEANINGS.map((m) => (
                <Badge key={m} variant="outline" className="bg-blue-50 text-blue-700">{m}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
