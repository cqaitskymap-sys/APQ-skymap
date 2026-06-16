'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Loader2, RotateCcw, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnDeviationApproval,
  canCloseDeviationRecord,
  canReopenDeviation,
  mapAuditToApprovalTimeline,
} from '@/lib/deviation-approval-records';
import {
  approveDeviationStep,
  closeApprovedDeviation,
  fetchApprovalPageData,
  logEsignResult,
  rejectDeviationStep,
  reopenDeviation,
  sendBackDeviationStep,
} from '@/lib/deviation-approval-service';
import type { DeviationApproval, DeviationApprovalHistoryEntry, DeviationRecord } from '@/lib/deviation-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationApprovalAccessGuard } from './deviation-approval-access-guard';
import {
  DeviationApprovalStatusBadge,
  DeviationOverdueBadge,
  DeviationRoleBadge,
  DeviationWorkflowStepBadge,
} from './deviation-approval-badges';
import { DeviationApprovalTimeline } from './deviation-approval-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type EsignAction = 'approve' | 'reject';

export function DeviationApprovalPage({ deviationId }: { deviationId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [approvals, setApprovals] = useState<DeviationApproval[]>([]);
  const [history, setHistory] = useState<DeviationApprovalHistoryEntry[]>([]);
  const [current, setCurrent] = useState<DeviationApproval | null>(null);
  const [investigationComplete, setInvestigationComplete] = useState(false);
  const [capaSatisfied, setCapaSatisfied] = useState(true);

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
    const data = await fetchApprovalPageData(deviationId);
    if (data.error || !data.record) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setApprovals(data.approvals || []);
    setHistory(data.history || []);
    setCurrent(data.current || null);
    setInvestigationComplete(data.investigationComplete ?? false);
    setCapaSatisfied(data.capaSatisfied ?? true);
    setLoading(false);
  }, [deviationId]);

  useEffect(() => { void load(); }, [load]);

  const canAct = current ? canActOnDeviationApproval(profile?.role, current.current_role) : false;
  const readOnly = record?.status === 'closed';
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(current?.due_date && current.due_date < today);
  const timeline = useMemo(() => mapAuditToApprovalTimeline(history), [history]);

  const openEsign = (action: EsignAction) => {
    setEsignAction(action);
    setEsignOpen(true);
  };

  const handleApprove = async (eSignature: string) => {
    if (!current) return;
    setBusy(true);
    const { error: err } = await approveDeviationStep(deviationId, current.id, comments, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Approval recorded'); setComments(''); void load(); }
  };

  const handleReject = async () => {
    if (!current || !rejectReason.trim()) { toast.error('Rejection reason required'); return; }
    setBusy(true);
    const { error: err } = await rejectDeviationStep(deviationId, current.id, rejectReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Deviation rejected'); setRejectOpen(false); void load(); }
  };

  const handleSendBack = async () => {
    if (!current || !sendBackReason.trim()) { toast.error('Send back reason required'); return; }
    setBusy(true);
    const { error: err } = await sendBackDeviationStep(deviationId, current.id, sendBackReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Deviation sent back'); setSendBackOpen(false); void load(); }
  };

  const handleClose = async () => {
    setBusy(true);
    const { error: err } = await closeApprovedDeviation(deviationId, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Deviation closed'); void load(); }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenDeviation(deviationId, reopenReason, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Deviation reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load approval workflow" message={error || 'Not found'} onRetry={load} />;

  return (
    <DeviationApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Approval Workflow"
          description={`${record.deviation_number} — ${record.title}`}
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: record.deviation_number, href: `/qms/deviation/${deviationId}` },
            { label: 'Approval' },
          ]}
          actions={(
            <>
              <Link href={`/qms/deviation/${deviationId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Deviation Detail</Button>
              </Link>
              <Link href="/qms/deviation/approval">
                <Button variant="outline" size="sm">Approval Dashboard</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <DeviationStatusBadge status={record.status} />
          <DeviationCriticalityBadge criticality={record.criticality} />
          {current && <DeviationWorkflowStepBadge step={current.current_workflow_step} />}
          {current && <DeviationApprovalStatusBadge status={current.approval_status} />}
          {overdue && <DeviationOverdueBadge overdue days={0} />}
        </div>

        {!investigationComplete && current?.current_workflow_step === 'QA Review' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Investigation must be completed before QA approval.
          </div>
        )}
        {!capaSatisfied && current?.current_workflow_step === 'Final Approval' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Mandatory CAPA must be linked and closed with effectiveness completed before final approval.
          </div>
        )}

        <Tabs defaultValue="workflow">
          <TabsList className="flex h-auto flex-wrap gap-1">
            {['workflow', 'history', 'timeline', 'audit'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t === 'workflow' ? 'Current Step' : t === 'history' ? 'Approval History' : t === 'audit' ? 'Audit Trail' : 'Timeline'}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="workflow" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Current Approval Step</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {current ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[['Step', current.current_workflow_step], ['Status', current.approval_status],
                          ['Approver Role', current.current_role], ['Due Date', current.due_date || '—'],
                          ['Level', String(current.approval_level)], ['E-Sign Required', current.e_signature_required ? 'Yes' : 'No'],
                        ].map(([l, v]) => (
                          <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p>
                            {l === 'Approver Role' ? <DeviationRoleBadge role={String(v)} /> : <p className="font-medium">{v}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No pending approval step. Workflow may be complete or not yet initialized.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Workflow Steps</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {approvals.filter((a) => !a.is_deleted).map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span>{a.current_workflow_step}</span>
                      <DeviationApprovalStatusBadge status={a.approval_status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {canAct && current && !readOnly && (
              <Card>
                <CardHeader><CardTitle className="text-base">Approval Actions</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="Comments" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
                  <div className="flex flex-wrap gap-2">
                    <Button className="bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => {
                      if (current.e_signature_required) openEsign('approve');
                      else void handleApprove(actor.name);
                    }}>
                      <CheckCircle className="mr-1 h-4 w-4" />Approve
                    </Button>
                    <Button variant="destructive" disabled={busy} onClick={() => setRejectOpen(true)}>
                      <XCircle className="mr-1 h-4 w-4" />Reject
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => setSendBackOpen(true)}>
                      <Send className="mr-1 h-4 w-4" />Send Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {record.status === 'approved' && canCloseDeviationRecord(profile?.role) && (
              <Button className="bg-blue-600 hover:bg-blue-700" disabled={busy} onClick={handleClose}>
                Close Deviation
              </Button>
            )}

            {['closed', 'approved'].includes(record.status) && canReopenDeviation(profile?.role) && (
              <Button variant="outline" disabled={busy} onClick={() => setReopenOpen(true)}>
                <RotateCcw className="mr-1 h-4 w-4" />Reopen Deviation
              </Button>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card><CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {approvals.filter((a) => ['Approved', 'Rejected', 'Sent Back', 'Completed'].includes(a.approval_status || '')).map((a) => (
                  <div key={a.id} className="rounded border p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{a.current_workflow_step} — {a.approver_name}</span>
                      <DeviationApprovalStatusBadge status={a.approval_status} />
                    </div>
                    <p className="text-muted-foreground mt-1">{a.comments || a.rejection_reason || a.send_back_reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.completed_date || a.signed_at}</p>
                  </div>
                ))}
                {!approvals.some((a) => a.approval_status === 'Approved') && (
                  <p className="text-sm text-muted-foreground">No completed approval steps yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card><CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
              <CardContent><DeviationApprovalTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><DeviationApprovalTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Deviation Approval"
          recordId={deviationId}
          documentNumber={record.deviation_number}
          actionType={esignAction === 'approve' ? 'Approve' : 'Reject'}
          signatureMeaning={esignAction === 'approve' ? 'I approve this deviation workflow step' : 'I reject this deviation'}
          onSuccess={async () => {
            await logEsignResult(deviationId, true, actor);
            if (esignAction === 'approve') await handleApprove(actor.name);
          }}
          onCancel={async () => { await logEsignResult(deviationId, false, actor, 'Cancelled'); }}
        />

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Deviation</DialogTitle></DialogHeader>
            <Textarea placeholder="Rejection reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="destructive" disabled={busy} onClick={handleReject}>Confirm Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Back Deviation</DialogTitle></DialogHeader>
            <Textarea placeholder="Send back reason (required)" value={sendBackReason} onChange={(e) => setSendBackReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button disabled={busy} onClick={handleSendBack}>Confirm Send Back</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reopen Deviation</DialogTitle>
              <CardDescription>Super Admin or Head QA only</CardDescription></DialogHeader>
            <Textarea placeholder="Reopen reason (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button disabled={busy} onClick={handleReopen}>Confirm Reopen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DeviationApprovalAccessGuard>
  );
}

export function DeviationApprovalPageShell({ deviationId }: { deviationId: string }) {
  return <DeviationApprovalPage deviationId={deviationId} />;
}
