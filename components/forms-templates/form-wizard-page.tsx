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
import { createForm, fetchSopLinkOptions, fetchWiLinkOptions } from '@/lib/forms-templates-service';
import { formCreateSchema, type FormCreateInput } from '@/lib/forms-templates-schemas';
import { FORM_TYPES, FORM_CATEGORIES } from '@/lib/forms-templates-types';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';

export function FormWizardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [sopOpts, setSopOpts] = useState<{ id: string; number: string; title: string }[]>([]);
  const [wiOpts, setWiOpts] = useState<{ id: string; number: string; title: string }[]>([]);

  const form = useForm<FormCreateInput>({
    resolver: zodResolver(formCreateSchema),
    defaultValues: { form_title: '', form_type: 'Form', category: 'Production', department: 'Production', owner_name: profile?.full_name || '', approver_name: '', version: '1.0', effective_date: '', review_due_date: '', training_required: false, electronic_signature_required: true, confidentiality: 'Internal', language: 'English', keywords: [] },
  });

  useEffect(() => { void fetchSopLinkOptions().then(setSopOpts); void fetchWiLinkOptions().then(setWiOpts); }, []);

  const onSubmit = async (data: FormCreateInput) => {
    setSubmitting(true);
    try {
      const actor = { id: user?.uid || 'anonymous', name: profile?.full_name || 'Unknown', role: normalizeRole(profile?.role), department: profile?.department };
      const created = await createForm(data, actor);
      toast.success(`Form ${created.form_number} created`);
      router.push(`/qms/documents/forms-templates/${created.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create form'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <DmsPageHeader title="Create Form / Template" description="Form & Template Creation Wizard" trail={[{ label: 'Forms & Templates', href: '/qms/documents/forms-templates' }, { label: 'Create' }]} />
      <div className="flex gap-2 mb-4">{[1, 2, 3].map((s) => (<div key={s} className={`flex-1 h-1 rounded ${step >= s ? 'bg-blue-600' : 'bg-muted'}`} />))}</div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card><CardHeader><CardTitle>Step 1 — Basic Information</CardTitle></CardHeader><CardContent className="space-y-4">
            <div><Label>Title *</Label><Input {...form.register('form_title')} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Form Type</Label><select {...form.register('form_type')} className="w-full rounded-md border px-3 py-2 text-sm">{FORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><Label>Category</Label><select {...form.register('category')} className="w-full rounded-md border px-3 py-2 text-sm">{FORM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Department *</Label><select {...form.register('department')} className="w-full rounded-md border px-3 py-2 text-sm">{DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><Label>Owner *</Label><Input {...form.register('owner_name')} /></div>
            </div>
            <div><Label>Approver *</Label><Input {...form.register('approver_name')} /></div>
            <Button type="button" onClick={() => setStep(2)}>Next</Button>
          </CardContent></Card>
        )}
        {step === 2 && (
          <Card><CardHeader><CardTitle>Step 2 — Linkages & Dates</CardTitle></CardHeader><CardContent className="space-y-4">
            <div><Label>Related SOP</Label><select className="w-full rounded-md border px-3 py-2 text-sm" onChange={(e) => { const o = sopOpts.find((x) => x.id === e.target.value); form.setValue('related_sop_id', e.target.value || null); form.setValue('related_sop', o ? `${o.number} — ${o.title}` : ''); }}><option value="">Select SOP</option>{sopOpts.map((o) => <option key={o.id} value={o.id}>{o.number} — {o.title}</option>)}</select></div>
            <div><Label>Related Work Instruction</Label><select className="w-full rounded-md border px-3 py-2 text-sm" onChange={(e) => { const o = wiOpts.find((x) => x.id === e.target.value); form.setValue('related_wi_id', e.target.value || null); form.setValue('related_wi', o ? `${o.number} — ${o.title}` : ''); }}><option value="">Select WI</option>{wiOpts.map((o) => <option key={o.id} value={o.id}>{o.number} — {o.title}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Effective Date *</Label><Input type="date" {...form.register('effective_date')} /></div>
              <div><Label>Review Due Date *</Label><Input type="date" {...form.register('review_due_date')} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('training_required')} /> Training Required</label>
            <div className="rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground">Rich Text Editor & Attachment Upload — available after creation</div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button><Button type="button" onClick={() => setStep(3)}>Next</Button></div>
          </CardContent></Card>
        )}
        {step === 3 && (
          <Card><CardHeader><CardTitle>Step 3 — Review & Submit</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
              <p><strong>Title:</strong> {form.watch('form_title')}</p><p><strong>Type:</strong> {form.watch('form_type')}</p>
              <p><strong>Department:</strong> {form.watch('department')}</p><p><strong>SOP:</strong> {form.watch('related_sop') || '—'}</p>
              <p><strong>WI:</strong> {form.watch('related_wi') || '—'}</p>
            </div>
            <p className="text-xs text-muted-foreground">Form number will be auto-generated.</p>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button><Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Form'}</Button></div>
          </CardContent></Card>
        )}
      </form>
    </div>
  );
}
