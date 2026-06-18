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
  COMPLAINT_RCA_METHODS,
  canApproveCriticalComplaintInvestigation,
  canEditComplaintInvestigation,
  canReviewComplaintInvestigation,
  computeComplaintInvestigationAutoRules,
  isComplaintInvestigationReadOnly,
  mapAuditToComplaintInvestigationTimeline,
  mapInvestigationToForm,
} from '@/lib/complaint-investigation-records';
import {
  createCapaFromComplaint,
  fetchComplaintInvestigationPageData,
  reviewComplaintInvestigation,
  saveComplaintInvestigationDraft,
  startComplaintInvestigation,
  submitComplaintInvestigationForQaReview,
  uploadAttachment,
} from '@/lib/complaint-investigation-service';
import {
  complaintInvestigationQaReviewSchema,
  complaintInvestigationSchema,
  type ComplaintInvestigationInput,
} from '@/lib/complaint-schemas';
import type { ComplaintAttachment, ComplaintInvestigation, ComplaintRecord } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintInvestigationAccessGuard } from './complaint-investigation-access-guard';
import { ComplaintInvestigationStatusBadge } from './investigation-status-badge';
import { ComplaintInvestigationTimeline } from './investigation-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ComplaintInvestigationPageShell({ complaintId }: { complaintId: string }) {
  return (
    <ComplaintInvestigationAccessGuard>
      <ComplaintInvestigationPage complaintId={complaintId} />
    </ComplaintInvestigationAccessGuard>
  );
}

function ComplaintInvestigationPage({ complaintId }: { complaintId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  const [investigation, setInvestigation] = useState<ComplaintInvestigation | null>(null);
  const [attachments, setAttachments] = useState<ComplaintAttachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const form = useForm<ComplaintInvestigationInput>({
    resolver: zodResolver(complaintInvestigationSchema),
    defaultValues: { investigation_summary: '', findings: '', impact_assessment: '', conclusion: '', root_cause_method: '5 Why' },
  });

  const qaForm = useForm<{ decision: 'approved' | 'rejected'; qa_comments: string }>({
    resolver: zodResolver(complaintInvestigationQaReviewSchema),
    defaultValues: { decision: 'approved', qa_comments: '' },
  });

  const watchAll = form.watch();
  const autoRules = useMemo(() => computeComplaintInvestigationAutoRules(watchAll, record || undefined), [watchAll, record]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchComplaintInvestigationPageData(complaintId);
    if (data.error || !data.record) {
      setError(data.error || 'Complaint not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setInvestigation(data.investigation || null);
    setAttachments(data.attachments || []);
    setAuditLogs(data.auditLogs || []);
    form.reset(mapInvestigationToForm(data.investigation || null, data.record));
    setLoading(false);
  }, [complaintId, form]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (autoRules.capaRequired) form.setValue('capa_required', true);
    if (autoRules.recallEvaluationRequired) form.setValue('recall_evaluation_required', true);
  }, [autoRules.capaRequired, autoRules.recallEvaluationRequired, form]);

  const canEdit = record ? canEditComplaintInvestigation(profile?.role, record, actor.id) : false;
  const canReview = canReviewComplaintInvestigation(profile?.role) && !isComplaintInvestigationReadOnly(profile?.role);
  const canApprove = record ? canApproveCriticalComplaintInvestigation(profile?.role, record.complaint_criticality) : false;
  const timeline = useMemo(() => mapAuditToComplaintInvestigationTimeline(auditLogs), [auditLogs]);

  const handleSaveDraft = async () => {
    if (!record) return;
    setBusy(true);
    const { error: err } = await saveComplaintInvestigationDraft(complaintId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Investigation draft saved'); void load(); }
  };

  const handleSubmitReview = async () => {
    if (!record) return;
    setBusy(true);
    const { error: err } = await submitComplaintInvestigationForQaReview(complaintId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Submitted for QA review'); void load(); }
  };

  const handleStart = async () => {
    setBusy(true);
    const { error: err } = await startComplaintInvestigation(complaintId, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Investigation started'); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load investigation" message={error || 'Not found'} onRetry={load} />;

  const invStatus = investigation?.investigation_status || 'Not Started';
  const showQaReview = invStatus === 'QA Review' && canReview && canApprove;

  const checklistFields = [
    ['batch_record_review', 'Batch Record Review'],
    ['qc_result_review', 'QC Result Review'],
    ['stability_data_review', 'Stability Data Review'],
    ['manufacturing_process_review', 'Manufacturing Process Review'],
    ['packaging_review', 'Packaging Review'],
    ['distribution_review', 'Distribution Review'],
    ['previous_complaint_review', 'Previous Complaint Review'],
  ] as const;

  return (
    <div className="space-y-6">
      <CpvPageHeader
        title="Complaint Investigation"
        description={`${record.complaint_number} — ${record.product_name}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'QMS', href: '/qms/complaints' },
          { label: 'Complaint Management', href: '/qms/complaints' },
          { label: record.complaint_number, href: `/qms/complaints/${complaintId}` },
          { label: 'Investigation' },
        ]}
        actions={(
          <>
            <Link href={`/qms/complaints/${complaintId}`}>
              <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Complaint Detail</Button>
            </Link>
            <Link href="/qms/complaints/investigation">
              <Button variant="outline" size="sm">All Investigations</Button>
            </Link>
          </>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ComplaintStatusBadge status={record.status} />
        <CriticalityBadge value={record.complaint_criticality} />
        <ComplaintInvestigationStatusBadge status={invStatus} />
        {record.capa_required && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">CAPA Required</span>}
        {record.recall_evaluation_required && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Recall Evaluation</span>}
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
          {[
            ['overview', 'Complaint Overview'],
            ['sample', 'Sample Review'],
            ['checklist', 'Investigation Checklist'],
            ['rca', 'Root Cause Analysis'],
            ['impact', 'Impact/CAPA/Recall'],
            ['qa', 'QA Review'],
            ['attachments', 'Attachments'],
            ['audit', 'Audit Trail'],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Complaint Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[['Customer', record.customer_name], ['Market', record.market_region], ['Product', record.product_name],
                  ['Batch', record.batch_number || '—'], ['Category', record.complaint_category], ['Investigator', record.assigned_to_name || '—'],
                  ['Start Date', investigation?.investigation_start_date || '—'], ['Due Date', investigation?.investigation_due_date || record.due_date || '—'],
                ].map(([l, v]) => (
                  <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
                ))}
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Description</p><p>{record.complaint_description}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent><ComplaintInvestigationTimeline entries={timeline.slice(0, 5)} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sample">
          <Form {...form}>
            <Card>
              <CardHeader><CardTitle className="text-base">Sample & Retain Review</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="retain_sample_available" render={({ field }) => (
                  <FormItem><FormLabel>Retain Sample Available</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="complaint_sample_received" render={({ field }) => (
                  <FormItem><FormLabel>Complaint Sample Received</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="sample_condition" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Sample Condition {watchAll.complaint_sample_received === 'Yes' ? '*' : ''}</FormLabel>
                    <FormControl><Textarea rows={2} {...field} disabled={!canEdit} placeholder="Describe sample integrity, storage, labeling…" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="sample_analysis" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Sample Analysis</FormLabel>
                    <FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>
          </Form>
        </TabsContent>

        <TabsContent value="checklist">
          <Form {...form}>
            <Card>
              <CardHeader><CardTitle className="text-base">Investigation Checklist</CardTitle>
                <CardDescription>QC, Production, Warehouse and QA review checkpoints</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {checklistFields.map(([name, label]) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem><FormLabel>{label}</FormLabel><FormControl><Textarea rows={2} {...field} disabled={!canEdit} /></FormControl></FormItem>
                  )} />
                ))}
                <FormField control={form.control} name="investigation_summary" render={({ field }) => (
                  <FormItem><FormLabel>Investigation Summary *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="findings" render={({ field }) => (
                  <FormItem><FormLabel>Investigation Findings *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>
          </Form>
        </TabsContent>

        <TabsContent value="rca">
          <Form {...form}>
            <Card>
              <CardHeader><CardTitle className="text-base">Root Cause Analysis</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="root_cause_method" render={({ field }) => (
                  <FormItem><FormLabel>Root Cause Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{COMPLAINT_RCA_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="root_cause" render={({ field }) => (
                  <FormItem><FormLabel>Root Cause {watchAll.root_cause_method !== 'No Assignable Cause' ? '*' : ''}</FormLabel>
                    <FormControl><Textarea rows={3} {...field} disabled={!canEdit || watchAll.root_cause_method === 'No Assignable Cause'} /></FormControl><FormMessage /></FormItem>
                )} />
                {watchAll.root_cause_method === 'No Assignable Cause' && (
                  <FormField control={form.control} name="qa_justification" render={({ field }) => (
                    <FormItem><FormLabel>QA Justification *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                <FormField control={form.control} name="conclusion" render={({ field }) => (
                  <FormItem><FormLabel>Final Investigation Conclusion *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>
          </Form>
        </TabsContent>

        <TabsContent value="impact">
          <Form {...form}>
            <Card>
              <CardHeader><CardTitle className="text-base">Impact / CAPA / Recall</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="impact_assessment" render={({ field }) => (
                  <FormItem><FormLabel>Impact Assessment *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="capa_required" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded border p-3">
                    <FormLabel>CAPA Required {autoRules.capaRequired ? '(Mandatory)' : ''}</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || autoRules.capaRequired} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="recall_evaluation_required" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded border p-3">
                    <FormLabel>Recall Evaluation Required {autoRules.recallEvaluationRequired ? '(Mandatory)' : ''}</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || autoRules.recallEvaluationRequired} /></FormControl>
                  </FormItem>
                )} />
                {record.linked_capa_number ? (
                  <div className="rounded-lg border bg-green-50 p-4">
                    <p className="font-mono font-semibold">{record.linked_capa_number}</p>
                    <Link href={`/qms/capa/${record.linked_capa_id}`} className="text-sm text-blue-600 hover:underline">View CAPA →</Link>
                  </div>
                ) : canEdit && watchAll.capa_required && (
                  <Button className="bg-blue-600 hover:bg-blue-700" disabled={busy} onClick={async () => {
                    try {
                      setBusy(true);
                      const capa = await createCapaFromComplaint(complaintId, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
                      toast.success(`CAPA ${capa.capa_number} created`);
                      void load();
                    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                    finally { setBusy(false); }
                  }}><Link2 className="mr-1 h-4 w-4" />Create CAPA from Complaint</Button>
                )}
                {record.linked_recall_number && (
                  <div className="rounded-lg border bg-amber-50 p-4">
                    <p className="font-mono font-semibold">Recall: {record.linked_recall_number}</p>
                    <Link href={`/qms/recall/${record.linked_recall_id}`} className="text-sm text-blue-600 hover:underline">View Recall →</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </Form>
        </TabsContent>

        <TabsContent value="qa">
          <div className="space-y-4">
            {investigation?.qa_review_comments && (
              <Card><CardContent className="p-4 text-sm">
                <p className="font-medium">Previous QA Review — {investigation.reviewed_by_qa_name}</p>
                <p className="text-muted-foreground">{investigation.qa_review_date ? new Date(investigation.qa_review_date).toLocaleString() : ''}</p>
                <p className="mt-2">{investigation.qa_review_comments}</p>
              </CardContent></Card>
            )}
            {showQaReview ? (
              <Card><CardHeader><CardTitle className="text-base">QA Review</CardTitle></CardHeader>
                <CardContent>
                  <Form {...qaForm}>
                    <form onSubmit={qaForm.handleSubmit(async (data) => {
                      setBusy(true);
                      const { error: err } = await reviewComplaintInvestigation(complaintId, data, actor, record);
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
                        <FormItem><FormLabel>QA Review Comments *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={busy}>
                        <CheckCircle className="mr-1 h-4 w-4" />Submit Review
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <EmptyState title="QA review not available" message={invStatus !== 'QA Review' ? 'Submit investigation for QA review first.' : 'You do not have permission to review this investigation.'} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="attachments">
          <Card><CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEdit && (
                <Input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.eml" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await uploadAttachment(complaintId, file, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
                    toast.success('Uploaded'); void load();
                  } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
                }} />
              )}
              {attachments.length ? attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{a.file_name}</a>
                  <span className="text-xs text-muted-foreground">{a.uploaded_by_name}</span>
                </div>
              )) : <EmptyState title="No attachments" message="Upload investigation evidence, sample photos, or customer letters." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
            <CardContent><ComplaintInvestigationTimeline entries={timeline} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit && !isComplaintInvestigationReadOnly(profile?.role) && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Draft
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmitReview} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}Submit for QA Review
          </Button>
        </div>
      )}
    </div>
  );
}
