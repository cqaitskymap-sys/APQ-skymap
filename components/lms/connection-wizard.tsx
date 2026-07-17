'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  lmsConnectionSchema, type LmsConnectionInput,
} from '@/lib/lms-schemas';
import {
  SUPPORTED_LMS_PLATFORMS, LMS_AUTH_TYPES, LMS_SYNC_MODES,
  LMS_SYNC_FREQUENCIES, LMS_SYNC_ENTITIES,
} from '@/lib/lms-types';
import { createConnection, testConnection, updateConnection } from '@/lib/lms-service';
import type { LmsActor } from '@/lib/lms-types';

interface ConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actor: LmsActor;
  onSuccess: () => void;
}

export function ConnectionWizard({ open, onOpenChange, actor, onSuccess }: ConnectionWizardProps) {
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const form = useForm<LmsConnectionInput>({
    resolver: zodResolver(lmsConnectionSchema),
    defaultValues: {
      connection_name: '',
      lms_name: 'Custom REST API LMS',
      base_url: '',
      authentication_type: 'API Key',
      sync_mode: 'Manual',
      sync_frequency: 'On Demand',
      sync_entities: ['Users', 'Training Courses', 'Training Completion', 'Certificates'],
    },
  });

  const authType = form.watch('authentication_type');
  const selectedEntities = form.watch('sync_entities') ?? [];

  const toggleEntity = (entity: string) => {
    const current = form.getValues('sync_entities') ?? [];
    if (current.includes(entity as typeof LMS_SYNC_ENTITIES[number])) {
      form.setValue('sync_entities', current.filter((e) => e !== entity));
    } else {
      form.setValue('sync_entities', [...current, entity as typeof LMS_SYNC_ENTITIES[number]]);
    }
  };

  const onSubmit = async (data: LmsConnectionInput) => {
    try {
      const id = createdId ?? await createConnection(data, actor);
      if (createdId) await updateConnection(createdId, data, actor);
      setCreatedId(id);
      toast.success(createdId ? 'LMS connection saved' : 'LMS connection created');
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create connection');
    }
  };

  const handleTest = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    setTesting(true);
    try {
      const data = form.getValues();
      const id = createdId ?? await createConnection(data, actor);
      if (!createdId) setCreatedId(id);
      const result = await testConnection(id, actor);
      toast[result.success ? 'success' : 'error'](result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
    setStep(0);
    setCreatedId(null);
    form.reset();
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && 'Step 1: Connection Details'}
            {step === 1 && 'Step 2: Authentication & Sync'}
            {step === 2 && 'Connection Created'}
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Connection Name *</Label>
              <Input {...form.register('connection_name')} placeholder="Production LMS" />
              {form.formState.errors.connection_name && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.connection_name.message}</p>
              )}
            </div>
            <div>
              <Label>LMS Platform</Label>
              <Select value={form.watch('lms_name')} onValueChange={(v) => form.setValue('lms_name', v as LmsConnectionInput['lms_name'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LMS_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base URL *</Label>
              <Input {...form.register('base_url')} placeholder="https://lms.company.com" />
              {form.formState.errors.base_url && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.base_url.message}</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Authentication Type</Label>
              <Select value={authType} onValueChange={(v) => form.setValue('authentication_type', v as LmsConnectionInput['authentication_type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LMS_AUTH_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {authType === 'OAuth2' && (
              <>
                <div><Label>Client ID</Label><Input {...form.register('client_id')} /></div>
                <div><Label>Client Secret</Label><Input type="password" {...form.register('client_secret')} /></div>
              </>
            )}
            {(authType === 'API Key' || authType === 'JWT' || authType === 'Bearer Token') && (
              <div><Label>{authType === 'API Key' ? 'API Key' : 'Token'}</Label><Input type="password" {...form.register('api_key')} /></div>
            )}
            {authType === 'Basic Authentication' && (
              <>
                <div><Label>Username</Label><Input {...form.register('username')} /></div>
                <div><Label>Password</Label><Input type="password" {...form.register('password')} /></div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sync Mode</Label>
                <Select value={form.watch('sync_mode')} onValueChange={(v) => form.setValue('sync_mode', v as LmsConnectionInput['sync_mode'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LMS_SYNC_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sync Frequency</Label>
                <Select value={form.watch('sync_frequency')} onValueChange={(v) => form.setValue('sync_frequency', v as LmsConnectionInput['sync_frequency'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LMS_SYNC_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Sync Entities</Label>
              <div className="grid grid-cols-2 gap-2">
                {LMS_SYNC_ENTITIES.map((entity) => (
                  <label key={entity} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedEntities.includes(entity)}
                      onCheckedChange={() => toggleEntity(entity)}
                    />
                    {entity}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-sm">
            <p className="text-green-700">Connection successfully created and ready for synchronization.</p>
            <p className="text-muted-foreground">Test the connection and run an initial sync from the dashboard.</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 0 && (
            <Button onClick={async () => { if (await form.trigger(['connection_name', 'base_url', 'lms_name'])) setStep(1); }}>
              Next
            </Button>
          )}
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button onClick={form.handleSubmit(onSubmit)}>Save Connection</Button>
            </>
          )}
          {step === 2 && <Button onClick={handleFinish}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
