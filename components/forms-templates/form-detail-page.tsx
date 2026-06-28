'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { FormStatusBadge, WorkflowTimeline, VersionTimeline, ApprovalTimeline, DocumentPreview } from '@/components/forms-templates/forms-ui';
import { getFormById, submitFormForReview, makeFormEffective } from '@/lib/forms-templates-service';
import { getApprovals } from '@/lib/dms-service';
import type { FormTemplateRecord } from '@/lib/forms-templates-types';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { toast } from 'sonner';

export function FormDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, profile } = useAuth();
  const [form, setForm] = useState<FormTemplateRecord | null>(null);
  const [approvals, setApprovals] = useState<Array<{ stage: string; reviewer: string; decision: string; date: string }>>([]);
  const [loading, setLoading] = useState(true);
  const actor = { id: user?.uid || 'anonymous', name: profile?.full_name || 'Unknown', role: normalizeRole(profile?.role) };

  const load = async () => {
    setLoading(true);
    try {
      const record = await getFormById(id);
      setForm(record);
      if (record?.document_id) {
        const ap = await getApprovals(record.document_id);
        setApprovals(ap.map((a) => ({ stage: a.stage, reviewer: a.reviewer_name, decision: a.decision, date: a.created_at })));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);
  if (loading) return <LoadingSkeleton rows={6} />;
  if (!form) return <p className="text-muted-foreground">Form not found.</p>;

  return (
    <div className="space-y-6">
      <DmsPageHeader title={form.form_title} description={`${form.form_number} · ${form.form_type} · v${form.version}`}
        trail={[{ label: 'Forms & Templates', href: '/qms/documents/forms-templates' }, { label: form.form_number }]}
        actions={<>
          <Button variant="outline" size="sm" asChild><Link href="/qms/documents/forms-templates"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
          {form.document_id && <Button variant="outline" size="sm" asChild><Link href={`/qms/dms/${form.document_id}`}>Open in DMS</Link></Button>}
          {form.status === 'Draft' && <Button size="sm" onClick={async () => { try { await submitFormForReview(id, actor); toast.success('Submitted'); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } }}>Submit for Review</Button>}
          {form.status === 'Approved' && <Button size="sm" onClick={async () => { try { await makeFormEffective(id, actor); toast.success('Effective'); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } }}>Make Effective</Button>}
          <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
        </>} />
      <FormStatusBadge status={form.status} />
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="workflow">Workflow</TabsTrigger><TabsTrigger value="versions">Versions</TabsTrigger><TabsTrigger value="approvals">Approvals</TabsTrigger><TabsTrigger value="preview">Document</TabsTrigger></TabsList>
        <TabsContent value="overview"><Card><CardContent className="pt-6 text-sm space-y-2">
          <p>Owner: {form.owner_name} · Department: {form.department} · Category: {form.category}</p>
          <p>Related SOP: {form.related_sop || '—'} · Related WI: {form.related_wi || '—'}</p>
          <p>Effective: {form.effective_date || '—'} · Review Due: {form.review_due_date || '—'}</p>
          <p>Training: {form.training_required ? 'Required' : 'Not required'}</p>
        </CardContent></Card></TabsContent>
        <TabsContent value="workflow"><Card><CardContent className="pt-6"><WorkflowTimeline currentStatus={form.status} /></CardContent></Card></TabsContent>
        <TabsContent value="versions"><Card><CardContent className="pt-6"><VersionTimeline versions={[{ version: form.version, status: form.status, date: form.updated_at }]} /></CardContent></Card></TabsContent>
        <TabsContent value="approvals"><Card><CardContent className="pt-6"><ApprovalTimeline entries={approvals} /></CardContent></Card></TabsContent>
        <TabsContent value="preview"><DocumentPreview title={form.form_title} /></TabsContent>
      </Tabs>
    </div>
  );
}
