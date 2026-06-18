'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, Loader2, Lock, Mail, RotateCcw, Save, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canCloseComplaintRecord,
  canReopenComplaintClosure,
  canReviewComplaintClosure,
  canReviewRegulatoryClosureImpact,
  isComplaintClosureReadOnly,
  type ComplaintClosureReadiness,
} from '@/lib/complaint-closure-records';
import {
  closeComplaintWithClosure,
  fetchComplaintClosurePageData,
  reopenComplaintClosure,
  saveComplaintClosureDraft,
  submitComplaintClosureForQaReview,
} from '@/lib/complaint-closure-service';
import {
  complaintClosureDraftSchema,
  complaintClosureFormSchema,
  type ComplaintClosureFormInput,
} from '@/lib/complaint-closure-schemas';
import type { ComplaintClosure, ComplaintRecord } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintClosureAccessGuard } from './complaint-closure-access-guard';
import {
  ComplaintClosureChecklistCard,
  ComplaintClosureReadinessBar,
  ComplaintClosureStatusBadge,
  ComplaintClosureTimeline,
} from './complaint-closure-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ComplaintClosurePage({ complaintId }: { complaintId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  const [closure, setClosure] = useState<ComplaintClosure | null>(null);
  const [readiness, setReadiness] = useState<ComplaintClosureReadiness | null>(null);
  const [timeline, setTimeline] = useState<{ date: string; title: string; description: string; user: string }[]>([]);
  const [esignOpen, setEsignOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenEsignOpen, setReopenEsignOpen] = useState(false);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<ComplaintClosureFormInput>({
    resolver: zodResolver(complaintClosureDraftSchema),
    defaultValues: {
      investigation_completed: false,
      impact_assessment_completed: false,
      capa_required: false,
      capa_linked: false,
      capa_completed: false,
      recall_evaluation_required: false,
      recall_evaluation_completed: false,
      customer_response_required: false,
      customer_response_sent: false,
      product_quality_impact_resolved: false,
      patient_safety_impact_resolved: false,
      regulatory_impact_resolved: false,
      all_attachments_reviewed: false,
      qa_closure_comments: '',
      final_complaint_conclusion: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchComplaintClosurePageData(complaintId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!('record' in data) || !data.record) {
      setError('Not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setClosure(data.closure || null);
    setReadiness(data.readiness || null);
    setTimeline(data.timeline || []);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [complaintId, form]);

  useEffect(() => { void load(); }, [load]);

  const canReview = canReviewComplaintClosure(profile?.role);
  const canRegulatory = canReviewRegulatoryClosureImpact(profile?.role);
  const canClose = record ? canCloseComplaintRecord(profile?.role, record.complaint_criticality) : false;
  const canReopen = canReopenComplaintClosure(profile?.role);
  const readOnly = isComplaintClosureReadOnly(profile?.role, record?.status);

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await saveComplaintClosureDraft(complaintId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Closure checklist saved'); void load(); }
  };

  const handleSubmitQa = async () => {
    const parsed = complaintClosureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await submitComplaintClosureForQaReview(complaintId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Submitted for QA closure review'); void load(); }
  };

  const handleClose = async (eSignature: string) => {
    const parsed = complaintClosureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await closeComplaintWithClosure(complaintId, parsed.data, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Complaint closed'); void load(); }
  };

  const handleReopen = async (eSignature: string) => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenComplaintClosure(complaintId, reopenReason, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Complaint reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load closure" message={error || 'Not found'} onRetry={load} />;

  const customerResponseRequired = form.watch('customer_response_required');

  return (
    <ComplaintClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Closure"
          description={`${record.complaint_number} — GMP-compliant closure after investigation, impact, CAPA, recall, and QA approval`}
          trail={[
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: record.complaint_number, href: `/qms/complaints/${complaintId}` },
            { label: 'Closure' },
          ]}
          actions={(
            <>
              <Link href={`/qms/complaints/${complaintId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Complaint Detail</Button>
              </Link>
              <Link href="/qms/complaints/closure">
                <Button variant="outline" size="sm">All Closures</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ComplaintStatusBadge status={record.status} />
          <CriticalityBadge value={record.complaint_criticality} />
          <ComplaintClosureStatusBadge status={closure?.closure_status} />
          {readOnly && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">Read Only</span>}
        </div>

        {readiness && !readiness.ready && !readOnly && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Missing requirements: {readiness.blockers.join(' · ')}
          </div>
        )}

        {readiness && <ComplaintClosureReadinessBar percent={readiness.percent} />}

        <Tabs defaultValue="checklist">
          <TabsList className="flex h-auto flex-wrap gap-1">
            {['checklist', 'review', 'timeline', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t === 'review' ? 'QA Closure Review' : t === 'audit' ? 'Audit Trail' : t === 'checklist' ? 'Pre-Closure Checklist' : 'Timeline'}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="checklist" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {readiness?.items.map((item) => (
                <ComplaintClosureChecklistCard
                  key={item.key}
                  label={item.label}
                  complete={item.complete}
                  required={item.required}
                  warning={item.warning}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="review">
            <Form {...form}>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <Card>
                  <CardHeader><CardTitle className="text-base">Impact Resolution Confirmation</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['product_quality_impact_resolved', 'Product Quality Impact Resolved'],
                      ['patient_safety_impact_resolved', 'Patient Safety Impact Resolved'],
                      ['regulatory_impact_resolved', 'Regulatory / Market Impact Resolved'],
                      ['all_attachments_reviewed', 'All Attachments Reviewed'],
                    ] as const).map(([name, label]) => (
                      <FormField key={name} control={form.control} name={name} render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-3">
                          <FormLabel className="text-sm">{label}</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={readOnly || !(canReview || (name === 'regulatory_impact_resolved' && canRegulatory))}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    ))}
                  </CardContent>
                </Card>

                {customerResponseRequired && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" />Customer Response</CardTitle>
                      <CardDescription>Confirm written response has been sent to the customer or distributor</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField control={form.control} name="customer_response_sent" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-3">
                          <FormLabel className="text-sm">Customer Response Sent *</FormLabel>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || !canReview} /></FormControl>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">QA Closure Review</CardTitle>
                    <CardDescription>QA comments and final conclusion required before closure</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Closure Comments *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly || !canReview} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="final_complaint_conclusion" render={({ field }) => (
                      <FormItem><FormLabel>Final Complaint Conclusion *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={readOnly || !canReview} placeholder="Summarize investigation, impact, CAPA, recall evaluation, customer response, and justification for closure..." /></FormControl><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>

                {canReview && !readOnly && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={busy} onClick={handleSaveDraft}>
                      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Draft
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={handleSubmitQa}>
                      <Send className="mr-1 h-4 w-4" />Submit QA Review
                    </Button>
                    {canClose && readiness?.ready && (
                      <Button type="button" className="bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => setEsignOpen(true)}>
                        <Lock className="mr-1 h-4 w-4" />Close Complaint
                      </Button>
                    )}
                  </div>
                )}

                {readOnly && canReopen && (
                  <Button variant="outline" onClick={() => setReopenOpen(true)}>
                    <RotateCcw className="mr-1 h-4 w-4" />Reopen Complaint
                  </Button>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="timeline">
            <Card><CardHeader><CardTitle className="text-base">Closure Timeline</CardTitle></CardHeader>
              <CardContent><ComplaintClosureTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><ComplaintClosureTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Complaint Closure"
          recordId={complaintId}
          documentNumber={record.complaint_number}
          actionType="Close Complaint"
          signatureMeaning="I confirm this complaint meets all closure requirements and authorize closure"
          onSuccess={() => void handleClose(actor.name)}
        />

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reopen Complaint</DialogTitle></DialogHeader>
            <Textarea placeholder="Reopen reason (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button onClick={() => { setReopenOpen(false); setReopenEsignOpen(true); }}>Continue with E-Signature</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ESignatureModal
          open={reopenEsignOpen}
          onOpenChange={setReopenEsignOpen}
          moduleName="Complaint Closure"
          recordId={complaintId}
          documentNumber={record.complaint_number}
          actionType="Reopen Complaint"
          signatureMeaning="I authorize reopening this closed complaint"
          onSuccess={() => void handleReopen(actor.name)}
        />
      </div>
    </ComplaintClosureAccessGuard>
  );
}

export function ComplaintClosurePageShell({ complaintId }: { complaintId: string }) {
  return <ComplaintClosurePage complaintId={complaintId} />;
}
