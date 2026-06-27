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
  canApproveCcClosure,
  canRejectCcClosure,
  canReopenCcClosure,
  canReviewCcClosure,
  ccClosureMeaning,
  isCcClosureReadOnly,
  isDepartmentCcClosureViewer,
  mapCcClosureAuditToTimeline,
  type CcClosureFormInput,
  type CcClosureReadiness,
} from '@/lib/cc-closure-records';
import {
  approveCcClosure,
  fetchCcClosurePageData,
  logCcClosureEsignResult,
  logCcClosureSectionReviewed,
  reopenCcClosure,
  rejectCcClosure,
  saveCcClosureDraft,
  submitCcClosureForQaReview,
} from '@/lib/cc-closure-service';
import { ccClosureDraftSchema } from '@/lib/cc-closure-schemas';
import type {
  ChangeApproval,
  ChangeClosure,
  ChangeControlRecord,
  ChangeEffectivenessReview,
  ChangeImplementationAction,
  ChangeImpactAssessment,
  ChangeRiskAssessment,
} from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { CcStatusBadge, CcCategoryBadge } from '@/components/change-control/cc-sub-nav';
import { CcClosureAccessGuard } from './cc-closure-access-guard';
import {
  CcClosureChecklistCard,
  CcClosureReadinessBar,
  CcClosureStatusBadge,
  CcClosureTimeline,
} from './cc-closure-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CcClosurePage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [closure, setClosure] = useState<ChangeClosure | null>(null);
  const [readiness, setReadiness] = useState<CcClosureReadiness | null>(null);
  const [implementation, setImplementation] = useState<ChangeImplementationAction[]>([]);
  const [impact, setImpact] = useState<ChangeImpactAssessment | null>(null);
  const [risk, setRisk] = useState<ChangeRiskAssessment | null>(null);
  const [effectiveness, setEffectiveness] = useState<ChangeEffectivenessReview | null>(null);
  const [approvals, setApprovals] = useState<ChangeApproval[]>([]);
  const [timeline, setTimeline] = useState<ReturnType<typeof mapCcClosureAuditToTimeline>>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [headQaRequired, setHeadQaRequired] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const [esignMode, setEsignMode] = useState<'close' | 'reopen'>('close');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<CcClosureFormInput>({
    resolver: zodResolver(ccClosureDraftSchema),
    defaultValues: {
      impact_assessment_completed: false,
      risk_assessment_completed: false,
      validation_assessment_completed: false,
      implementation_completed: false,
      training_completed: false,
      document_revision_completed: false,
      validation_completed: false,
      csv_completed: false,
      regulatory_action_completed: false,
      effectiveness_review_completed: false,
      effectiveness_result: 'Pending',
      capa_required: false,
      capa_linked: false,
      capa_completed: false,
      all_evidence_reviewed: false,
      qa_closure_comments: '',
      head_qa_comments: '',
      final_closure_conclusion: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcClosurePageData(changeId);
    if (data.error || !data.change) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setChange(data.change);
    setClosure(data.closure || null);
    setReadiness(data.readiness || null);
    setImplementation(data.implementation || []);
    setImpact(data.impact || null);
    setRisk(data.risk || null);
    setEffectiveness(data.effectiveness || null);
    setApprovals(data.approvals || []);
    setAuditLogs(data.auditLogs || []);
    setTimeline(mapCcClosureAuditToTimeline(data.auditLogs || []));
    setHeadQaRequired(data.headQaRequired ?? false);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [changeId, form]);

  useEffect(() => { void load(); }, [load]);

  const readOnly = isCcClosureReadOnly(profile?.role) || isDepartmentCcClosureViewer(profile?.role) || change?.status === 'closed';
  const canReview = canReviewCcClosure(profile?.role) && !readOnly && change?.status !== 'closed';
  const canClose = canApproveCcClosure(profile?.role, change || undefined) && !readOnly;
  const canReject = canRejectCcClosure(profile?.role) && !readOnly;
  const canReopen = canReopenCcClosure(profile?.role);
  const closureReadyStatuses = ['Ready For Closure', 'QA Review', 'Head QA Review', 'Pending'];
  const canAuthorizeClose = canClose
    && change?.status !== 'closed'
    && readiness?.ready
    && Boolean(closure?.id)
    && (closureReadyStatuses.includes(closure?.closure_status || '') || closure?.closure_status === 'Pending');

  const trainingTasks = implementation.filter((a) => a.action_type === 'training');
  const trainingCompleted = trainingTasks.filter((a) => a.status === 'completed').length;

  const handleSaveDraft = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await saveCcClosureDraft(changeId, values, actor);
      toast.success('Closure draft saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(false); }
  });

  const handleSubmitQa = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await submitCcClosureForQaReview(changeId, values, actor);
      toast.success('Submitted for QA review');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setBusy(false); }
  });

  const handleReject = async () => {
    const reason = form.getValues('qa_closure_comments') || 'Closure rejected during QA review';
    setBusy(true);
    try {
      await rejectCcClosure(changeId, reason, actor);
      toast.success('Closure rejected');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally { setBusy(false); }
  };

  const handleClose = async (esignRecord?: { esignRecordId?: string }) => {
    const values = form.getValues();
    setBusy(true);
    try {
      await approveCcClosure(changeId, values, esignRecord?.esignRecordId || '', actor);
      toast.success('Change control closed successfully');
      await load();
    } catch (e) {
      await logCcClosureEsignResult(actor, changeId, false, e instanceof Error ? e.message : 'Failed');
      toast.error(e instanceof Error ? e.message : 'Closure failed');
    } finally { setBusy(false); }
  };

  const handleReopen = async (esignRecord?: { esignRecordId?: string }) => {
    if (!reopenReason.trim()) return toast.error('Reopen reason required');
    setBusy(true);
    try {
      await reopenCcClosure(changeId, reopenReason, esignRecord?.esignRecordId || '', actor);
      toast.success('Change control reopened');
      setReopenOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reopen failed');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !change) return <ErrorCard title="Unable to load closure" message={error || 'Not found'} onRetry={load} />;

  return (
    <CcClosureAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/change-control/closure">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="Change Closure"
              description={`${change.change_control_number} — ${change.change_title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/change-control' },
                { label: 'Closure', href: '/qms/change-control/closure' },
                { label: change.change_control_number },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CcStatusBadge status={change.status} />
          <CcCategoryBadge category={change.change_category} />
          <CcClosureStatusBadge status={closure?.closure_status} />
          {change.status === 'closed' && (
            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-slate-200 px-2 py-0.5">
              <Lock className="h-3 w-3" />Read-only
            </span>
          )}
        </div>

        {readiness && <CcClosureReadinessBar percent={readiness.percent} />}

        {readiness?.blockers.length ? (
          <Alert variant="destructive">
            <AlertTitle>Closure blockers</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">{readiness.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {form.watch('effectiveness_result') === 'Not Effective' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Effectiveness Not Effective</AlertTitle>
            <AlertDescription>Closure is blocked until effectiveness is acceptable or CAPA is initiated.</AlertDescription>
          </Alert>
        )}

        {isDepartmentCcClosureViewer(profile?.role) && (
          <Alert>
            <AlertTitle>Department view</AlertTitle>
            <AlertDescription>You can review closure readiness and summaries. QA authorization is required to close.</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="checklist" onValueChange={(tab) => {
          if (tab === 'implementation') void logCcClosureSectionReviewed(actor, changeId, 'implementation');
          if (tab === 'validation') void logCcClosureSectionReviewed(actor, changeId, 'validation');
          if (tab === 'training') {
            void logCcClosureSectionReviewed(actor, changeId, 'training');
            void logCcClosureSectionReviewed(actor, changeId, 'document');
          }
          if (tab === 'effectiveness') void logCcClosureSectionReviewed(actor, changeId, 'effectiveness');
        }}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="checklist">Closure Checklist</TabsTrigger>
            <TabsTrigger value="implementation">Implementation Summary</TabsTrigger>
            <TabsTrigger value="validation">Validation Summary</TabsTrigger>
            <TabsTrigger value="training">Training & Documents</TabsTrigger>
            <TabsTrigger value="effectiveness">Effectiveness Summary</TabsTrigger>
            <TabsTrigger value="qa">QA Review</TabsTrigger>
            <TabsTrigger value="head-qa">Head QA Approval</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {readiness?.items.map((item) => (
                <CcClosureChecklistCard key={item.key} item={item} />
              ))}
            </div>
            {canReview && (
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Draft
              </Button>
            )}
          </TabsContent>

          <TabsContent value="implementation" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Implementation Summary</CardTitle></CardHeader>
              <CardContent>
                {implementation.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {implementation.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.action_item}</TableCell>
                          <TableCell>{a.responsible_person_name}</TableCell>
                          <TableCell>{a.status}</TableCell>
                          <TableCell>{a.action_type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">No implementation actions recorded.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Validation Summary</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">Validation Impact:</span> {change.validation_impact ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">CSV Impact:</span> {change.csv_impact ? 'Yes' : 'No'}</p>
                {impact && <p><span className="text-muted-foreground">Impact Assessment — Validation:</span> {impact.validation_impact || '—'}</p>}
                <p><span className="text-muted-foreground">Validation Tasks:</span> {implementation.filter((a) => a.action_type === 'validation').length} action(s)</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Training & Documents</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">Training Impact:</span> {change.training_impact ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Training Tasks:</span> {trainingCompleted} / {trainingTasks.length} completed</p>
                <p><span className="text-muted-foreground">Affected Documents:</span> {change.affected_documents || '—'}</p>
                <p><span className="text-muted-foreground">Regulatory Impact:</span> {change.regulatory_impact ? 'Yes' : 'No'}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effectiveness" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Effectiveness Summary</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                {effectiveness ? (
                  <>
                    <p><span className="text-muted-foreground">Result:</span> {effectiveness.result}</p>
                    <p><span className="text-muted-foreground">Review Date:</span> {effectiveness.review_date}</p>
                    <p><span className="text-muted-foreground">Reviewed By:</span> {effectiveness.reviewed_by_name}</p>
                    <p><span className="text-muted-foreground">Conclusion:</span> {effectiveness.conclusion || '—'}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">{change.effectiveness_check_required ? 'Effectiveness review pending.' : 'Effectiveness check not required.'}</p>
                )}
                {risk && <p className="pt-2"><span className="text-muted-foreground">Risk Level:</span> {risk.risk_level} (RPN {risk.rpn})</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qa" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QA Closure Review</CardTitle>
                <CardDescription>QA comments and final conclusion required before closure authorization</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    {change.effectiveness_check_required && (
                      <FormField control={form.control} name="effectiveness_result" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effectiveness Result *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {['Effective', 'Partially Effective', 'Not Effective', 'Pending'].map((v) => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Closure Comments *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="final_closure_conclusion" render={({ field }) => (
                      <FormItem><FormLabel>Final Closure Conclusion *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    {canReview && change.status !== 'closed' && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleSubmitQa} disabled={busy || !readiness?.ready}>
                          <Send className="h-4 w-4 mr-1" />Submit for QA Review
                        </Button>
                        {!headQaRequired && canAuthorizeClose && (
                          <Button type="button" onClick={() => { setEsignMode('close'); setEsignOpen(true); }} disabled={busy || !readiness?.ready} className="gap-1">
                            <Lock className="h-4 w-4" />Authorize Closure (E-Sign)
                          </Button>
                        )}
                        {canReject && ['QA Review', 'Ready For Closure', 'Head QA Review'].includes(closure?.closure_status || '') && (
                          <Button type="button" variant="destructive" onClick={() => void handleReject()} disabled={busy}>
                            Reject Closure
                          </Button>
                        )}
                      </div>
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
                  {headQaRequired ? 'Critical change requires Head QA closure approval with e-signature' : 'Head QA approval available for escalated closures'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...form}>
                  <FormField control={form.control} name="head_qa_comments" render={({ field }) => (
                    <FormItem><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={2} {...field} disabled={readOnly || !canClose} /></FormControl></FormItem>
                  )} />
                </Form>
                {headQaRequired && canAuthorizeClose && (
                  <Button onClick={() => { setEsignMode('close'); setEsignOpen(true); }} disabled={busy || !readiness?.ready} className="gap-1">
                    <Lock className="h-4 w-4" />Authorize Closure (E-Sign)
                  </Button>
                )}
                {change.status === 'closed' && (
                  <p className="text-green-700 text-sm flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />Closed on {closure?.closure_date || '—'}
                  </p>
                )}
                {canReopen && change.status === 'closed' && (
                  <Button variant="outline" onClick={() => setReopenOpen(true)} className="gap-1">
                    <RotateCcw className="h-4 w-4" />Reopen Change Control
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card><CardContent className="pt-4"><CcClosureTimeline entries={timeline} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="pt-4">
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /closure|close|reopen|checklist|sign|validation|training/i.test(String(l.actionType || l.action || ''))).slice(0, 50).map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell>{String(l.actionType || l.action)}</TableCell>
                        <TableCell>{String(l.userName || l.changed_by_name || '—')}</TableCell>
                        <TableCell>{l.dateTime ? new Date(String(l.dateTime)).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No audit entries yet.</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Change Control Closure"
          recordId={changeId}
          documentNumber={change.change_control_number}
          actionType={esignMode === 'close' ? 'Change Closure Authorization' : 'Change Reopen Authorization'}
          signatureMeaning={ccClosureMeaning(esignMode)}
          onSuccess={async (record) => {
            setEsignOpen(false);
            if (esignMode === 'close') await handleClose({ esignRecordId: record.id || record.esignRecordId || '' });
            else await handleReopen({ esignRecordId: record.id || record.esignRecordId || '' });
          }}
          onCancel={() => void logCcClosureEsignResult(actor, changeId, false)}
        />

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reopen Change Control</DialogTitle></DialogHeader>
            <Textarea placeholder="Reason for reopen (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
              <Button onClick={() => { setEsignMode('reopen'); setReopenOpen(false); setEsignOpen(true); }}>Continue to E-Sign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CcClosureAccessGuard>
  );
}
