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
import { createDocumentRevision } from '@/lib/document-version-control-service';
import { listDocuments } from '@/lib/dms-service';
import { revisionCreateSchema, type RevisionCreateInput } from '@/lib/document-version-control-schemas';
import { REVISION_TYPES, incrementVersionNumber } from '@/lib/document-version-control-types';
import { ChangeSummaryCard } from '@/components/document-version-control/version-control-ui';
import type { DocumentVersionRecord } from '@/lib/document-version-control-types';

export function RevisionWizardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [docOpts, setDocOpts] = useState<Array<{ id: string; number: string; title: string; version: string; type: string }>>([]);

  const form = useForm<RevisionCreateInput>({
    resolver: zodResolver(revisionCreateSchema),
    defaultValues: {
      document_id: '', revision_type: 'Minor', revision_reason: '', change_summary: '',
      training_required: undefined, electronic_signature_required: false,
      review_required: true, approval_required: true,
    },
  });

  useEffect(() => {
    void listDocuments({ effectiveOnly: true }).then((docs) =>
      setDocOpts(docs.filter((d) => ['effective', 'approved'].includes(d.status) && d.is_latest !== false)
        .map((d) => ({ id: d.id, number: d.document_number, title: d.document_title, version: d.version, type: d.document_type }))),
    );
  }, []);

  const selected = docOpts.find((d) => d.id === form.watch('document_id'));
  const nextVersion = selected ? incrementVersionNumber(selected.version, form.watch('revision_type')) : '—';

  const preview: Partial<DocumentVersionRecord> = {
    document_number: selected?.number,
    document_title: selected?.title,
    version_number: nextVersion,
    revision_type: form.watch('revision_type'),
    revision_reason: form.watch('revision_reason'),
    change_summary: form.watch('change_summary'),
    training_required: form.watch('training_required'),
  };

  const onSubmit = async (data: RevisionCreateInput) => {
    setSubmitting(true);
    try {
      const actor = { id: user?.uid || 'anonymous', name: profile?.full_name || 'Unknown', role: normalizeRole(profile?.role) };
      const created = await createDocumentRevision(data, actor);
      toast.success(`Revision v${created.version_number} created`);
      router.push('/qms/documents/version-control');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create revision'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <DmsPageHeader title="Create Document Revision" description="Create a new major or minor revision" trail={[{ label: 'Version Control', href: '/qms/documents/version-control' }, { label: 'Create' }]} />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Revision Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Document *</Label>
              <select {...form.register('document_id')} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select document</option>
                {docOpts.map((d) => <option key={d.id} value={d.id}>{d.number} — {d.title} (v{d.version})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Revision Type</Label>
                <select {...form.register('revision_type')} className="w-full rounded-md border px-3 py-2 text-sm">
                  {REVISION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>New Version</Label><Input value={nextVersion} readOnly className="bg-muted font-mono" /></div>
            </div>
            <div><Label>Revision Reason *</Label><Input {...form.register('revision_reason')} /></div>
            <div><Label>Change Summary *</Label><Input {...form.register('change_summary')} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Effective Date</Label><Input type="date" {...form.register('effective_date')} /></div>
              <div><Label>Review Due Date</Label><Input type="date" {...form.register('next_review_date')} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('training_required')} /> Training Required (auto for Major)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('electronic_signature_required')} /> Electronic Signature Required</label>
          </CardContent>
        </Card>
        {selected && <ChangeSummaryCard record={preview as DocumentVersionRecord} />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Revision'}</Button>
        </div>
      </form>
    </div>
  );
}
