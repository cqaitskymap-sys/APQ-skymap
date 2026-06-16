'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, Loader2, Lock, RotateCcw, Save, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canCloseDeviationRecord,
  canReopenClosure,
  canReviewClosure,
  type ClosureReadiness,
} from '@/lib/deviation-closure-records';
import {
  closeDeviationWithClosure,
  fetchClosurePageData,
  reopenDeviationClosure,
  saveClosureDraft,
  submitClosureForQaReview,
} from '@/lib/deviation-closure-service';
import { closureDraftSchema, closureFormSchema, type ClosureFormInput } from '@/lib/deviation-schemas';
import type { DeviationClosure, DeviationRecord } from '@/lib/deviation-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationClosureAccessGuard } from './deviation-closure-access-guard';
import {
  ClosureChecklistCard,
  ClosureReadinessBar,
  ClosureStatusBadge,
  ClosureTimeline,
} from './deviation-closure-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function DeviationClosurePage({ deviationId }: { deviationId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [closure, setClosure] = useState<DeviationClosure | null>(null);
  const [readiness, setReadiness] = useState<ClosureReadiness | null>(null);
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

  const form = useForm<ClosureFormInput>({
    resolver: zodResolver(closureDraftSchema),
    defaultValues: {
      investigation_completed: false,
      impact_assessment_completed: false,
      root_cause_identified: false,
      capa_required: false,
      capa_linked: false,
      capa_completed: false,
      effectiveness_check_completed: false,
      product_quality_impact_resolved: false,
      patient_safety_impact_resolved: false,
      regulatory_impact_resolved: false,
      all_attachments_reviewed: false,
      qa_closure_comments: '',
      final_closure_conclusion: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchClosurePageData(deviationId);
    if (data.error || !data.record) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setClosure(data.closure || null);
    setReadiness(data.readiness || null);
    setTimeline(data.timeline || []);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [deviationId, form]);

  useEffect(() => { void load(); }, [load]);

  const canReview = canReviewClosure(profile?.role);
  const canClose = record ? canCloseDeviationRecord(profile?.role, record.criticality) : false;
  const canReopen = canReopenClosure(profile?.role);
  const readOnly = record?.status === 'closed';

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await saveClosureDraft(deviationId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Closure checklist saved'); void load(); }
  };

  const handleSubmitQa = async () => {
    const parsed = closureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await submitClosureForQaReview(deviationId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Submitted for QA closure review'); void load(); }
  };

  const handleClose = async (eSignature: string) => {
    const parsed = closureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await closeDeviationWithClosure(deviationId, parsed.data, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Deviation closed'); void load(); }
  };

  const handleReopen = async (eSignature: string) => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenDeviationClosure(deviationId, reopenReason, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Deviation reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load closure" message={error || 'Not found'} onRetry={load} />;

  return (
    <DeviationClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Closure"
          description={`${record.deviation_number} — GMP-compliant closure workflow`}
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: record.deviation_number, href: `/qms/deviation/${deviationId}` },
            { label: 'Closure' },
          ]}
          actions={(
            <>
              <Link href={`/qms/deviation/${deviationId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Deviation Detail</Button>
              </Link>
              <Link href="/qms/deviation/closure">
                <Button variant="outline" size="sm">All Closures</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <DeviationStatusBadge status={record.status} />
          <DeviationCriticalityBadge criticality={record.criticality} />
          <ClosureStatusBadge status={closure?.closure_status} />
          {readOnly && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Read Only</span>}
        </div>

        {readiness && !readiness.ready && !readOnly && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Missing requirements: {readiness.blockers.join(' · ')}
          </div>
        )}

        {readiness && <ClosureReadinessBar percent={readiness.percent} />}

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
                <ClosureChecklistCard
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
                      ['regulatory_impact_resolved', 'Regulatory Impact Resolved'],
                      ['all_attachments_reviewed', 'All Attachments Reviewed'],
                    ] as const).map(([name, label]) => (
                      <FormField key={name} control={form.control} name={name} render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-3">
                          <FormLabel className="text-sm">{label}</FormLabel>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || !canReview} /></FormControl>
                        </FormItem>
                      )} />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">QA Closure Review</CardTitle>
                    <CardDescription>Comments and final conclusion required before closure</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Closure Comments *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly || !canReview} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="final_closure_conclusion" render={({ field }) => (
                      <FormItem><FormLabel>Final Closure Conclusion *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={readOnly || !canReview} placeholder="Summarize investigation outcome, impact, CAPA status, and justification for closure..." /></FormControl><FormMessage /></FormItem>
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
                        <Lock className="mr-1 h-4 w-4" />Close Deviation
                      </Button>
                    )}
                  </div>
                )}

                {readOnly && canReopen && (
                  <Button variant="outline" onClick={() => setReopenOpen(true)}>
                    <RotateCcw className="mr-1 h-4 w-4" />Reopen Deviation
                  </Button>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="timeline">
            <Card><CardHeader><CardTitle className="text-base">Closure Timeline</CardTitle></CardHeader>
              <CardContent><ClosureTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><ClosureTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Deviation Closure"
          recordId={deviationId}
          documentNumber={record.deviation_number}
          actionType="Close Deviation"
          signatureMeaning="I confirm this deviation meets all closure requirements and authorize closure"
          onSuccess={() => void handleClose(actor.name)}
        />

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reopen Deviation</DialogTitle></DialogHeader>
            <Textarea placeholder="Reopen reason (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button onClick={() => { setReopenOpen(false); setReopenEsignOpen(true); }}>Continue with E-Signature</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ESignatureModal
          open={reopenEsignOpen}
          onOpenChange={setReopenEsignOpen}
          moduleName="Deviation Closure"
          recordId={deviationId}
          documentNumber={record.deviation_number}
          actionType="Reopen Deviation"
          signatureMeaning="I authorize reopening this closed deviation"
          onSuccess={() => void handleReopen(actor.name)}
        />
      </div>
    </DeviationClosureAccessGuard>
  );
}

export function DeviationClosurePageShell({ deviationId }: { deviationId: string }) {
  return <DeviationClosurePage deviationId={deviationId} />;
}
