'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Lock, RotateCcw, Save, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canApproveHeadQaRiskClosure,
  canReopenRiskClosure,
  canReviewRiskClosure,
  computeRiskClosureReadiness,
  determineFinalRiskEvaluation,
  estimateResidualRpn,
  getMitigationStatus,
  isRiskClosureReadOnly,
  mapClosureAuditToTimeline,
  residualRiskLevel,
  riskClosureMeaning,
  type RiskClosure,
  type RiskClosureFormInput,
  type RiskClosureReadiness,
} from '@/lib/risk-closure-records';
import {
  approveHeadQaRiskClosure,
  closeRiskWithClosure,
  fetchRiskClosurePageData,
  logRiskClosureEsignResult,
  rejectRiskClosure,
  reopenRiskClosure,
  saveRiskClosureDraft,
  submitRiskClosureForQaReview,
} from '@/lib/risk-closure-service';
import { riskClosureDraftSchema } from '@/lib/risk-closure-schemas';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { RiskClosureAccessGuard } from './risk-closure-access-guard';
import {
  ResidualRiskCard,
  RiskAcceptanceBadge,
  RiskClosureChecklistCard,
  RiskClosureReadinessBar,
  RiskClosureStatusBadge,
  RiskClosureTimeline,
} from './risk-closure-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FINAL_RISK_EVALUATIONS } from '@/lib/risk-closure-records';

export function RiskClosurePage({ riskAssessmentId }: { riskAssessmentId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentRecord | null>(null);
  const [closure, setClosure] = useState<RiskClosure | null>(null);
  const [readiness, setReadiness] = useState<RiskClosureReadiness | null>(null);
  const [timeline, setTimeline] = useState<ReturnType<typeof mapClosureAuditToTimeline>>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [headQaRequired, setHeadQaRequired] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const [esignAction, setEsignAction] = useState<'close' | 'reopen'>('close');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<RiskClosureFormInput>({
    resolver: zodResolver(riskClosureDraftSchema),
    defaultValues: {
      risk_assessment_approved: false,
      fmea_completed: false,
      mitigation_actions_completed: false,
      residual_risk_evaluated: false,
      risk_review_completed: false,
      effectiveness_verified: false,
      capa_completed: false,
      change_control_completed: false,
      training_completed: false,
      validation_completed: false,
      final_approval_completed: false,
      capa_required: false,
      change_control_required: false,
      training_required: false,
      validation_required: false,
      closure_justification: '',
      final_risk_evaluation: 'Acceptable',
      qa_closure_comments: '',
      head_qa_comments: '',
    },
  });

  const watched = form.watch();
  const residualRpn = risk ? estimateResidualRpn(risk) : 0;
  const residualLevel = residualRiskLevel(residualRpn);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchRiskClosurePageData(riskAssessmentId);
    if (data.error || !data.risk) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRisk(data.risk);
    setClosure(data.closure || null);
    setReadiness(data.readiness || null);
    setAuditLogs(data.auditLogs || []);
    setTimeline(mapClosureAuditToTimeline(data.auditLogs || []));
    setHeadQaRequired(data.headQaRequired ?? false);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [riskAssessmentId, form]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!risk) return;
    const r = computeRiskClosureReadiness(risk, watched);
    setReadiness(r);
    const eval_ = determineFinalRiskEvaluation(estimateResidualRpn(risk));
    if (!form.getValues('final_risk_evaluation') || form.getValues('final_risk_evaluation') === 'Acceptable') {
      form.setValue('final_risk_evaluation', eval_ as RiskClosureFormInput['final_risk_evaluation']);
    }
  }, [watched, risk, form]);

  const readOnly = isRiskClosureReadOnly(profile?.role) || risk?.riskStatus === 'Closed';
  const canReview = canReviewRiskClosure(profile?.role) && !readOnly;
  const canHeadQa = canApproveHeadQaRiskClosure(profile?.role);
  const canReopen = canReopenRiskClosure(profile?.role);

  const handleSaveDraft = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await saveRiskClosureDraft(riskAssessmentId, values, actor);
      toast.success('Closure draft saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(false); }
  });

  const handleSubmitQa = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await submitRiskClosureForQaReview(riskAssessmentId, values, actor);
      toast.success('Submitted for QA review');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setBusy(false); }
  });

  const handleHeadQaApprove = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await approveHeadQaRiskClosure(riskAssessmentId, values, actor);
      toast.success('Head QA approval recorded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    } finally { setBusy(false); }
  });

  const handleEsignSuccess = async (record: { esignRecordId?: string }) => {
    const values = form.getValues();
    setBusy(true);
    try {
      if (esignAction === 'close') {
        await closeRiskWithClosure(riskAssessmentId, values, record.esignRecordId || '', actor);
        await logRiskClosureEsignResult(riskAssessmentId, true, actor, record.esignRecordId);
        toast.success('Risk closed successfully');
      } else {
        if (!reopenReason.trim()) throw new Error('Reopen reason required');
        await reopenRiskClosure(riskAssessmentId, reopenReason, record.esignRecordId || '', actor);
        await logRiskClosureEsignResult(riskAssessmentId, true, actor, record.esignRecordId);
        toast.success('Risk reopened');
        setReopenOpen(false);
      }
      setEsignOpen(false);
      await load();
    } catch (e) {
      await logRiskClosureEsignResult(riskAssessmentId, false, actor, e instanceof Error ? e.message : 'Failed');
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally { setBusy(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error('Rejection reason required');
    setBusy(true);
    try {
      await rejectRiskClosure(riskAssessmentId, rejectReason, actor);
      toast.success('Closure rejected');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !risk) return <ErrorCard title="Unable to load closure" message={error || 'Not found'} onRetry={load} />;

  const title = risk.parameterName || risk.riskDescription?.slice(0, 80) || risk.riskNumber;

  return (
    <RiskClosureAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/risk-management/closure">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="Risk Closure"
              description={`${risk.riskNumber} — ${title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/risk-management/audit-trail' },
                { label: 'Risk Management', href: '/qms/risk-management/audit-trail' },
                { label: 'Closure', href: '/qms/risk-management/closure' },
                { label: risk.riskNumber },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">{risk.riskStatus}</span>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">{risk.riskLevel} Risk</span>
          <RiskClosureStatusBadge status={closure?.closure_status} />
          <RiskAcceptanceBadge evaluation={watched.final_risk_evaluation} />
          {risk.isLocked && <span className="inline-flex items-center gap-1 text-xs rounded-full bg-slate-200 px-2 py-0.5"><Lock className="h-3 w-3" />Read Only</span>}
        </div>

        {readiness && <RiskClosureReadinessBar percent={readiness.percent} />}

        {readiness?.blockers.length ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Closure blockers</AlertTitle>
            <AlertDescription><ul className="list-disc pl-4">{readiness.blockers.map((b) => <li key={b}>{b}</li>)}</ul></AlertDescription>
          </Alert>
        ) : null}

        {watched.final_risk_evaluation === 'Not Acceptable' && (
          <Alert variant="destructive">
            <AlertTitle>Additional mitigation required</AlertTitle>
            <AlertDescription>Residual RPN &gt; 100 — risk cannot be closed until further mitigation reduces residual risk.</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="checklist">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="checklist">Closure Checklist</TabsTrigger>
            <TabsTrigger value="summary">Risk Summary</TabsTrigger>
            <TabsTrigger value="mitigation">Mitigation Summary</TabsTrigger>
            <TabsTrigger value="capa">CAPA &amp; Change Control</TabsTrigger>
            <TabsTrigger value="training">Training &amp; Validation</TabsTrigger>
            <TabsTrigger value="qa">QA Review</TabsTrigger>
            <TabsTrigger value="head-qa">Head QA Approval</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {readiness?.items.map((item) => (
                <RiskClosureChecklistCard key={item.key} item={item} />
              ))}
            </div>
            <ResidualRiskCard
              initialRpn={risk.rpnScore}
              residualRpn={residualRpn}
              initialLevel={risk.riskLevel}
              residualLevel={residualLevel}
            />
            <Form {...form}>
              <form className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {([
                    ['capa_required', 'CAPA Required'],
                    ['change_control_required', 'Change Control Required'],
                    ['training_required', 'Training Required'],
                    ['validation_required', 'Validation Required'],
                  ] as const).map(([key, label]) => (
                    <FormField key={key} control={form.control} name={key} render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded border p-3">
                        <FormLabel className="font-normal">{label}</FormLabel>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
                {canReview && risk.riskStatus !== 'Closed' && (
                  <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Draft
                  </Button>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Risk Summary</CardTitle></CardHeader>
              <CardContent className="text-sm grid sm:grid-cols-2 gap-3">
                <p><span className="text-muted-foreground">Risk Number:</span> {risk.riskNumber}</p>
                <p><span className="text-muted-foreground">Category:</span> {risk.riskCategory}</p>
                <p><span className="text-muted-foreground">Product:</span> {risk.productName}</p>
                <p><span className="text-muted-foreground">Owner:</span> {risk.riskOwner}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Description:</span> {risk.riskDescription}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Potential Impact:</span> {risk.potentialImpact || '—'}</p>
                <ResidualRiskCard initialRpn={risk.rpnScore} residualRpn={residualRpn} initialLevel={risk.riskLevel} residualLevel={residualLevel} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mitigation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mitigation Summary</CardTitle>
                <CardDescription>Status: {getMitigationStatus(risk)} | Effectiveness: {risk.effectivenessStatus}</CardDescription>
              </CardHeader>
              <CardContent>
                {(risk.controls || []).length ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Control</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Target</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {risk.controls.map((c) => (
                        <TableRow key={c.controlId}>
                          <TableCell>{c.controlDescription}</TableCell>
                          <TableCell>{c.owner}</TableCell>
                          <TableCell>{c.status}</TableCell>
                          <TableCell>{c.targetDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">{risk.mitigationAction || 'No mitigation controls recorded.'}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capa" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">CAPA &amp; Change Control</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">CAPA Linked:</span> {risk.linkedCapaNumber || '—'} {watched.capa_required ? '(Required)' : ''}</p>
                <p><span className="text-muted-foreground">CAPA Completed:</span> {watched.capa_completed ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Change Control:</span> {risk.linkedChangeControlNumber || '—'} {watched.change_control_required ? '(Required)' : ''}</p>
                <p><span className="text-muted-foreground">CC Completed:</span> {watched.change_control_completed ? 'Yes' : 'No'}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Training &amp; Validation</CardTitle></CardHeader>
              <CardContent>
                <Form {...form}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      ['training_required', 'Training Required', 'training_completed', 'Training Completed'],
                      ['validation_required', 'Validation Required', 'validation_completed', 'Validation Completed'],
                    ] as const).map(([reqKey, reqLabel, doneKey, doneLabel]) => (
                      <div key={reqKey} className="space-y-2">
                        <FormField control={form.control} name={reqKey} render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded border p-3">
                            <FormLabel className="font-normal">{reqLabel}</FormLabel>
                            <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={doneKey} render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded border p-3">
                            <FormLabel className="font-normal">{doneLabel}</FormLabel>
                            <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    ))}
                  </div>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qa" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QA Closure Review</CardTitle>
                <CardDescription>QA comments, justification, and risk acceptance decision required</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField control={form.control} name="final_risk_evaluation" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Risk Evaluation *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {FINAL_RISK_EVALUATIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="closure_justification" render={({ field }) => (
                      <FormItem><FormLabel>Closure Justification *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Closure Comments *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    {canReview && risk.riskStatus !== 'Closed' && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleSubmitQa} disabled={busy || !readiness?.ready}>
                          <Send className="h-4 w-4 mr-1" />Submit for QA Review
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleReject} disabled={busy || !rejectReason.trim()}>
                          Reject
                        </Button>
                      </div>
                    )}
                    {canReview && (
                      <FormItem><FormLabel>Rejection Reason</FormLabel><Textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} disabled={readOnly} /></FormItem>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="head-qa" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Head QA Approval</CardTitle>
                <CardDescription>
                  {headQaRequired
                    ? 'High/Critical risk requires Head QA closure approval with e-signature'
                    : 'Head QA approval available for escalated closures'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...form}>
                  <FormField control={form.control} name="head_qa_comments" render={({ field }) => (
                    <FormItem><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={2} {...field} disabled={readOnly || !canHeadQa} /></FormControl></FormItem>
                  )} />
                </Form>
                {canHeadQa && headQaRequired && closure?.closure_status === 'Head QA Review' && risk.riskStatus !== 'Closed' && (
                  <Button onClick={handleHeadQaApprove} disabled={busy} variant="outline" className="gap-1">
                    <CheckCircle2 className="h-4 w-4" />Approve Head QA Review
                  </Button>
                )}
                {canReview && risk.riskStatus !== 'Closed' && ['Ready For Closure', 'QA Review', 'Head QA Review'].includes(closure?.closure_status || '') && (
                  <Button onClick={() => { setEsignAction('close'); setEsignOpen(true); }} disabled={busy || !readiness?.ready || (headQaRequired && !canHeadQa)} className="gap-1">
                    <Lock className="h-4 w-4" />Authorize Closure (E-Sign)
                  </Button>
                )}
                {risk.riskStatus === 'Closed' && (
                  <p className="text-green-700 text-sm flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />Risk closed on {closure?.closure_date || '—'} by {closure?.closed_by_name || closure?.signed_by}
                  </p>
                )}
                {canReopen && risk.riskStatus === 'Closed' && (
                  <Button variant="outline" onClick={() => setReopenOpen(true)} className="gap-1"><RotateCcw className="h-4 w-4" />Reopen Risk</Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card><CardContent className="pt-4"><RiskClosureTimeline entries={timeline} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="pt-4">
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /closure|close|reopen|checklist|sign|acceptance|qa/i.test(String(l.actionType || l.action || ''))).map((l) => (
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

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Risk Closure"
          recordId={riskAssessmentId}
          documentNumber={risk.riskNumber}
          actionType={esignAction === 'close' ? 'Risk Closure Authorization' : 'Risk Reopen Authorization'}
          signatureMeaning={riskClosureMeaning(esignAction)}
          onSuccess={handleEsignSuccess}
          onCancel={() => void logRiskClosureEsignResult(riskAssessmentId, false, actor, 'Cancelled')}
        />

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reopen Risk Assessment</DialogTitle></DialogHeader>
            <Textarea rows={3} placeholder="Reopen reason (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
              <Button onClick={() => { setEsignAction('reopen'); setEsignOpen(true); }} disabled={!reopenReason.trim()}>
                Continue with E-Sign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RiskClosureAccessGuard>
  );
}
