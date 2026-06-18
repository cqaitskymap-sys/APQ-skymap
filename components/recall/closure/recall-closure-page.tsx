'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle, ArrowLeft, CheckCircle, Loader2, Lock, RotateCcw, Save, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  recallClosureDraftSchema,
  recallClosureFormSchema,
  type RecallClosureDraftInput,
} from '@/lib/recall-closure-schemas';
import {
  canCloseRecallClosureModule,
  canReopenRecallClosureModule,
  canReviewRecallClosureModule,
  mapRecallClosureAuditAction,
  RECALL_CLOSURE_MODULE,
  type RecallClosureReadiness,
} from '@/lib/recall-closure-records';
import {
  closeRecallWithClosure,
  fetchRecallClosurePageData,
  logRecallClosureEsignResult,
  rejectRecallClosure,
  reopenRecallClosure,
  saveRecallClosureDraft,
  submitRecallClosureForQaReview,
} from '@/services/recallClosureService';
import type { CapaRecord } from '@/lib/capa-types';
import type { RecallClosure, RecallRecord, RecallRegulatoryNotification } from '@/lib/recall-types';
import { isRecallCritical, requiresClassIApproval } from '@/lib/recall-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { RecallClosureAccessGuard } from './recall-closure-access-guard';
import {
  RecallClosureChecklistCard,
  RecallClosureReadinessBar,
  RecallClosureRecoveryChart,
  RecallClosureStatusBadge,
  RecallClosureTimeline,
} from './recall-closure-ui';
import { ClassificationBadge, RecallStatusBadge } from '@/components/recall/recall-sub-nav';
import { RegulatoryNotificationStatusBadge } from '@/components/recall/regulatory/recall-regulatory-badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function RecallClosurePage({ recallId }: { recallId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<RecallRecord | null>(null);
  const [closure, setClosure] = useState<RecallClosure | null>(null);
  const [readiness, setReadiness] = useState<RecallClosureReadiness | null>(null);
  const [regulatory, setRegulatory] = useState<RecallRegulatoryNotification | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [recoverySummary, setRecoverySummary] = useState({ distributed: 0, recovered: 0, pending: 0, percent: 0 });
  const [timeline, setTimeline] = useState<{ date: string; title: string; description: string; user: string }[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [esignOpen, setEsignOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenEsignOpen, setReopenEsignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<RecallClosureDraftInput>({
    resolver: zodResolver(recallClosureDraftSchema),
    defaultValues: {
      pending_quantity_justification: '',
      customer_communication_completed: false,
      product_disposal_completed: false,
      qa_closure_comments: '',
      head_qa_comments: '',
      final_recall_conclusion: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchRecallClosurePageData(recallId);
    if (data.error || !data.record) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setClosure(data.closure || null);
    setReadiness(data.readiness || null);
    setRegulatory(data.regulatory || null);
    setCapa(data.capa || null);
    setRecoverySummary(data.recoverySummary || { distributed: 0, recovered: 0, pending: 0, percent: 0 });
    setTimeline(data.timeline || []);
    setAuditLogs(data.auditLogs || []);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [recallId, form]);

  useEffect(() => { void load(); }, [load]);

  const canReview = canReviewRecallClosureModule(profile?.role);
  const canClose = record ? canCloseRecallClosureModule(profile?.role, record.recall_classification) : false;
  const canReopen = canReopenRecallClosureModule(profile?.role);
  const readOnly = record?.recall_status === 'closed' || closure?.closure_status === 'Closed';

  const handleSaveDraft = async () => {
    setBusy(true);
    const { error: err } = await saveRecallClosureDraft(recallId, form.getValues(), actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Closure checklist saved'); void load(); }
  };

  const handleSubmitQa = async () => {
    const parsed = recallClosureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await submitRecallClosureForQaReview(recallId, parsed.data, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Submitted for QA review'); void load(); }
  };

  const handleClose = async (eSignature: string) => {
    const parsed = recallClosureFormSchema.safeParse(form.getValues());
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Validation failed'); return; }
    setBusy(true);
    const { error: err } = await closeRecallWithClosure(recallId, parsed.data, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Recall closed successfully'); void load(); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason required'); return; }
    setBusy(true);
    const { error: err } = await rejectRecallClosure(recallId, rejectReason, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Closure rejected'); setRejectOpen(false); void load(); }
  };

  const handleReopen = async (eSignature: string) => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenRecallClosure(recallId, { reopen_reason: reopenReason, e_signature: eSignature }, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Recall reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) {
    return <RecallClosureAccessGuard><LoadingSkeleton rows={8} /></RecallClosureAccessGuard>;
  }

  if (error || !record) {
    return <RecallClosureAccessGuard><ErrorCard title="Error" message={error || 'Not found'} onRetry={load} /></RecallClosureAccessGuard>;
  }

  return (
    <RecallClosureAccessGuard>
      <CpvPageHeader
        title="Recall Closure"
        description="Final closure review for product recall, recovery and regulatory actions"
        trail={[
          { label: 'QMS', href: '/dashboard' },
          { label: 'Product Recall', href: '/qms/recall' },
          { label: record.recall_number, href: `/qms/recall/${recallId}` },
          { label: 'Recall Closure' },
        ]}
        actions={(
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/qms/recall/${recallId}`}><ArrowLeft className="h-4 w-4 mr-1" />Recall Detail</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/qms/recall/${recallId}/recovery`}>Recovery</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/qms/recall/${recallId}/regulatory`}>Regulatory</Link>
            </Button>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RecallStatusBadge status={record.recall_status} />
        <ClassificationBadge value={record.recall_classification} />
        <RecallClosureStatusBadge status={closure?.closure_status} />
        {closure?.closure_id && <span className="text-xs font-mono text-muted-foreground">{closure.closure_id}</span>}
      </div>

      {readOnly && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Recall Closed</AlertTitle>
          <AlertDescription>This recall is closed and read-only. Reopen requires Head QA or Super Admin approval.</AlertDescription>
        </Alert>
      )}

      {isRecallCritical(record) && !readOnly && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Class I Recall</AlertTitle>
          <AlertDescription>Head QA approval and complete regulatory notification are mandatory before closure.</AlertDescription>
        </Alert>
      )}

      {readiness && !readiness.ready && !readOnly && (
        <Alert className="mb-4 border-amber-200 bg-amber-50">
          <AlertTitle>Not Ready for Closure</AlertTitle>
          <AlertDescription>{readiness.blockers.slice(0, 3).join(' · ')}{readiness.blockers.length > 3 ? '…' : ''}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <RecallClosureReadinessBar percent={readiness?.percent ?? 0} />
      </div>

      <Tabs defaultValue="checklist">
        <TabsList className="flex h-auto flex-wrap w-full justify-start">
          {['checklist', 'summaries', 'conclusion', 'timeline', 'audit'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'summaries' ? 'Summaries' : t === 'conclusion' ? 'Final Conclusion' : t === 'audit' ? 'Audit Trail' : 'Checklist'}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="checklist" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {readiness?.items.map((item) => (
              <RecallClosureChecklistCard key={item.key} label={item.label} complete={item.complete} required={item.required} warning={item.warning} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="summaries" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recovery Summary</CardTitle></CardHeader>
              <CardContent>
                <RecallClosureRecoveryChart {...recoverySummary} percent={recoverySummary.percent} />
                <Button variant="link" size="sm" className="mt-2 px-0" asChild>
                  <Link href={`/qms/recall/${recallId}/recovery`}>View recovery tracking</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Regulatory Summary</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">Required:</span> {record.regulatory_notification_required || isRecallCritical(record) ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Authority:</span> {regulatory?.regulatory_authority || record.regulatory_authority || '—'}</p>
                <p><span className="text-muted-foreground">Status:</span> <RegulatoryNotificationStatusBadge status={regulatory?.notification_status || 'Pending'} /></p>
                <Button variant="link" size="sm" className="px-0" asChild>
                  <Link href={`/qms/recall/${recallId}/regulatory`}>View regulatory notification</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">CAPA Summary</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">CAPA Required:</span> {record.capa_required ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Linked:</span> {record.linked_capa_number || capa?.capa_number || '—'}</p>
                <p><span className="text-muted-foreground">Status:</span> {capa?.capa_status || '—'}</p>
                <p><span className="text-muted-foreground">Effectiveness:</span> {capa?.effectiveness_result || '—'}</p>
                {record.linked_capa_id && (
                  <Button variant="link" size="sm" className="px-0" asChild>
                    <Link href={`/qms/capa/${record.linked_capa_id}`}>View CAPA</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conclusion" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final Closure Review</CardTitle>
              <CardDescription>Complete conclusion, confirmations and approval comments</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4 max-w-3xl">
                  {recoverySummary.percent < 100 && (
                    <FormField control={form.control} name="pending_quantity_justification" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pending Quantity Justification *</FormLabel>
                        <FormControl><Textarea rows={3} {...field} disabled={readOnly} placeholder="Justify pending quantity when recovery is below 100%" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="customer_communication_completed" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Customer Communication Completed</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="product_disposal_completed" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Product Disposal Completed</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="final_recall_conclusion" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final Recall Conclusion *</FormLabel>
                      <FormControl><Textarea rows={4} {...field} disabled={readOnly} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                    <FormItem>
                      <FormLabel>QA Closure Comments *</FormLabel>
                      <FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {(requiresClassIApproval(record.recall_classification) || canClose) && (
                    <FormField control={form.control} name="head_qa_comments" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Head QA Comments</FormLabel>
                        <FormControl><Textarea rows={2} {...field} disabled={readOnly} /></FormControl>
                      </FormItem>
                    )} />
                  )}

                  {!readOnly && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {canReview && (
                        <>
                          <Button type="button" variant="outline" disabled={busy} onClick={handleSaveDraft} className="gap-1">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Draft
                          </Button>
                          <Button type="button" disabled={busy} onClick={handleSubmitQa} className="gap-1">
                            <Send className="h-4 w-4" />Submit QA Review
                          </Button>
                        </>
                      )}
                      {canClose && (
                        <Button type="button" disabled={busy || !(readiness?.ready)} className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => setEsignOpen(true)}>
                          <CheckCircle className="h-4 w-4" />Close Recall
                        </Button>
                      )}
                      {canReview && (
                        <Button type="button" variant="destructive" disabled={busy} className="gap-1" onClick={() => setRejectOpen(true)}>
                          <XCircle className="h-4 w-4" />Reject
                        </Button>
                      )}
                    </div>
                  )}

                  {readOnly && canReopen && (
                    <Button type="button" variant="outline" className="gap-1 mt-2" onClick={() => setReopenOpen(true)}>
                      <RotateCcw className="h-4 w-4" />Reopen Recall
                    </Button>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card><CardContent className="pt-6"><RecallClosureTimeline entries={timeline} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No audit entries</TableCell></TableRow>
                  ) : auditLogs.map((log, i) => (
                    <TableRow key={String(log.id || i)}>
                      <TableCell>{mapRecallClosureAuditAction(String(log.actionType || ''))}</TableCell>
                      <TableCell className="max-w-md truncate">{String(log.actionDescription || log.reason || '')}</TableCell>
                      <TableCell>{String(log.userName || (log.user as { name?: string } | undefined)?.name || '')}</TableCell>
                      <TableCell>{String(log.timestamp || log.dateTime || '').slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ESignatureModal
        open={esignOpen}
        onOpenChange={setEsignOpen}
        moduleName={RECALL_CLOSURE_MODULE}
        recordId={recallId}
        documentNumber={closure?.closure_id || record.recall_number}
        actionType="Recall Closure"
        signatureMeaning="I confirm this product recall has been fully investigated, recovered and documented for closure"
        onSuccess={() => {
          void logRecallClosureEsignResult(recallId, actor, true);
          void handleClose(actor.name);
        }}
        onCancel={() => void logRecallClosureEsignResult(recallId, actor, false)}
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Closure</DialogTitle></DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="Rejection reason..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={busy}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reopen Recall</DialogTitle></DialogHeader>
          <Textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={4} placeholder="Reopen reason (required)..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button onClick={() => { setReopenOpen(false); setReopenEsignOpen(true); }}>Continue with E-Signature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ESignatureModal
        open={reopenEsignOpen}
        onOpenChange={setReopenEsignOpen}
        moduleName={RECALL_CLOSURE_MODULE}
        recordId={recallId}
        documentNumber={closure?.closure_id || record.recall_number}
        actionType="Recall Reopen"
        signatureMeaning="I authorize reopening this closed product recall"
        onSuccess={() => void handleReopen(actor.name)}
      />
    </RecallClosureAccessGuard>
  );
}
