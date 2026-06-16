'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Loader2, RotateCcw, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnOosApproval,
  canCloseOosRecord,
  canReopenOos,
  isOosReadOnly,
  mapHistoryToApprovalTimeline,
} from '@/lib/oos-approval-records';
import {
  approveOosStep,
  fetchOosApprovalPageData,
  logOosEsignResult,
  rejectOosStep,
  reopenOosRecord,
  sendBackOosStep,
} from '@/lib/oos-approval-service';
import type { OosApproval, OosApprovalHistoryEntry, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { OosStatusBadge, RiskBadge } from '@/components/oos/oos-sub-nav';
import { OosApprovalAccessGuard } from './oos-approval-access-guard';
import {
  OosApprovalStatusBadge,
  OosOverdueBadge,
  OosRoleBadge,
  OosWorkflowStepBadge,
} from './oos-approval-badges';
import { OosApprovalTimeline } from './oos-approval-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type EsignAction = 'approve' | 'reject';

function approvalMeaning(step?: string, action: EsignAction = 'approve'): string {
  if (action === 'reject') return 'I reject this OOS investigation.';
  if (step === 'Head QA Approval') return 'I provide final approval for this OOS investigation.';
  if (step === 'Final QA Review') return 'I approve this OOS investigation.';
  return 'I have reviewed this OOS investigation.';
}

export function OosApprovalPage({ oosId }: { oosId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [approvals, setApprovals] = useState<OosApproval[]>([]);
  const [history, setHistory] = useState<OosApprovalHistoryEntry[]>([]);
  const [current, setCurrent] = useState<OosApproval | null>(null);
  const [closureBlocked, setClosureBlocked] = useState<string | null>(null);
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
    const data = await fetchOosApprovalPageData(oosId);
    if (data.error || !data.record) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setApprovals(data.approvals || []);
    setHistory(data.history || []);
    setCurrent(data.current || null);
    setClosureBlocked(data.closureCheck?.canClose === false ? data.closureCheck.reason || null : null);

    const warnings: string[] = [];
    const ctx = data.workflowContext;
    const step = data.current?.current_workflow_step;
    if (step === 'QA Review' && (!ctx?.phase1 || ctx.phase1.status !== 'Completed')) {
      warnings.push('Phase-I must be completed before QA Review.');
    }
    if (step === 'Phase-II Review' && ctx?.phase2Required && (!ctx.phase2 || !['Completed', 'CAPA Required'].includes(ctx.phase2.status || ''))) {
      warnings.push('Phase-II investigation must be completed before this approval step.');
    }
    if (step === 'Impact Assessment Review' && (!ctx?.impact || ctx.impact.status !== 'Approved')) {
      warnings.push('Impact Assessment must be completed and approved before this step.');
    }
    if (['CAPA Review', 'Final QA Review', 'Head QA Approval'].includes(step || '') && ctx?.capaRequired && !ctx.capaLinked) {
      warnings.push('CAPA must be linked before final approval steps.');
    }
    setWorkflowWarnings(warnings);
    setLoading(false);
  }, [oosId]);

  useEffect(() => { void load(); }, [load]);

  const canAct = current ? canActOnOosApproval(profile?.role, current.current_role || current.current_approver_role) : false;
  const readOnly = record ? isOosReadOnly(record) : false;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(current?.due_date && current.due_date < today);
  const timeline = useMemo(() => mapHistoryToApprovalTimeline(history), [history]);

  const openEsign = (action: EsignAction) => {
    setEsignAction(action);
    setEsignOpen(true);
  };

  const handleApprove = async (eSignature: string) => {
    if (!current) return;
    setBusy(true);
    const { error: err } = await approveOosStep(oosId, current.id, comments, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Approval recorded'); setComments(''); void load(); }
  };

  const handleReject = async () => {
    if (!current || !rejectReason.trim()) { toast.error('Rejection reason required'); return; }
    setBusy(true);
    const { error: err } = await rejectOosStep(oosId, current.id, rejectReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('OOS rejected'); setRejectOpen(false); void load(); }
  };

  const handleSendBack = async () => {
    if (!current || !sendBackReason.trim()) { toast.error('Send back reason required'); return; }
    setBusy(true);
    const { error: err } = await sendBackOosStep(oosId, current.id, sendBackReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('OOS sent back'); setSendBackOpen(false); void load(); }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) { toast.error('Reopen reason required'); return; }
    setBusy(true);
    const { error: err } = await reopenOosRecord(oosId, reopenReason, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('OOS reopened'); setReopenOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load approval workflow" message={error || 'Not found'} onRetry={load} />;

  return (
    <OosApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Approval Workflow"
          description={`${record.oos_number} — ${record.product_name} / Batch ${record.batch_number}`}
          trail={[
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: record.oos_number, href: `/qms/oos/${oosId}` },
            { label: 'Approval' },
          ]}
          actions={(
            <>
              <Link href={`/qms/oos/${oosId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />OOS Detail</Button>
              </Link>
              <Link href="/qms/oos/approval">
                <Button variant="outline" size="sm">Approval Dashboard</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <OosStatusBadge status={record.status} />
          <RiskBadge level={record.is_critical_test ? 'Critical' : 'Medium'} />
          {current && <OosWorkflowStepBadge step={current.current_workflow_step} />}
          {current && <OosApprovalStatusBadge status={current.approval_status} />}
          {overdue && <OosOverdueBadge overdue days={0} />}
        </div>

        {workflowWarnings.map((w) => (
          <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{w}</div>
        ))}
        {closureBlocked && record.status === 'approved' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{closureBlocked}</div>
        )}

        <Tabs defaultValue="workflow">
          <TabsList className="flex h-auto flex-wrap gap-1">
            {['workflow', 'history', 'timeline'].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t === 'workflow' ? 'Current Step' : t === 'history' ? 'Approval History' : 'Timeline'}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="workflow" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Current Approval Step</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {current ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[['Step', current.current_workflow_step], ['Status', current.approval_status],
                        ['Approver Role', current.current_role || current.current_approver_role], ['Due Date', current.due_date || '—'],
                        ['Level', String(current.approval_level)], ['E-Sign Required', current.e_signature_required ? 'Yes' : 'No'],
                      ].map(([l, v]) => (
                        <div key={String(l)}>
                          <p className="text-xs text-muted-foreground">{l}</p>
                          {l === 'Approver Role' ? <OosRoleBadge role={String(v)} /> : <p className="font-medium">{v}</p>}
                        </div>
                      ))}
                    </div>
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
                      <OosApprovalStatusBadge status={a.approval_status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {canAct && current && !readOnly && workflowWarnings.length === 0 && (
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

            {record.status === 'approved' && canCloseOosRecord(profile?.role) && (
              <Link href={`/qms/oos/${oosId}/closure`}>
                <Button className="bg-blue-600 hover:bg-blue-700" disabled={Boolean(closureBlocked)}>
                  Close OOS
                </Button>
              </Link>
            )}

            {['closed', 'approved'].includes(record.status) && canReopenOos(profile?.role) && (
              <Button variant="outline" disabled={busy} onClick={() => setReopenOpen(true)}>
                <RotateCcw className="mr-1 h-4 w-4" />Reopen OOS
              </Button>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {history.map((h) => (
                  <div key={h.id || `${h.created_at}-${h.action}`} className="rounded border p-3 text-sm">
                    <div className="flex justify-between gap-2 flex-wrap">
                      <span className="font-medium">{h.oos_number} — {h.action} ({h.user_name})</span>
                      <OosApprovalStatusBadge status={h.e_signature_status || h.action} />
                    </div>
                    <p className="text-muted-foreground mt-1">{h.comments || h.rejection_reason || h.send_back_reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{h.created_at} · {h.user_role}</p>
                  </div>
                ))}
                {!history.length && <p className="text-sm text-muted-foreground">No approval history yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
              <CardContent><OosApprovalTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="OOS Approval"
          recordId={oosId}
          documentNumber={record.oos_number}
          actionType={esignAction === 'approve' ? 'Approve' : 'Reject'}
          signatureMeaning={approvalMeaning(current?.current_workflow_step, esignAction)}
          onSuccess={async () => {
            await logOosEsignResult(oosId, true, actor);
            if (esignAction === 'approve') await handleApprove(actor.name);
          }}
          onCancel={async () => { await logOosEsignResult(oosId, false, actor, 'Cancelled'); }}
        />

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject OOS</DialogTitle></DialogHeader>
            <Textarea placeholder="Rejection reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="destructive" disabled={busy} onClick={handleReject}>Confirm Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Back OOS</DialogTitle></DialogHeader>
            <Textarea placeholder="Send back reason (required)" value={sendBackReason} onChange={(e) => setSendBackReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button disabled={busy} onClick={handleSendBack}>Confirm Send Back</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen OOS</DialogTitle>
              <CardDescription>Head QA or Super Admin only</CardDescription>
            </DialogHeader>
            <Textarea placeholder="Reopen reason (required)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button disabled={busy} onClick={handleReopen}>Confirm Reopen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OosApprovalAccessGuard>
  );
}

export function OosApprovalPageShell({ oosId }: { oosId: string }) {
  return <OosApprovalPage oosId={oosId} />;
}
