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
import { createWi, fetchEquipmentOptions, fetchProductionLineOptions, fetchSopLinkOptions } from '@/lib/wi-service';
import { wiCreateSchema, type WiCreateInput } from '@/lib/wi-schemas';
import { WI_CATEGORIES } from '@/lib/wi-types';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';

export function WiWizardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [equipmentOpts, setEquipmentOpts] = useState<{ id: string; name: string }[]>([]);
  const [lineOpts, setLineOpts] = useState<{ id: string; name: string }[]>([]);
  const [sopOpts, setSopOpts] = useState<{ id: string; number: string; title: string }[]>([]);

  const form = useForm<WiCreateInput>({
    resolver: zodResolver(wiCreateSchema),
    defaultValues: {
      wi_title: '', department: 'Production', category: 'Production',
      owner_name: profile?.full_name || '', approver_name: '',
      version: '1.0', effective_date: '', review_due_date: '',
      training_required: true, electronic_signature_required: true,
      confidentiality: 'Internal', language: 'English', keywords: [],
    },
  });

  useEffect(() => {
    void fetchEquipmentOptions().then(setEquipmentOpts);
    void fetchProductionLineOptions().then(setLineOpts);
    void fetchSopLinkOptions().then(setSopOpts);
  }, []);

  const onSubmit = async (data: WiCreateInput) => {
    setSubmitting(true);
    try {
      const actor = { id: user?.uid || 'anonymous', name: profile?.full_name || 'Unknown', role: normalizeRole(profile?.role), department: profile?.department };
      const created = await createWi(data, actor);
      toast.success(`WI ${created.wi_number} created`);
      router.push(`/qms/documents/work-instructions/${created.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create WI'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <DmsPageHeader title="Create Work Instruction" description="WI Creation Wizard"
        trail={[{ label: 'Work Instructions', href: '/qms/documents/work-instructions' }, { label: 'Create WI' }]} />
      <div className="flex gap-2 mb-4">{[1, 2, 3].map((s) => (<div key={s} className={`flex-1 h-1 rounded ${step >= s ? 'bg-blue-600' : 'bg-muted'}`} />))}</div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card><CardHeader><CardTitle>Step 1 — Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>WI Title *</Label><Input {...form.register('wi_title')} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Department *</Label><select {...form.register('department')} className="w-full rounded-md border px-3 py-2 text-sm">{DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><Label>Category</Label><select {...form.register('category')} className="w-full rounded-md border px-3 py-2 text-sm">{WI_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Owner *</Label><Input {...form.register('owner_name')} /></div>
                <div><Label>Approver *</Label><Input {...form.register('approver_name')} /></div>
              </div>
              <Button type="button" onClick={() => setStep(2)}>Next</Button>
            </CardContent></Card>
        )}
        {step === 2 && (
          <Card><CardHeader><CardTitle>Step 2 — Equipment, SOP & Dates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Equipment</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" onChange={(e) => {
                  const opt = equipmentOpts.find((o) => o.id === e.target.value);
                  form.setValue('equipment_id', e.target.value || null);
                  form.setValue('equipment', opt?.name || '');
                }}><option value="">Select equipment</option>{equipmentOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </div>
              <div><Label>Production Line</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" onChange={(e) => {
                  const opt = lineOpts.find((o) => o.id === e.target.value);
                  form.setValue('production_line_id', e.target.value || null);
                  form.setValue('production_line', opt?.name || '');
                }}><option value="">Select line</option>{lineOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </div>
              <div><Label>Related SOP</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" onChange={(e) => {
                  const opt = sopOpts.find((o) => o.id === e.target.value);
                  form.setValue('related_sop_id', e.target.value || null);
                  form.setValue('related_sop', opt ? `${opt.number} — ${opt.title}` : '');
                }}><option value="">Link to SOP</option>{sopOpts.map((o) => <option key={o.id} value={o.id}>{o.number} — {o.title}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Effective Date *</Label><Input type="date" {...form.register('effective_date')} /></div>
                <div><Label>Review Due Date *</Label><Input type="date" {...form.register('review_due_date')} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('training_required')} /> Training Required</label>
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button><Button type="button" onClick={() => setStep(3)}>Next</Button></div>
            </CardContent></Card>
        )}
        {step === 3 && (
          <Card><CardHeader><CardTitle>Step 3 — Review & Submit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p><strong>Title:</strong> {form.watch('wi_title')}</p>
                <p><strong>Department:</strong> {form.watch('department')}</p>
                <p><strong>Equipment:</strong> {form.watch('equipment') || '—'}</p>
                <p><strong>Related SOP:</strong> {form.watch('related_sop') || '—'}</p>
              </div>
              <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground">Rich Text Editor & Attachment — upload after creation</div>
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button><Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Work Instruction'}</Button></div>
            </CardContent></Card>
        )}
      </form>
    </div>
  );
}
