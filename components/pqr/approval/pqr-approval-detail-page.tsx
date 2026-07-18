'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Archive, ArrowLeft, CheckCircle, PenLine, RefreshCw, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { PqrApprovalRecord } from '@/lib/pqr-approval-records';
import {
  canReopenApprovedPqr,
  canSubmitPqrApproval,
  getCurrentPendingStep,
  signatureMeaningForAction,
  canActOnApproval,
} from '@/lib/pqr-approval-records';
import {
  archiveApprovedPqr,
  completeApprovalStep,
  escalateApproval,
  fetchApprovalRecords,
  fetchPqrById,
  logEsignSuccess,
  logPqrApprovalView,
  rejectPqrApproval,
  reopenApprovedPqr,
  sendBackPqrApproval,
  submitPqrForApproval,
} from '@/lib/pqr-approval-service';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PqrApprovalAccessGuard } from './pqr-approval-access-guard';
import { ApprovalStatusBadge, EsignStatusBadge, RoleBadge, WorkflowStatusBadge } from './pqr-approval-badges';
import { PqrApprovalTimeline } from './pqr-approval-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type EsignAction = 'approve' | 'reject' | 'final';

export function PqrApprovalDetailPage() {
  const params = useParams();
  const pqrId = str(params?.id);

  const { user, profile } = useAuth();
  const role = profile?.role;

  const [pqr, setPqr] = useState<PqrOption | null>(null);
  const [approvals, setApprovals] = useState<PqrApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    name: profile?.full_name || profile?.email || 'System',
    role,
    email: profile?.email || user?.email || '',
  }), [user?.uid, user?.email, profile?.full_name, profile?.email, role]);

  const currentStep = useMemo(() => getCurrentPendingStep(approvals), [approvals]);
  const workflowStatus = approvals[0]?.workflowStatus || 'Draft';
  const canAct = currentStep && canActOnApproval(role, currentStep.currentApproverRole);
  const isFinal = currentStep?.approvalType === 'Final Approved By';
  const locked = workflowStatus === 'Approved' || workflowStatus === 'Archived';

  const load = useCallback(async () => {
    if (!pqrId) return;
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) { setError('Firebase is not configured.'); return; }
      const [p, recs] = await Promise.all([fetchPqrById(pqrId), fetchApprovalRecords(pqrId)]);
      setPqr(p);
      setApprovals(recs);
      if (!p) setError('PQR record not found.');
    } catch { setError('Failed to load approval detail.'); }
    finally { setLoading(false); }
  }, [pqrId]);

  useEffect(() => { void load(); void logPqrApprovalView(actor); }, [load, actor]);

  const openEsign = (action: EsignAction) => {
    setEsignAction(action);
    setEsignOpen(true);
  };

  const handleEsignSuccess = async () => {
    if (!currentStep?.id || !pqrId) return;
    setBusy(true);
    await logEsignSuccess(actor, currentStep.approvalId);
    if (esignAction === 'reject') {
      const { error: err } = await rejectPqrApproval(currentStep.id, pqrId, rejectReason || comments, actor, true);
      setBusy(false);
      setEsignOpen(false);
      setRejectOpen(false);
      if (err) return toast.error(err);
      toast.success('PQR rejected');
    } else {
      const { error: err, completed } = await completeApprovalStep(currentStep.id, pqrId, comments, actor, true);
      setBusy(false);
      setEsignOpen(false);
      if (err) return toast.error(err);
      toast.success(completed ? 'PQR final approved and locked' : 'Approval step completed');
    }
    await load();
  };

  const handleApproveWithoutEsign = async () => {
    if (!currentStep?.id || !pqrId) return;
    if (currentStep.eSignatureRequired) {
      openEsign(isFinal ? 'final' : 'approve');
      return;
    }
    setBusy(true);
    const { error: err, completed } = await completeApprovalStep(currentStep.id, pqrId, comments, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success(completed ? 'PQR final approved' : 'Step approved');
    await load();
  };

  const handleSendBack = async (): Promise<void> => {
    if (!currentStep?.id || !pqrId) return;
    setBusy(true);
    const { error: err } = await sendBackPqrApproval(currentStep.id, pqrId, sendBackReason, actor);
    setBusy(false);
    setSendBackOpen(false);
    if (err) { toast.error(err); return; }
    toast.success('PQR sent back to preparer');
    await load();
  };

  const handleSubmit = async () => {
    if (!pqr) return;
    setBusy(true);
    const { error: err } = await submitPqrForApproval(pqr, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('PQR submitted for approval');
    await load();
  };

  const handleEscalate = async () => {
    if (!currentStep?.id || !pqrId) return;
    setBusy(true);
    const { error: err } = await escalateApproval(currentStep.id, pqrId, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Approval escalated');
    await load();
  };

  const handleArchive = async () => {
    if (!pqrId) return;
    setBusy(true);
    const { error: err } = await archiveApprovedPqr(pqrId, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('PQR archived');
    await load();
  };

  const handleReopen = async (): Promise<void> => {
    if (!pqrId) return;
    setBusy(true);
    const { error: err } = await reopenApprovedPqr(pqrId, reopenReason, actor);
    setBusy(false);
    setReopenOpen(false);
    if (err) { toast.error(err); return; }
    toast.success('PQR reopened');
    await load();
  };

  if (!pqrId) return <PqrApprovalAccessGuard><EmptyState title="Invalid PQR" message="No PQR ID provided." /></PqrApprovalAccessGuard>;
  if (loading) return <PqrApprovalAccessGuard><div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div></PqrApprovalAccessGuard>;
  if (error || !pqr) return <PqrApprovalAccessGuard><div className="p-4 sm:p-6"><ErrorCard message={error || 'PQR not found'} onRetry={() => void load()} /></div></PqrApprovalAccessGuard>;

  return (
    <PqrApprovalAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title={`PQR Approval — ${pqr.pqrNumber}`}
          description={`${pqr.productName} · ${pqr.reviewPeriodFrom} — ${pqr.reviewPeriodTo}`}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'PQR Approval', href: '/pqr/approval' },
            { label: pqr.pqrNumber },
          ]}
          actions={(
            <>
              <Button variant="outline" size="sm" asChild><Link href="/pqr/approval"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}><RefreshCw className={`h-4 w-4 mr-1 ${busy ? 'animate-spin' : ''}`} />Refresh</Button>
            </>
          )}
        />

        <div className="flex flex-wrap gap-2">
          <WorkflowStatusBadge status={workflowStatus} />
          {currentStep && <ApprovalStatusBadge status={currentStep.approvalStatus} />}
          {currentStep && <RoleBadge role={currentStep.currentApproverRole} />}
          {currentStep && <EsignStatusBadge status={currentStep.eSignatureStatus} />}
        </div>

        <div className="flex flex-wrap gap-2">
          {!approvals.length && canSubmitPqrApproval(role) && (
            <Button size="sm" onClick={() => void handleSubmit()} disabled={busy}><Send className="h-4 w-4 mr-1" />Submit for Review</Button>
          )}
          {canAct && !locked && (
            <>
              <Button size="sm" className="bg-green-600" onClick={() => void handleApproveWithoutEsign()} disabled={busy}>
                <CheckCircle className="h-4 w-4 mr-1" />Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEsign(isFinal ? 'final' : 'approve')} disabled={busy}>
                <PenLine className="h-4 w-4 mr-1" />E-Sign Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSendBackOpen(true)} disabled={busy}>Send Back</Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
              <Button size="sm" variant="outline" onClick={() => void handleEscalate()} disabled={busy}>Escalate</Button>
            </>
          )}
          {workflowStatus === 'Approved' && (
            <Button size="sm" variant="outline" onClick={() => void handleArchive()} disabled={busy}><Archive className="h-4 w-4 mr-1" />Archive</Button>
          )}
          {locked && canReopenApprovedPqr(role) && (
            <Button size="sm" variant="outline" onClick={() => setReopenOpen(true)}>Reopen</Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Current Step</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {currentStep ? (
                <>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-muted-foreground">Step</dt><dd className="font-medium">{currentStep.currentWorkflowStep}</dd></div>
                    <div><dt className="text-muted-foreground">Type</dt><dd>{currentStep.approvalType}</dd></div>
                    <div><dt className="text-muted-foreground">Due Date</dt><dd>{currentStep.dueDate || '—'}</dd></div>
                    <div><dt className="text-muted-foreground">E-Sign</dt><dd>{currentStep.eSignatureRequired ? 'Required' : 'Optional'}</dd></div>
                  </dl>
                  <div><Label>Approval Comments</Label><Textarea value={comments} onChange={(e) => setComments(e.target.value)} disabled={!canAct || locked} /></div>
                </>
              ) : (
                <EmptyState title={approvals.length ? 'Workflow complete' : 'Not submitted'} message={approvals.length ? 'All approval steps completed.' : 'Submit this PQR to start approval workflow.'} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
            <CardContent>
              {approvals.length ? <PqrApprovalTimeline approvals={approvals} /> : <EmptyState title="No steps" message="Submit PQR to create workflow steps." />}
            </CardContent>
          </Card>
        </div>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="PQR Approval"
          recordId={currentStep?.id || pqrId}
          documentNumber={pqr.pqrNumber}
          actionType={esignAction === 'reject' ? 'Reject' : 'Approve'}
          signatureMeaning={signatureMeaningForAction(esignAction)}
          onSuccess={() => { void handleEsignSuccess(); }}
        />

        <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title="Reject PQR" label="Rejection reason"
          value={rejectReason} onChange={setRejectReason} confirmLabel="Reject" destructive busy={busy}
          onConfirm={() => {
            if (!rejectReason.trim()) return toast.error('Rejection reason required');
            if (currentStep?.eSignatureRequired) { setRejectOpen(false); openEsign('reject'); return; }
            if (!currentStep?.id) return;
            void rejectPqrApproval(currentStep.id, pqrId, rejectReason, actor).then(({ error: err }) => {
              setRejectOpen(false);
              if (err) toast.error(err); else { toast.success('Rejected'); void load(); }
            });
          }}
        />

        <ReasonDialog open={sendBackOpen} onOpenChange={setSendBackOpen} title="Send Back PQR" label="Send back reason"
          value={sendBackReason} onChange={setSendBackReason} confirmLabel="Send Back" busy={busy}
          onConfirm={() => void handleSendBack()}
        />

        <ReasonDialog open={reopenOpen} onOpenChange={setReopenOpen} title="Reopen Approved PQR" label="Reopen reason"
          value={reopenReason} onChange={setReopenReason} confirmLabel="Reopen" busy={busy}
          onConfirm={() => void handleReopen()}
        />
      </div>
    </PqrApprovalAccessGuard>
  );
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function ReasonDialog({
  open, onOpenChange, title, label, value, onChange, confirmLabel, destructive, busy, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>{label} *</Label>
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
