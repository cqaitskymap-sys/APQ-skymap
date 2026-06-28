'use client';

import { useState } from 'react';
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
import { createSop } from '@/lib/sop-service';
import { sopCreateSchema, type SopCreateInput } from '@/lib/sop-schemas';
import { SOP_CATEGORIES } from '@/lib/sop-types';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';

export function SopWizardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SopCreateInput>({
    resolver: zodResolver(sopCreateSchema),
    defaultValues: {
      sop_title: '', department: 'QA', category: 'Quality Assurance',
      owner_name: profile?.full_name || '', approver_name: '',
      version: '1.0', review_due_date: '',
      training_required: true, training_before_effective: false,
      electronic_signature_required: true, confidentiality: 'Internal', language: 'English',
      keywords: [],
    },
  });

  const onSubmit = async (data: SopCreateInput) => {
    setSubmitting(true);
    try {
      const actor = {
        id: user?.uid || 'anonymous',
        name: profile?.full_name || 'Unknown',
        role: normalizeRole(profile?.role),
        department: profile?.department,
      };
      const created = await createSop(data, actor);
      toast.success(`SOP ${created.sop_number} created`);
      router.push(`/qms/documents/sop/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create SOP');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <DmsPageHeader title="Create SOP" description="SOP Wizard — create a new Standard Operating Procedure."
        trail={[{ label: 'SOP Management', href: '/qms/documents/sop' }, { label: 'Create SOP' }]} />

      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1 rounded ${step >= s ? 'bg-blue-600' : 'bg-muted'}`} />
        ))}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Step 1 — Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>SOP Title *</Label><Input {...form.register('sop_title')} /></div>
              <div><Label>Short Title</Label><Input {...form.register('short_title')} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department *</Label>
                  <select {...form.register('department')} className="w-full rounded-md border px-3 py-2 text-sm">
                    {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Category</Label>
                  <select {...form.register('category')} className="w-full rounded-md border px-3 py-2 text-sm">
                    {SOP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Owner *</Label><Input {...form.register('owner_name')} /></div>
                <div><Label>Approver *</Label><Input {...form.register('approver_name')} /></div>
              </div>
              <Button type="button" onClick={() => setStep(2)}>Next</Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Step 2 — Dates & Training</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Effective Date</Label><Input type="date" {...form.register('effective_date')} /></div>
                <div><Label>Review Due Date *</Label><Input type="date" {...form.register('review_due_date')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Site</Label><Input {...form.register('site')} /></div>
                <div><Label>Area</Label><Input {...form.register('area')} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register('training_required')} /> Training Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register('training_before_effective')} /> Training Completion Required Before Effective
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="button" onClick={() => setStep(3)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Step 3 — Review & Submit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p><strong>Title:</strong> {form.watch('sop_title')}</p>
                <p><strong>Department:</strong> {form.watch('department')}</p>
                <p><strong>Category:</strong> {form.watch('category')}</p>
                <p><strong>Owner:</strong> {form.watch('owner_name')}</p>
                <p><strong>Review Due:</strong> {form.watch('review_due_date')}</p>
                <p><strong>Training:</strong> {form.watch('training_required') ? 'Required' : 'Not required'}</p>
              </div>
              <p className="text-xs text-muted-foreground">SOP number will be auto-generated based on department.</p>
              <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                Rich Text Editor & Document Attachment — upload in SOP detail view after creation
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create SOP'}</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
