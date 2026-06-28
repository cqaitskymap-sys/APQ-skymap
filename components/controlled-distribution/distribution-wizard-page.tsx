'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { createDistribution, fetchEffectiveDocumentOptions } from '@/lib/controlled-distribution-service';
import { distributionCreateSchema, type DistributionCreateInput } from '@/lib/controlled-distribution-schemas';
import { DISTRIBUTION_TYPES } from '@/lib/controlled-distribution-types';
import { RecipientSelector, DistributionPreview } from '@/components/controlled-distribution/distribution-ui';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';

const ROLE_OPTIONS = ['qa_manager', 'head_qa', 'production_manager', 'qc_manager', 'production_executive', 'qc_executive', 'viewer'];

export function DistributionWizardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [docOpts, setDocOpts] = useState<Array<{ id: string; number: string; title: string; type: string; version: string }>>([]);

  const form = useForm<DistributionCreateInput>({
    resolver: zodResolver(distributionCreateSchema),
    defaultValues: {
      document_id: '', document_version: '', distribution_type: 'Department',
      assigned_departments: [], assigned_roles: [], assigned_users: [], assigned_user_names: [],
      effective_date: new Date().toISOString().split('T')[0],
      acknowledgement_required: true, training_required: false, read_confirmation_required: false,
      reason: '', schedule_later: false,
    },
  });

  useEffect(() => { void fetchEffectiveDocumentOptions().then(setDocOpts); }, []);

  const selectedDoc = docOpts.find((d) => d.id === form.watch('document_id'));

  useEffect(() => {
    if (selectedDoc) form.setValue('document_version', selectedDoc.version);
  }, [selectedDoc, form]);

  const onSubmit = async (data: DistributionCreateInput) => {
    setSubmitting(true);
    try {
      const actor = { id: user?.uid || 'anonymous', name: profile?.full_name || 'Unknown', role: normalizeRole(profile?.role), department: profile?.department };
      const created = await createDistribution(data, actor);
      toast.success(`Distribution ${created.distribution_number} created`);
      router.push('/qms/documents/distribution');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create distribution'); }
    finally { setSubmitting(false); }
  };

  const preview: Partial<import('@/lib/controlled-distribution-types').ControlledDistributionRecord> = {
    document_number: selectedDoc?.number,
    document_title: selectedDoc?.title,
    document_version: form.watch('document_version'),
    distribution_type: form.watch('distribution_type'),
    department: form.watch('department'),
    assigned_departments: form.watch('assigned_departments'),
    effective_date: form.watch('effective_date'),
    expiry_date: form.watch('expiry_date') || null,
    acknowledgement_required: form.watch('acknowledgement_required'),
    training_required: form.watch('training_required'),
    read_confirmation_required: form.watch('read_confirmation_required'),
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <DmsPageHeader
        title="Distribution Wizard"
        description="Create a controlled document distribution"
        trail={[{ label: 'Controlled Document Distribution', href: '/qms/documents/distribution' }, { label: 'Create' }]}
      />
      <div className="flex gap-2 mb-4">{[1, 2, 3].map((s) => (<div key={s} className={`flex-1 h-1 rounded ${step >= s ? 'bg-blue-600' : 'bg-muted'}`} />))}</div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Step 1 — Select Document</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Effective Document *</Label>
                <select {...form.register('document_id')} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Select effective document</option>
                  {docOpts.map((d) => (
                    <option key={d.id} value={d.id}>{d.number} — {d.title} (v{d.version})</option>
                  ))}
                </select>
                {form.formState.errors.document_id && <p className="text-xs text-red-600 mt-1">{form.formState.errors.document_id.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Version</Label><Input {...form.register('document_version')} readOnly className="bg-muted" /></div>
                <div><Label>Distribution Type</Label>
                  <select {...form.register('distribution_type')} className="w-full rounded-md border px-3 py-2 text-sm">
                    {DISTRIBUTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Effective Date *</Label><Input type="date" {...form.register('effective_date')} /></div>
                <div><Label>Expiry Date</Label><Input type="date" {...form.register('expiry_date')} /></div>
              </div>
              <Button type="button" onClick={() => setStep(2)} disabled={!form.watch('document_id')}>Next</Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Step 2 — Recipients</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Primary Department</Label>
                <select {...form.register('department')} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Select department</option>
                  {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <RecipientSelector
                departments={[...DMS_DEPARTMENTS]}
                roles={ROLE_OPTIONS}
                selectedDepts={form.watch('assigned_departments') || []}
                selectedRoles={form.watch('assigned_roles') || []}
                onDeptChange={(depts) => form.setValue('assigned_departments', depts)}
                onRoleChange={(roles) => form.setValue('assigned_roles', roles)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Site</Label><Input {...form.register('site')} placeholder="e.g. Site A" /></div>
                <div><Label>Plant</Label><Input {...form.register('plant')} placeholder="e.g. Plant 1" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('schedule_later')} /> Schedule for later</label>
              {form.watch('schedule_later') && (
                <div><Label>Distribution Date</Label><Input type="date" {...form.register('distribution_date')} /></div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="button" onClick={() => setStep(3)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Step 3 — Requirements & Submit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <DistributionPreview record={preview} />
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('acknowledgement_required')} /> Acknowledgement Required</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('training_required')} /> Training Required</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('read_confirmation_required')} /> Read Confirmation Required</label>
              </div>
              <div><Label>Reason / Notes</Label><Input {...form.register('reason')} placeholder="Distribution reason" /></div>
              <p className="text-xs text-muted-foreground">Distribution number will be auto-generated. Obsolete version distributions will be automatically withdrawn.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Distributing...' : 'Create Distribution'}</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
