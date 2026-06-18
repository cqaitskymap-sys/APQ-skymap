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
  canApproveCapaClosure,
  canReopenCapaClosure,
  canReviewCapaClosure,
  capaClosureMeaning,
  isCapaClosureReadOnly,
  type CapaClosureFormInput,
  type CapaClosureReadiness,
  mapClosureAuditToTimeline,
} from '@/lib/capa-closure-records';
import {
  approveCapaClosure,
  fetchCapaClosurePageData,
  logCapaClosureEsignResult,
  reopenCapaClosure,
  saveCapaClosureDraft,
  submitCapaClosureForQaReview,
} from '@/lib/capa-closure-service';
import { capaClosureDraftSchema } from '@/lib/capa-closure-schemas';
import type { CapaClosure, CapaRecord } from '@/lib/capa-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaClosureAccessGuard } from './capa-closure-access-guard';
import {
  CapaClosureChecklistCard,
  CapaClosureReadinessBar,
  CapaClosureStatusBadge,
  CapaClosureTimeline,
} from './capa-closure-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CapaClosurePage({ capaId }: { capaId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [closure, setClosure] = useState<CapaClosure | null>(null);
  const [readiness, setReadiness] = useState<CapaClosureReadiness | null>(null);
  const [timeline, setTimeline] = useState<ReturnType<typeof mapClosureAuditToTimeline>>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [headQaRequired, setHeadQaRequired] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const form = useForm<CapaClosureFormInput>({
    resolver: zodResolver(capaClosureDraftSchema),
    defaultValues: {
      corrective_actions_completed: false,
      preventive_actions_completed: false,
      implementation_verified: false,
      evidence_uploaded: false,
      effectiveness_check_completed: false,
      effectiveness_result: 'Pending',
      risk_reduced: false,
      root_cause_eliminated: false,
      recurrence_prevented: false,
      training_completed: false,
      sop_updated: false,
      change_control_completed: false,
      all_evidence_reviewed: false,
      qa_closure_comments: '',
      head_qa_comments: '',
      final_closure_conclusion: '',
    },
  });

  const watched = form.watch();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCapaClosurePageData(capaId);
    if (data.error || !data.capa) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setCapa(data.capa);
    setClosure(data.closure || null);
    setReadiness(data.readiness || null);
    setAuditLogs(data.auditLogs || []);
    setTimeline(mapClosureAuditToTimeline(data.auditLogs || []));
    setHeadQaRequired(data.headQaRequired ?? false);
    if (data.formDefaults) form.reset(data.formDefaults);
    setLoading(false);
  }, [capaId, form]);

  useEffect(() => { void load(); }, [load]);

  const displayReadiness = readiness;

  const readOnly = isCapaClosureReadOnly(profile?.role) || capa?.capa_status === 'closed';
  const canReview = canReviewCapaClosure(profile?.role) && !readOnly;
  const canClose = canApproveCapaClosure(profile?.role, capa || undefined) && !readOnly;
  const canReopen = canReopenCapaClosure(profile?.role);

  const handleSaveDraft = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await saveCapaClosureDraft(capaId, values, actor);
      toast.success('Closure draft saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setBusy(false); }
  });

  const handleSubmitQa = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await submitCapaClosureForQaReview(capaId, values, actor);
      toast.success('Submitted for QA review');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally { setBusy(false); }
  });

  const handleClose = async (esignRecord?: { esignRecordId?: string }) => {
    const values = form.getValues();
    setBusy(true);
    try {
      await approveCapaClosure(capaId, values, esignRecord?.esignRecordId || '', actor);
      toast.success('CAPA closed successfully');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Closure failed');
    } finally { setBusy(false); }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) return toast.error('Reopen reason required');
    setBusy(true);
    try {
      await reopenCapaClosure(capaId, reopenReason, actor);
      toast.success('CAPA reopened');
      setReopenOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reopen failed');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error || !capa) return <ErrorCard title="Unable to load closure" message={error || 'Not found'} onRetry={load} />;

  return (
    <CapaClosureAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/capa/closure">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="CAPA Closure"
              description={`${capa.capa_number} — ${capa.capa_title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/capa' },
                { label: 'Closure', href: '/qms/capa/closure' },
                { label: capa.capa_number },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CapaStatusBadge status={capa.capa_status} />
          <CapaPriorityBadge priority={capa.priority} />
          <CapaClosureStatusBadge status={closure?.closure_status} />
          {capa.is_locked && <span className="inline-flex items-center gap-1 text-xs rounded-full bg-slate-200 px-2 py-0.5"><Lock className="h-3 w-3" />Locked</span>}
        </div>

        {displayReadiness && <CapaClosureReadinessBar percent={displayReadiness.percent} />}

        {displayReadiness?.blockers.length ? (
          <Alert variant="destructive">
            <AlertTitle>Closure blockers</AlertTitle>
            <AlertDescription><ul className="list-disc pl-4">{displayReadiness.blockers.map((b) => <li key={b}>{b}</li>)}</ul></AlertDescription>
          </Alert>
        ) : null}

        {closure?.additional_monitoring_recommended && (
          <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Additional monitoring recommended</AlertTitle>
            <AlertDescription>Partially effective CAPA — continue monitoring per QA procedure.</AlertDescription></Alert>
        )}

        {closure?.new_capa_recommended && (
          <Alert variant="destructive"><AlertTitle>New CAPA recommended</AlertTitle>
            <AlertDescription>Effectiveness result indicates a new CAPA should be initiated.</AlertDescription></Alert>
        )}

        <Tabs defaultValue="checklist">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="checklist">Closure Checklist</TabsTrigger>
            <TabsTrigger value="qa">QA Review</TabsTrigger>
            <TabsTrigger value="head-qa">Head QA Approval</TabsTrigger>
            <TabsTrigger value="timeline">Closure Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {displayReadiness?.items.map((item) => (
                <CapaClosureChecklistCard key={item.key} item={item} />
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Closure Report Summary</CardTitle></CardHeader>
              <CardContent className="text-sm grid sm:grid-cols-2 gap-2">
                <p><span className="text-muted-foreground">Effectiveness:</span> {watched.effectiveness_result}</p>
                <p><span className="text-muted-foreground">Risk Reduced:</span> {watched.risk_reduced ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Root Cause Eliminated:</span> {watched.root_cause_eliminated ? 'Yes' : 'No'}</p>
                <p><span className="text-muted-foreground">Recurrence Prevented:</span> {watched.recurrence_prevented ? 'Yes' : 'No'}</p>
              </CardContent>
            </Card>

            <Form {...form}>
              <form className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {([
                    ['implementation_verified', 'Implementation Verified'],
                    ['risk_reduced', 'Risk Reduced'],
                    ['root_cause_eliminated', 'Root Cause Eliminated'],
                    ['recurrence_prevented', 'Recurrence Prevented'],
                  ] as const).map(([key, label]) => (
                    <FormField key={key} control={form.control} name={key} render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded border p-3">
                        <FormLabel className="font-normal">{label}</FormLabel>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
                {canReview && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Draft
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="qa" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">QA Closure Review</CardTitle>
                <CardDescription>QA comments and final conclusion required before closure authorization</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField control={form.control} name="qa_closure_comments" render={({ field }) => (
                      <FormItem><FormLabel>QA Closure Comments *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="final_closure_conclusion" render={({ field }) => (
                      <FormItem><FormLabel>Final Closure Conclusion *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={readOnly} /></FormControl><FormMessage /></FormItem>
                    )} />
                    {canReview && capa.capa_status !== 'closed' && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleSubmitQa} disabled={busy || !displayReadiness?.ready}>
                          <Send className="h-4 w-4 mr-1" />Submit for QA Review
                        </Button>
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
                <CardDescription>{headQaRequired ? 'Critical CAPA requires Head QA closure approval with e-signature' : 'Head QA approval available for escalated closures'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...form}>
                  <FormField control={form.control} name="head_qa_comments" render={({ field }) => (
                    <FormItem><FormLabel>Head QA Comments</FormLabel><FormControl><Textarea rows={2} {...field} disabled={readOnly || !canClose} /></FormControl></FormItem>
                  )} />
                </Form>
                {canClose && capa.capa_status !== 'closed' && ['Ready For Closure', 'QA Review', 'Head QA Review'].includes(closure?.closure_status || '') && (
                  <Button onClick={() => setEsignOpen(true)} disabled={busy || !displayReadiness?.ready} className="gap-1">
                    <Lock className="h-4 w-4" />Authorize Closure (E-Sign)
                  </Button>
                )}
                {capa.capa_status === 'closed' && (
                  <p className="text-green-700 text-sm flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />CAPA closed on {closure?.closure_date || '—'}</p>
                )}
                {canReopen && capa.capa_status === 'closed' && (
                  <Button variant="outline" onClick={() => setReopenOpen(true)} className="gap-1"><RotateCcw className="h-4 w-4" />Reopen CAPA</Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card><CardContent className="pt-4"><CapaClosureTimeline entries={timeline} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="pt-4">
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /closure|close|reopen|checklist|sign/i.test(String(l.actionType || l.action || ''))).map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell>{String(l.actionType || l.action)}</TableCell>
                        <TableCell>{String(l.userName || l.user_name || '—')}</TableCell>
                        <TableCell>{l.dateTime || l.timestamp ? new Date(String(l.dateTime || l.timestamp)).toLocaleString() : '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{String(l.actionDescription || l.reason || '')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="CAPA Closure"
          recordId={capaId}
          documentNumber={capa.capa_number}
          actionType="CAPA Closure Authorization"
          signatureMeaning={capaClosureMeaning('close')}
          onSuccess={async (record) => {
            await logCapaClosureEsignResult(capaId, true, actor, record.esignRecordId);
            await handleClose({ esignRecordId: record.esignRecordId });
            setEsignOpen(false);
          }}
          onCancel={() => void logCapaClosureEsignResult(capaId, false, actor, 'Cancelled')}
        />

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reopen CAPA</DialogTitle></DialogHeader>
            <Textarea placeholder="Reopen reason *" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
              <Button onClick={handleReopen} disabled={busy}>Confirm Reopen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CapaClosureAccessGuard>
  );
}
