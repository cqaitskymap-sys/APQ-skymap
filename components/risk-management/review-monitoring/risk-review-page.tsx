'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  REVIEW_TYPES,
  EFFECTIVENESS_EVALUATIONS,
  calculateNextReviewDate,
  canApproveRiskReview,
  canCreateRiskReview,
  isRiskReviewReadOnly,
  type RiskReviewFormInput,
  type RiskReviewMonitoringContext,
  type RiskReviewRecord,
} from '@/lib/risk-review-monitoring-records';
import {
  approveRiskReview,
  fetchRiskReviewPageData,
  rejectRiskReview,
  saveRiskReviewDraft,
  submitRiskReviewForQa,
} from '@/lib/risk-review-monitoring-service';
import { riskReviewDraftSchema } from '@/lib/risk-review-monitoring-schemas';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskReviewAccessGuard } from './risk-review-access-guard';
import {
  EffectivenessBadge,
  ReviewStatusBadge,
  RiskLevelBadge,
  RiskTrendBadge,
} from './risk-review-badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function RiskMetricCards({ ctx }: { ctx: RiskReviewMonitoringContext }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">Initial RPN</p>
        <p className="text-2xl font-bold">{ctx.initialRpn}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">Current RPN</p>
        <p className="text-2xl font-bold">{ctx.currentRpn}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">Residual RPN</p>
        <p className="text-2xl font-bold text-red-600">{ctx.residualRpn}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">Risk Trend</p>
        <div className="mt-1"><RiskTrendBadge trend={ctx.riskTrend} /></div>
      </div>
    </div>
  );
}

export function RiskReviewPage({ riskAssessmentId }: { riskAssessmentId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentRecord | null>(null);
  const [reviews, setReviews] = useState<RiskReviewRecord[]>([]);
  const [ctx, setCtx] = useState<RiskReviewMonitoringContext | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [activeReview, setActiveReview] = useState<RiskReviewRecord | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<RiskReviewFormInput>({
    resolver: zodResolver(riskReviewDraftSchema),
    defaultValues: {
      review_date: new Date().toISOString().split('T')[0],
      review_type: 'Quarterly',
      reviewer: actor.name,
      review_frequency: 'Quarterly',
      effectiveness_evaluation: 'Partially Effective',
      new_risks_identified: false,
      repeat_events_observed: false,
      risk_reduction_achieved: false,
      further_mitigation_required: false,
      review_conclusion: '',
      recommendation: '',
      next_review_date: '',
      qa_comments: '',
    },
  });

  const watchedFreq = form.watch('review_frequency');
  const watchedDate = form.watch('review_date');

  useEffect(() => {
    if (watchedDate && watchedFreq) {
      form.setValue('next_review_date', calculateNextReviewDate(watchedDate, watchedFreq));
    }
  }, [watchedDate, watchedFreq, form]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchRiskReviewPageData(riskAssessmentId, actor.name);
    if (data.error || !data.risk) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRisk(data.risk);
    setReviews('reviews' in data ? data.reviews || [] : []);
    setCtx('ctx' in data ? data.ctx || null : null);
    setAuditLogs('auditLogs' in data ? data.auditLogs || [] : []);
    const revs = 'reviews' in data ? data.reviews || [] : [];
    setActiveReview(('latestReview' in data ? data.latestReview : null) || revs[0] || null);
    if ('formDefaults' in data && data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [riskAssessmentId, actor.name, form]);

  useEffect(() => { void load(); }, [load]);

  const readOnly = isRiskReviewReadOnly(profile?.role);
  const canEdit = canCreateRiskReview(profile?.role) && !readOnly;
  const canApprove = canApproveRiskReview(profile?.role) && !readOnly;
  const title = risk?.parameterName || risk?.riskDescription?.slice(0, 80) || risk?.riskNumber || '';

  const handleSave = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await saveRiskReviewDraft(riskAssessmentId, values, actor);
      toast.success('Review draft saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(false); }
  });

  const handleSubmitQa = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await submitRiskReviewForQa(riskAssessmentId, values, actor);
      toast.success('Submitted for QA review');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setBusy(false); }
  });

  const handleApprove = form.handleSubmit(async (values) => {
    if (!activeReview?.id) return toast.error('No active review');
    setBusy(true);
    try {
      await approveRiskReview(riskAssessmentId, activeReview.id, values, actor);
      toast.success('Review approved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally { setBusy(false); }
  });

  const handleReject = async () => {
    if (!activeReview?.id || !rejectReason.trim()) return toast.error('Reject reason required');
    setBusy(true);
    try {
      await rejectRiskReview(riskAssessmentId, activeReview.id, rejectReason, actor);
      toast.success('Review rejected');
      setRejectOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !risk || !ctx) return <ErrorCard title="Unable to load review" message={error || 'Not found'} onRetry={load} />;

  return (
    <RiskReviewAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/risk-management/review-monitoring">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="Risk Review & Monitoring"
              description={`${risk.riskNumber} — ${title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/risk-management/audit-trail' },
                { label: 'Review & Monitoring', href: '/qms/risk-management/review-monitoring' },
                { label: risk.riskNumber },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RiskLevelBadge level={risk.riskLevel} />
          <RiskLevelBadge level={ctx.residualRiskLevel} />
          <RiskTrendBadge trend={ctx.riskTrend} />
          {activeReview && <ReviewStatusBadge status={activeReview.status} />}
          <EffectivenessBadge evaluation={form.watch('effectiveness_evaluation')} />
        </div>

        {ctx.riskTrend === 'Increasing' && (
          <Alert variant="destructive">
            <AlertTitle>Risk trend increasing</AlertTitle>
            <AlertDescription>QA and Risk Manager have been notified per ICH Q9 surveillance requirements.</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Review Overview</TabsTrigger>
            <TabsTrigger value="monitoring">Risk Monitoring</TabsTrigger>
            <TabsTrigger value="trend">Trend Analysis</TabsTrigger>
            <TabsTrigger value="deviation">Deviation/OOS Review</TabsTrigger>
            <TabsTrigger value="capa">CAPA Review</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="qa">QA Review</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <RiskMetricCards ctx={ctx} />
            <Form {...form}>
              <form className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="review_date" render={({ field }) => (
                    <FormItem><FormLabel>Review Date *</FormLabel><FormControl><Input type="date" {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="reviewer" render={({ field }) => (
                    <FormItem><FormLabel>Reviewer *</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="review_type" render={({ field }) => (
                    <FormItem><FormLabel>Review Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{REVIEW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="review_frequency" render={({ field }) => (
                    <FormItem><FormLabel>Review Frequency</FormLabel><FormControl><Input {...field} disabled={readOnly} /></FormControl></FormItem>
                  )} />
                </div>
                {canEdit && (
                  <Button type="button" variant="outline" onClick={handleSave} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Draft
                  </Button>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="monitoring" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">KPI Monitoring</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <p><span className="text-muted-foreground">Mitigation:</span> {ctx.mitigationStatus}</p>
                <p><span className="text-muted-foreground">Deviations:</span> {ctx.deviationCount}</p>
                <p><span className="text-muted-foreground">OOS:</span> {ctx.oosCount}</p>
                <p><span className="text-muted-foreground">Complaints:</span> {ctx.complaintCount}</p>
                <p><span className="text-muted-foreground">CAPAs:</span> {ctx.capaCount}</p>
                <p><span className="text-muted-foreground">Department:</span> {risk.riskCategory}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Trend Analysis</CardTitle></CardHeader>
              <CardContent>
                <RiskMetricCards ctx={ctx} />
                <Table className="mt-4">
                  <TableHeader><TableRow><TableHead>Review Date</TableHead><TableHead>Residual RPN</TableHead><TableHead>Trend</TableHead><TableHead>Effectiveness</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reviews.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.review_date}</TableCell>
                        <TableCell>{r.residual_rpn}</TableCell>
                        <TableCell><RiskTrendBadge trend={r.risk_trend} /></TableCell>
                        <TableCell><EffectivenessBadge evaluation={r.effectiveness_evaluation} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deviation" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Deviation / OOS Review</CardTitle>
                <CardDescription>Linked quality events for continuous surveillance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Deviation Count: <strong>{ctx.deviationCount}</strong> {risk.linkedDeviationNumber && `(Linked: ${risk.linkedDeviationNumber})`}</p>
                <p>OOS Count: <strong>{ctx.oosCount}</strong> {risk.linkedOosNumber && `(Linked: ${risk.linkedOosNumber})`}</p>
                <p>Complaint Count: <strong>{ctx.complaintCount}</strong></p>
                <Form {...form}>
                  <FormField control={form.control} name="repeat_events_observed" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded border p-3 mt-3">
                      <FormLabel className="font-normal">Repeat Events Observed</FormLabel>
                      <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                    </FormItem>
                  )} />
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capa" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">CAPA Review</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>CAPA Count: <strong>{ctx.capaCount}</strong></p>
                <p>Linked CAPA: {risk.linkedCapaNumber || '—'}</p>
                {ctx.capaCount >= 2 && (
                  <Alert><AlertDescription>Multiple CAPA events — formal investigation recommended.</AlertDescription></Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Recommendation Engine</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ul className="list-disc pl-4 text-sm space-y-1">
                  {ctx.recommendations.map((rec) => <li key={rec}>{rec}</li>)}
                </ul>
                <Form {...form}>
                  <FormField control={form.control} name="recommendation" render={({ field }) => (
                    <FormItem><FormLabel>Recommendations</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl></FormItem>
                  )} />
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qa" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">QA Review</CardTitle></CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField control={form.control} name="effectiveness_evaluation" render={({ field }) => (
                      <FormItem><FormLabel>Effectiveness Evaluation *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{EFFECTIVENESS_EVALUATIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="review_conclusion" render={({ field }) => (
                      <FormItem><FormLabel>Review Conclusion *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="next_review_date" render={({ field }) => (
                      <FormItem><FormLabel>Next Review Date *</FormLabel><FormControl><Input type="date" {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="qa_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Comments</FormLabel><FormControl><Textarea rows={2} {...field} disabled={readOnly} /></FormControl></FormItem>
                    )} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      {([
                        ['new_risks_identified', 'New Risks Identified'],
                        ['risk_reduction_achieved', 'Risk Reduction Achieved'],
                        ['further_mitigation_required', 'Further Mitigation Required'],
                      ] as const).map(([key, label]) => (
                        <FormField key={key} control={form.control} name={key} render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded border p-3">
                            <FormLabel className="font-normal">{label}</FormLabel>
                            <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                          </FormItem>
                        )} />
                      ))}
                    </div>
                    {canEdit && activeReview?.status !== 'Approved' && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleSubmitQa} disabled={busy}>
                          <Send className="h-4 w-4 mr-1" />Submit QA Review
                        </Button>
                      </div>
                    )}
                    {canApprove && activeReview?.status === 'QA Review' && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={handleApprove} disabled={busy}>Approve Review</Button>
                        <Button type="button" variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>Reject</Button>
                      </div>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="pt-4">
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /review|monitor|trend|recommend|approv|reject|schedul/i.test(String(l.actionType || l.action || ''))).map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell>{String(l.actionType || l.action)}</TableCell>
                        <TableCell>{String(l.userName || l.user_name || '—')}</TableCell>
                        <TableCell>{l.dateTime || l.timestamp ? new Date(String(l.dateTime || l.timestamp)).toLocaleString() : '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{String(l.actionDescription || l.reason || '')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No audit entries.</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Review</DialogTitle></DialogHeader>
            <Textarea rows={3} placeholder="Reject reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RiskReviewAccessGuard>
  );
}
