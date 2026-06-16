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
  canCloseOosClosureRecord,
  canReopenOosClosure,
  canReviewOosClosure,
  oosClosureDraftSchema,
  oosClosureFormSchema,
  type OosClosureFormInput,
  type OosClosureReadiness,
} from '@/lib/oos-closure-records';
import {
  closeOosWithClosure,
  fetchOosClosurePageData,
  logOosClosureEsignResult,
  reopenOosClosure,
  saveOosClosureDraft,
  submitOosClosureForQaReview,
} from '@/lib/oos-closure-service';
import type { OosClosure, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { OosStatusBadge, RiskBadge } from '@/components/oos/oos-sub-nav';
import { OosClosureAccessGuard } from './oos-closure-access-guard';
import {
  OosClosureChecklistCard,
  OosClosureReadinessBar,
  OosClosureStatusBadge,
  OosClosureTimeline,
} from './oos-closure-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function OosClosurePage({ oosId }: { oosId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [closure, setClosure] = useState<OosClosure | null>(null);
  const [readiness, setReadiness] = useState<OosClosureReadiness | null>(null);
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

  const form = useForm<OosClosureFormInput>({
    resolver: zodResolver(oosClosureDraftSchema),
    defaultValues: {
      batch_impact_resolved: false,
      product_quality_impact_resolved: false,
      patient_safety_impact_resolved: false,
      regulatory_impact_resolved: false,
      market_impact_resolved: false,
      all_attachments_reviewed: false,
      qa_closure_comments: '',
      final_oos_conclusion: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchOosClosurePageData(oosId);
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
  }, [oosId, form]);

  useEffect(() => { void load(); }, [load]);

  const canReview = canReviewOosClosure(profile?.role);
  const canClose = record ? canCloseOosClosureRecord(profile?.role, record) : false;
  const canReopen = canReopenOosClosure(profile?.role);
  const readOnly = record?.status === 'closed';

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await saveOosClosureDraft(oosId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Closure checklist saved'); void load(); }
  };

  const handleSubmitQa = async () => {
    const parsed = oosClosureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await submitOosClosureForQaReview(oosId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Submitted for QA closure review'); void load(); }
  };

  const handleClose = async (eSignature: string) => {
    const parsed = oosClosureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await closeOosWithClosure(oosId, parsed.data, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('OOS closed'); void load(); }
  };

  const handleReopen = async (eSignature: string) => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenOosClosure(oosId, reopenReason, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('OOS reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load closure" message={error || 'Not found'} onRetry={load} />;

  return (
    <OosClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Closure"
          description="Final closure review for Out of Specification investigation"
          trail={[
            { label: 'Dashboard', href: '/qms/oos' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: record.oos_number, href: `/qms/oos/${oosId}` },
            { label: 'OOS Closure' },
          ]}
          actions={(
            <>
              <Link href={`/qms/oos/${oosId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />OOS Detail</Button>
              </Link>
              <Link href="/qms/oos/closure">
                <Button variant="outline" size="sm">All Closures</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <OosStatusBadge status={record.status} />
          <RiskBadge level={record.is_critical_test ? 'Critical' : 'Medium'} />
          <OosClosureStatusBadge status={closure?.closure_status} />
          {readOnly && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"><Lock className="h-3 w-3" />Read Only</span>}
        </div>

        {record.status !== 'approved' && record.status !== 'closed' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            OOS must complete final approval before closure. Current status: {record.status.replace(/_/g, ' ')}.
          </div>
        )}

        {readiness && !readiness.ready && !readOnly && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Missing requirements: {readiness.blockers.join(' · ')}
          </div>
        )}

        {readiness && <OosClosureReadinessBar percent={readiness.percent} />}

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
                <OosClosureChecklistCard
                  key={item.key}
                  label={item.label}
                  complete={item.complete}
                  required={item.required}
                  warning={item.warning}
                />
              ))}
            </div>
            {canReview && !readOnly && (
              <Button variant="outline" disabled={busy} onClick={handleSaveDraft}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                Save Checklist
              </Button>
            )}
          </TabsContent>

          <TabsContent value="review">
            <Form {...form}>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <Card>
                  <CardHeader><CardTitle className="text-base">Impact Resolution Confirmation</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['batch_impact_resolved', 'Batch Impact Resolved'],
                      ['product_quality_impact_resolved', 'Product Quality Impact Resolved'],
                      ['patient_safety_impact_resolved', 'Patient Safety Impact Resolved'],
                      ['regulatory_impact_resolved', 'Regulatory Impact Resolved'],
                      ['market_impact_resolved', 'Market Impact Resolved'],
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
                    <CardTitle className="text-base">Final Conclusion & QA Comments</CardTitle>
                    <CardDescription>Required for closure</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="final_oos_conclusion" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final OOS Conclusion</FormLabel>
                        <FormControl><Textarea rows={4} {...field} disabled={readOnly || !canReview} placeholder="Scientific conclusion summarizing investigation outcome..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                      <FormItem>
                        <FormLabel>QA Closure Comments</FormLabel>
                        <FormControl><Textarea rows={3} {...field} disabled={readOnly || !canReview} placeholder="QA review comments for closure..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {canReview && !readOnly && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={busy} onClick={handleSaveDraft}>
                      <Save className="mr-1 h-4 w-4" />Save Draft
                    </Button>
                    <Button variant="outline" disabled={busy || !readiness?.ready} onClick={handleSubmitQa}>
                      <Send className="mr-1 h-4 w-4" />Submit for QA Review
                    </Button>
                    {canClose && record.status === 'approved' && (
                      <Button className="bg-green-600 hover:bg-green-700" disabled={busy || !readiness?.ready} onClick={() => setEsignOpen(true)}>
                        <Lock className="mr-1 h-4 w-4" />Close OOS
                      </Button>
                    )}
                  </div>
                )}

                {canReopen && readOnly && (
                  <Button variant="outline" disabled={busy} onClick={() => setReopenOpen(true)}>
                    <RotateCcw className="mr-1 h-4 w-4" />Reopen OOS
                  </Button>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="timeline">
            <Card><CardHeader><CardTitle className="text-base">Closure Timeline</CardTitle></CardHeader>
              <CardContent><OosClosureTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><OosClosureTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="OOS Closure"
          recordId={oosId}
          documentNumber={record.oos_number}
          actionType="Close"
          signatureMeaning="I provide final approval for closure of this OOS investigation."
          onSuccess={async () => {
            await logOosClosureEsignResult(oosId, true, actor);
            await handleClose(actor.name);
          }}
          onCancel={async () => { await logOosClosureEsignResult(oosId, false, actor, 'Cancelled'); }}
        />

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen OOS</DialogTitle>
              <CardDescription>Head QA or Super Admin only — e-signature required</CardDescription>
            </DialogHeader>
            <Textarea placeholder="Reopen reason (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button disabled={busy} onClick={() => { setReopenOpen(false); setReopenEsignOpen(true); }}>Continue to E-Sign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ESignatureModal
          open={reopenEsignOpen}
          onOpenChange={setReopenEsignOpen}
          moduleName="OOS Closure"
          recordId={oosId}
          documentNumber={record.oos_number}
          actionType="Reopen"
          signatureMeaning="I authorize reopening of this closed OOS investigation."
          onSuccess={async () => {
            await logOosClosureEsignResult(oosId, true, actor, 'Reopen');
            await handleReopen(actor.name);
          }}
          onCancel={async () => { await logOosClosureEsignResult(oosId, false, actor, 'Reopen cancelled'); }}
        />
      </div>
    </OosClosureAccessGuard>
  );
}

export function OosClosurePageShell({ oosId }: { oosId: string }) {
  return <OosClosurePage oosId={oosId} />;
}
