'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Loader2, RotateCcw, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnCapaApproval,
  canReopenCapa,
  capaApprovalMeaning,
  isCapaApprovalReadOnly,
  isCapaRecordLocked,
  mapHistoryToCapaApprovalTimeline,
} from '@/lib/capa-approval-records';
import {
  approveCapaStep,
  fetchCapaApprovalPageData,
  initializeCapaApprovalWorkflow,
  logCapaEsignResult,
  rejectCapaStep,
  reopenCapaRecord,
  sendBackCapaStep,
} from '@/lib/capa-approval-service';
import type { CapaApproval, CapaApprovalHistoryEntry, CapaRecord } from '@/lib/capa-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaApprovalAccessGuard } from './capa-approval-access-guard';
import {
  CapaApprovalStatusBadge,
  CapaOverdueBadge,
  CapaRoleBadge,
  CapaWorkflowStepBadge,
} from './capa-approval-badges';
import { CapaApprovalTimeline } from './capa-approval-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type EsignAction = 'approve' | 'reject';

export function CapaApprovalPage({ capaId }: { capaId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capa, setCapa] = useState<CapaRecord | null>(null);
  const [approvals, setApprovals] = useState<CapaApproval[]>([]);
  const [history, setHistory] = useState<CapaApprovalHistoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [current, setCurrent] = useState<CapaApproval | null>(null);
  const [workflowWarnings, setWorkflowWarnings] = useState<string[]>([]);

  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [sendBackReason, setSendBackReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const [esignAction, setEsignAction] = useState<EsignAction>('approve');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCapaApprovalPageData(capaId);
    if (data.error || !data.capa) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setCapa(data.capa);
    setApprovals(data.approvals || []);
    setHistory(data.history || []);
    setAuditLogs(data.auditLogs || []);
    setCurrent(data.current || null);

    const warnings: string[] = [];
    const ctx = data.workflowContext;
    if (ctx && !ctx.rcaApproved) warnings.push('Approved RCA is required before approval workflow.');
    if (ctx && ctx.correctiveActionCount < 1) warnings.push('Corrective action plan must exist before approval.');
    if (ctx && ctx.preventiveActionCount < 1) warnings.push('Preventive action plan must exist before approval.');
    if (data.current?.current_workflow_step === 'Effectiveness Review' && ctx?.effectivenessRequired && !ctx.effectivenessCompleted) {
      warnings.push('Effectiveness review must be completed before this step.');
    }
    setWorkflowWarnings(warnings);
    setLoading(false);
  }, [capaId]);

  useEffect(() => { void load(); }, [load]);

  const canAct = current ? canActOnCapaApproval(profile?.role, current.current_role || current.current_approver_role, capa?.action_owner, actor.id) : false;
  const readOnly = isCapaApprovalReadOnly(profile?.role) || (capa ? isCapaRecordLocked(capa) && capa.capa_status === 'closed' : false);
  const canReopen = canReopenCapa(profile?.role);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(current?.due_date && current.due_date < today);
  const timeline = useMemo(() => mapHistoryToCapaApprovalTimeline(history), [history]);

  const handleStartWorkflow = async () => {
    setBusy(true);
    const result = await initializeCapaApprovalWorkflow(capaId, actor);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else { toast.success('Approval workflow started'); void load(); }
  };

  const handleApprove = async (esignRecord?: { esignRecordId?: string }) => {
    if (!current) return;
    setBusy(true);
    const eSignature = esignRecord?.esignRecordId || '';
    const { error: err } = await approveCapaStep(capaId, current.id, comments, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Approval recorded'); setComments(''); void load(); }
  };

  const handleReject = async () => {
    if (!current || !rejectReason.trim()) { toast.error('Rejection reason required'); return; }
    setBusy(true);
    const { error: err } = await rejectCapaStep(capaId, current.id, rejectReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA rejected'); setRejectOpen(false); void load(); }
  };

  const handleSendBack = async () => {
    if (!current || !sendBackReason.trim()) { toast.error('Send back reason required'); return; }
    setBusy(true);
    const { error: err } = await sendBackCapaStep(capaId, current.id, sendBackReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA sent back'); setSendBackOpen(false); void load(); }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenCapaRecord(capaId, reopenReason, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('CAPA reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !capa) return <ErrorCard title="Unable to load approval workflow" message={error || 'Not found'} onRetry={load} />;

  return (
    <CapaApprovalAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/capa/approval">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="CAPA Approval Workflow"
              description={`${capa.capa_number} — ${capa.capa_title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/capa' },
                { label: 'Approval Workflow', href: '/qms/capa/approval' },
                { label: capa.capa_number },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CapaStatusBadge status={capa.capa_status} />
          <CapaPriorityBadge priority={capa.priority} />
          {current && <CapaWorkflowStepBadge step={current.current_workflow_step} />}
          {current && <CapaApprovalStatusBadge status={current.approval_status} />}
          <CapaOverdueBadge overdue={overdue} />
          {capa.is_locked && <span className="text-xs rounded-full bg-slate-200 px-2 py-0.5">Locked</span>}
        </div>

        {workflowWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Workflow prerequisites</AlertTitle>
            <AlertDescription><ul className="list-disc pl-4">{workflowWarnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription>
          </Alert>
        )}

        {!approvals.length && !readOnly && (
          <Card>
            <CardHeader><CardTitle className="text-base">Start Approval Workflow</CardTitle>
              <CardDescription>Initialize GMP-compliant multi-step approval after RCA and action plans are complete.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartWorkflow} disabled={busy || workflowWarnings.length > 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Start Approval Workflow
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="pending">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
            <TabsTrigger value="timeline">Approval Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-4">
            {current && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Step: {current.current_workflow_step}</CardTitle>
                  <CardDescription>
                    Pending with <CapaRoleBadge role={current.current_role || current.current_approver_role} />
                    {current.due_date && ` · Due ${current.due_date}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="Approval comments" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} disabled={!canAct || readOnly} />
                  {canAct && !readOnly && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => { setEsignAction('approve'); setEsignOpen(true); }}
                        disabled={busy || workflowWarnings.length > 0}
                        className="gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />Approve
                      </Button>
                      <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy} className="gap-1">
                        <XCircle className="h-4 w-4" />Reject
                      </Button>
                      <Button variant="outline" onClick={() => setSendBackOpen(true)} disabled={busy} className="gap-1">
                        <RotateCcw className="h-4 w-4" />Send Back
                      </Button>
                    </div>
                  )}
                  {!canAct && !readOnly && <p className="text-sm text-muted-foreground">You do not have permission to act on this step.</p>}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Workflow Steps</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Step</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead>Approver</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell><CapaWorkflowStepBadge step={a.current_workflow_step} /></TableCell>
                        <TableCell><CapaRoleBadge role={a.current_role || a.current_approver_role} /></TableCell>
                        <TableCell><CapaApprovalStatusBadge status={a.approval_status} /></TableCell>
                        <TableCell>{a.due_date || '—'}</TableCell>
                        <TableCell>{a.approver_name || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {canReopen && ['closed', 'approved'].includes(capa.capa_status) && (
              <Button variant="outline" onClick={() => setReopenOpen(true)}>Reopen CAPA</Button>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card><CardContent className="pt-4">
              {history.length ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Date</TableHead><TableHead>Comments</TableHead><TableHead>E-Sign</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {history.map((h, i) => (
                      <TableRow key={`${h.created_at}-${i}`}>
                        <TableCell>{h.action}</TableCell>
                        <TableCell>{h.user_name}</TableCell>
                        <TableCell><CapaRoleBadge role={h.user_role} /></TableCell>
                        <TableCell>{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{h.comments || h.rejection_reason || h.send_back_reason || '—'}</TableCell>
                        <TableCell>{h.e_signature_status || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">No history yet.</p>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card><CardContent className="pt-4"><CapaApprovalTimeline entries={timeline} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="pt-4">
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /approval|approve|reject|escalat|sign|lock|reopen|submit/i.test(String(l.actionType || l.action || ''))).map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell>{String(l.actionType || l.action || '—')}</TableCell>
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
          moduleName="CAPA Approval Workflow"
          recordId={capaId}
          documentNumber={capa.capa_number}
          actionType={current?.current_workflow_step || 'Approval'}
          signatureMeaning={capaApprovalMeaning(current?.current_workflow_step, esignAction)}
          onSuccess={async (record) => {
            await logCapaEsignResult(capaId, true, actor, record.esignRecordId);
            await handleApprove({ esignRecordId: record.esignRecordId });
            setEsignOpen(false);
          }}
          onCancel={() => void logCapaEsignResult(capaId, false, actor, 'Cancelled')}
        />

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject CAPA</DialogTitle></DialogHeader>
            <Textarea placeholder="Rejection reason *" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={busy}>Confirm Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Back CAPA</DialogTitle></DialogHeader>
            <Textarea placeholder="Send back reason *" value={sendBackReason} onChange={(e) => setSendBackReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button>
              <Button onClick={handleSendBack} disabled={busy}>Confirm Send Back</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
    </CapaApprovalAccessGuard>
  );
}
