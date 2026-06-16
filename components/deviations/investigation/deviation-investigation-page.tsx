'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft, CheckCircle, Link2, Loader2, Save, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveCriticalInvestigation,
  canEditInvestigation,
  canReviewInvestigation,
  computeInvestigationAutoRules,
  isReadOnlyInvestigationRole,
  mapAuditToInvestigationTimeline,
  RCA_METHODS,
} from '@/lib/deviation-investigation-records';
import {
  closeInvestigation,
  createCapaFromDeviation,
  fetchInvestigationPageData,
  linkCapa,
  reviewInvestigation,
  saveInvestigationDraft,
  startInvestigation,
  submitInvestigationForQaReview,
  syncInvestigationOverdue,
  uploadAttachment,
} from '@/lib/deviation-investigation-service';
import {
  investigationQaReviewSchema,
  investigationSchema,
  type InvestigationInput,
} from '@/lib/deviation-schemas';
import type { DeviationAttachment, DeviationInvestigation, DeviationRecord } from '@/lib/deviation-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationInvestigationAccessGuard } from './deviation-investigation-access-guard';
import { FiveWhyWorksheet } from './five-why-worksheet';
import { FishbonePlaceholder } from './fishbone-placeholder';
import { InvestigationTimeline } from './investigation-timeline';
import { InvestigationStatusBadge } from './investigation-status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function mapInvToForm(inv: DeviationInvestigation | null, record: DeviationRecord): InvestigationInput {
  return {
    investigation_summary: inv?.investigation_summary || '',
    detailed_investigation: inv?.detailed_investigation || '',
    rca_method: (inv?.rca_method as InvestigationInput['rca_method']) || '5 Why',
    root_cause_details: inv?.root_cause_details || inv?.root_cause || record.root_cause || '',
    root_cause: inv?.root_cause || '',
    contributing_factors: inv?.contributing_factors || '',
    immediate_correction: inv?.immediate_correction || record.immediate_action || '',
    corrective_action_required: inv?.corrective_action_required ?? false,
    preventive_action_required: inv?.preventive_action_required ?? false,
    capa_required: inv?.capa_required ?? record.capa_required ?? false,
    impact_on_batch: (inv?.impact_on_batch || record.batch_impact || (record.batch_impacted ? 'Yes' : 'No')) as InvestigationInput['impact_on_batch'],
    impact_on_product_quality: (inv?.impact_on_product_quality || (record.product_quality_impacted ? 'Yes' : 'No')) as InvestigationInput['impact_on_product_quality'],
    impact_on_patient_safety: (inv?.impact_on_patient_safety || (record.patient_safety_impacted ? 'Yes' : 'No')) as InvestigationInput['impact_on_patient_safety'],
    impact_on_regulatory_compliance: (inv?.impact_on_regulatory_compliance || (record.regulatory_impact ? 'Yes' : 'No')) as InvestigationInput['impact_on_regulatory_compliance'],
    other_batches_impacted: (inv?.other_batches_impacted === 'Yes' ? 'Yes' : 'No') as InvestigationInput['other_batches_impacted'],
    other_batches_details: inv?.other_batches_details || '',
    final_investigation_conclusion: inv?.final_investigation_conclusion || '',
    investigation_due_date: inv?.investigation_due_date || record.target_closure_date || '',
    five_why: inv?.five_why,
  };
}

export function DeviationInvestigationPage({ deviationId }: { deviationId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [investigation, setInvestigation] = useState<DeviationInvestigation | null>(null);
  const [attachments, setAttachments] = useState<DeviationAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [capaNumber, setCapaNumber] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<InvestigationInput>({
    resolver: zodResolver(investigationSchema),
    defaultValues: {
      investigation_summary: '',
      rca_method: '5 Why',
      root_cause_details: '',
    },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string }>({
    resolver: zodResolver(investigationQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computeInvestigationAutoRules(watchAll, record || undefined), [watchAll, record]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchInvestigationPageData(deviationId);
    if (data.error || !data.record) {
      setError(data.error || 'Deviation not found');
      setLoading(false);
      return;
    }
    await syncInvestigationOverdue(deviationId);
    setRecord(data.record);
    setInvestigation(data.investigation || null);
    setAttachments(data.attachments || []);
    setAuditLogs(data.auditLogs || []);
    form.reset(mapInvToForm(data.investigation || null, data.record));
    setLoading(false);
  }, [deviationId, form]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaRequired) form.setValue('capa_required', true);
  }, [autoRules.capaRequired, form]);

  const canEdit = record ? canEditInvestigation(profile?.role, record, actor.id) : false;
  const canReview = canReviewInvestigation(profile?.role) && !isReadOnlyInvestigationRole(profile?.role);
  const canApprove = record ? canApproveCriticalInvestigation(profile?.role, record.criticality) : false;
  const timeline = useMemo(() => mapAuditToInvestigationTimeline(auditLogs), [auditLogs]);

  const handleSaveDraft = async () => {
    if (!record) return;
    setBusy(true);
    const { error: err } = await saveInvestigationDraft(deviationId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Investigation draft saved'); void load(); }
  };

  const handleSubmitReview = async () => {
    if (!record) return;
    setBusy(true);
    const { error: err } = await submitInvestigationForQaReview(deviationId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Submitted for QA review'); void load(); }
  };

  const handleStart = async () => {
    setBusy(true);
    const { error: err } = await startInvestigation(deviationId, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Investigation started'); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load investigation" message={error || 'Not found'} onRetry={load} />;

  const invStatus = investigation?.investigation_status || 'Not Started';
  const showQaReview = invStatus === 'QA Review' && canReview && canApprove;

  return (
    <div className="space-y-6">
      <CpvPageHeader
        title="Deviation Investigation"
        description={`${record.deviation_number} — ${record.title}`}
        trail={[
          { label: 'QMS', href: '/qms/deviation' },
          { label: 'Deviation Management', href: '/qms/deviation' },
          { label: record.deviation_number, href: `/qms/deviation/${deviationId}` },
          { label: 'Investigation' },
        ]}
        actions={(
          <>
            <Link href={`/qms/deviation/${deviationId}`}>
              <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Deviation Detail</Button>
            </Link>
            <Link href="/qms/deviation/investigation">
              <Button variant="outline" size="sm">All Investigations</Button>
            </Link>
          </>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <DeviationStatusBadge status={record.status} />
        <DeviationCriticalityBadge criticality={record.criticality} />
        <InvestigationStatusBadge status={invStatus} />
        {record.capa_required && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">CAPA Required</span>}
      </div>

      {autoRules.warnings.map((w) => (
        <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{w}</div>
      ))}

      {invStatus === 'Not Started' && canEdit && (
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleStart} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Start Investigation
        </Button>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          {['overview', 'investigation', 'rca', 'impact', 'capa', 'attachments', 'qa', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === 'impact' ? 'Impact Assessment' : t === 'qa' ? 'QA Review' : t === 'audit' ? 'Audit Trail' : t === 'capa' ? 'CAPA Link' : t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">Deviation Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[['Department', record.department], ['Product', record.product_name], ['Batch', record.batch_number || '—'],
                  ['Investigator', record.assigned_investigator_name || '—'], ['Due Date', investigation?.investigation_due_date || record.target_closure_date || '—'],
                  ['Start Date', investigation?.investigation_start_date || '—']].map(([l, v]) => (
                  <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
                ))}
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-base">Investigation Timeline</CardTitle></CardHeader>
              <CardContent><InvestigationTimeline entries={timeline.slice(0, 6)} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="investigation">
          <Form {...form}>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Card><CardHeader><CardTitle className="text-base">Investigation Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="investigation_summary" render={({ field }) => (
                    <FormItem><FormLabel>Investigation Summary *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="detailed_investigation" render={({ field }) => (
                    <FormItem><FormLabel>Detailed Investigation</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="immediate_correction" render={({ field }) => (
                    <FormItem><FormLabel>Immediate Correction</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="final_investigation_conclusion" render={({ field }) => (
                    <FormItem><FormLabel>Final Investigation Conclusion</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="investigation_due_date" render={({ field }) => (
                    <FormItem><FormLabel>Investigation Due Date</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                </CardContent>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="rca">
          <Form {...form}>
            <div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-base">Root Cause Analysis</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="rca_method" render={({ field }) => (
                    <FormItem><FormLabel>RCA Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{RCA_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                  <FormField control={form.control} name="root_cause_details" render={({ field }) => (
                    <FormItem><FormLabel>Root Cause *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="contributing_factors" render={({ field }) => (
                    <FormItem><FormLabel>Contributing Factors</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                </CardContent>
              </Card>
              {watchAll.rca_method === '5 Why' && (
                <FiveWhyWorksheet
                  value={watchAll.five_why}
                  disabled={!canEdit}
                  onChange={(v) => {
                    form.setValue('five_why', v);
                    if (v?.rootCause) form.setValue('root_cause', v.rootCause);
                  }}
                />
              )}
              {watchAll.rca_method === 'Fishbone' && <FishbonePlaceholder />}
            </div>
          </Form>
        </TabsContent>

        <TabsContent value="impact">
          <Form {...form}>
            <Card><CardHeader><CardTitle className="text-base">Impact Assessment</CardTitle>
              <CardDescription>Product quality impact = Yes mandates CAPA</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {([
                  ['impact_on_batch', 'Impact On Batch', ['Yes', 'No', 'Not Applicable']],
                  ['impact_on_product_quality', 'Impact On Product Quality', ['Yes', 'No', 'Under Evaluation']],
                  ['impact_on_patient_safety', 'Impact On Patient Safety', ['Yes', 'No', 'Under Evaluation']],
                  ['impact_on_regulatory_compliance', 'Impact On Regulatory Compliance', ['Yes', 'No', 'Under Evaluation']],
                  ['other_batches_impacted', 'Other Batches Impacted', ['Yes', 'No']],
                ] as const).map(([name, label, opts]) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem><FormLabel>{label}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select></FormItem>
                  )} />
                ))}
                <FormField control={form.control} name="other_batches_details" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Other Batches Impact Details</FormLabel>
                    <FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="corrective_action_required" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded border p-3">
                    <FormLabel>Corrective Action Required</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="preventive_action_required" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded border p-3">
                    <FormLabel>Preventive Action Required</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="capa_required" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded border p-3 md:col-span-2">
                    <FormLabel>CAPA Required {autoRules.capaRequired ? '(Auto)' : ''}</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || autoRules.capaRequired} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </Form>
        </TabsContent>

        <TabsContent value="capa">
          <Card><CardHeader><CardTitle className="text-base">CAPA Link</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {record.linked_capa_number ? (
                <div className="rounded-lg border bg-green-50 p-4">
                  <p className="font-mono font-semibold">{record.linked_capa_number}</p>
                  <Link href="/qms/capa" className="text-sm text-blue-600 hover:underline">View CAPA Module →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input placeholder="CAPA Number" value={capaNumber} onChange={(e) => setCapaNumber(e.target.value)} className="max-w-xs" />
                  <Button variant="outline" disabled={!canEdit || !watchAll.capa_required} onClick={async () => {
                    if (!capaNumber) { toast.error('Enter CAPA number'); return; }
                    try {
                      await linkCapa(deviationId, capaNumber, null, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
                      toast.success('CAPA linked');
                      void load();
                    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                  }}><Link2 className="mr-1 h-4 w-4" />Link CAPA</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canEdit || !watchAll.capa_required} onClick={async () => {
                    try {
                      const r = await createCapaFromDeviation(deviationId, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
                      toast.success(`CAPA ${r.capaNumber} created`);
                      void load();
                    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                  }}>Create CAPA Draft</Button>
                </div>
              )}
              {!watchAll.capa_required && <p className="text-sm text-muted-foreground">Enable CAPA Required to link or create CAPA.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card><CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEdit && (
                <Input type="file" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await uploadAttachment(deviationId, file, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
                    toast.success('Uploaded'); void load();
                  } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
                }} />
              )}
              {attachments.length ? attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{a.file_name}</a>
                  <span className="text-xs text-muted-foreground">{a.uploaded_by_name}</span>
                </div>
              )) : <EmptyState title="No attachments" message="Upload investigation evidence, RCA diagrams, or lab reports." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qa">
          <div className="space-y-4">
            {investigation?.qa_comments && (
              <Card><CardContent className="p-4 text-sm">
                <p className="font-medium">Previous QA Review — {investigation.reviewed_by_qa_name}</p>
                <p className="text-muted-foreground">{investigation.qa_review_date ? new Date(investigation.qa_review_date).toLocaleString() : ''}</p>
                <p className="mt-2">{investigation.qa_comments}</p>
              </CardContent></Card>
            )}
            {showQaReview ? (
              <Card><CardHeader><CardTitle className="text-base">QA Review</CardTitle></CardHeader>
                <CardContent>
                  <Form {...qaForm}>
                    <form onSubmit={qaForm.handleSubmit(async (data) => {
                      setBusy(true);
                      const { error: err } = await reviewInvestigation(deviationId, data, actor, record);
                      setBusy(false);
                      if (err) toast.error(err);
                      else { toast.success(data.decision === 'approved' ? 'Investigation approved' : 'Investigation rejected'); void load(); }
                    })} className="space-y-4">
                      <FormField control={qaForm.control} name="decision" render={({ field }) => (
                        <FormItem><FormLabel>Decision</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="approved">Approve</SelectItem>
                              <SelectItem value="rejected">Reject</SelectItem>
                            </SelectContent>
                          </Select></FormItem>
                      )} />
                      <FormField control={qaForm.control} name="qa_comments" render={({ field }) => (
                        <FormItem><FormLabel>QA Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="flex gap-2">
                        <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={busy}><CheckCircle className="mr-1 h-4 w-4" />Submit Review</Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <EmptyState title="QA review not available" message={invStatus !== 'QA Review' ? 'Submit investigation for QA review first.' : 'You do not have permission to review this investigation.'} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
            <CardContent><InvestigationTimeline entries={timeline} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit && !isReadOnlyInvestigationRole(profile?.role) && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Draft
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmitReview} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}Submit for QA Review
          </Button>
          {invStatus === 'Completed' && (
            <Button variant="outline" onClick={async () => {
              const { error: err } = await closeInvestigation(deviationId, actor);
              if (err) toast.error(err);
              else { toast.success('Investigation closed'); void load(); }
            }}><CheckCircle className="mr-1 h-4 w-4" />Close Investigation</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function DeviationInvestigationPageShell({ deviationId }: { deviationId: string }) {
  return (
    <DeviationInvestigationAccessGuard>
      <DeviationInvestigationPage deviationId={deviationId} />
    </DeviationInvestigationAccessGuard>
  );
}
