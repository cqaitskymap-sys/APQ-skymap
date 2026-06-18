'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Loader2, Play, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnComplaintApproval,
  isComplaintApprovalReadOnly,
  mapAuditToComplaintApprovalTimeline,
} from '@/lib/complaint-approval-records';
import {
  approveComplaintStep,
  fetchComplaintApprovalPageData,
  initializeComplaintApprovalWorkflow,
  logComplaintEsignResult,
  rejectComplaintStep,
  sendBackComplaintStep,
} from '@/lib/complaint-approval-service';
import type { ComplaintApproval, ComplaintApprovalHistoryEntry, ComplaintRecord } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintApprovalAccessGuard } from './complaint-approval-access-guard';
import {
  ComplaintApprovalStatusBadge,
  ComplaintOverdueBadge,
  ComplaintRoleBadge,
  ComplaintWorkflowStepBadge,
} from './complaint-approval-badges';
import { ComplaintApprovalTimeline } from './complaint-approval-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ComplaintApprovalPage({ complaintId }: { complaintId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  const [approvals, setApprovals] = useState<ComplaintApproval[]>([]);
  const [history, setHistory] = useState<ComplaintApprovalHistoryEntry[]>([]);
  const [current, setCurrent] = useState<ComplaintApproval | null>(null);
  const [investigationComplete, setInvestigationComplete] = useState(false);
  const [impactComplete, setImpactComplete] = useState(false);
  const [capaSatisfied, setCapaSatisfied] = useState(true);
  const [recallComplete, setRecallComplete] = useState(true);

  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [sendBackReason, setSendBackReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchComplaintApprovalPageData(complaintId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!('record' in data) || !data.record) {
      setError('Not found');
      setLoading(false);
      return;
    }
    setRecord(data.record);
    setApprovals(data.approvals || []);
    setHistory(data.history || []);
    setCurrent(data.current || null);
    setInvestigationComplete(data.investigationComplete ?? false);
    setImpactComplete(data.impactComplete ?? false);
    setCapaSatisfied(data.capaSatisfied ?? true);
    setRecallComplete(data.recallComplete ?? true);
    setLoading(false);
  }, [complaintId]);

  useEffect(() => { void load(); }, [load]);

  const canAct = current ? canActOnComplaintApproval(profile?.role, current.current_role) : false;
  const readOnly = isComplaintApprovalReadOnly(record);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(current?.due_date && current.due_date < today);
  const timeline = useMemo(() => mapAuditToComplaintApprovalTimeline(history), [history]);
  const workflowNotStarted = approvals.filter((a) => !a.is_deleted).length === 0;

  const handleInitWorkflow = async () => {
    setBusy(true);
    const { error: err } = await initializeComplaintApprovalWorkflow(complaintId, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Approval workflow started'); void load(); }
  };

  const handleApprove = async (eSignature: string) => {
    if (!current) return;
    setBusy(true);
    const { error: err } = await approveComplaintStep(complaintId, current.id, comments, eSignature, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Approval recorded'); setComments(''); void load(); }
  };

  const handleReject = async () => {
    if (!current || !rejectReason.trim()) { toast.error('Reject reason required'); return; }
    setBusy(true);
    const { error: err } = await rejectComplaintStep(complaintId, current.id, rejectReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Complaint rejected'); setRejectOpen(false); void load(); }
  };

  const handleSendBack = async () => {
    if (!current || !sendBackReason.trim()) { toast.error('Send back reason required'); return; }
    setBusy(true);
    const { error: err } = await sendBackComplaintStep(complaintId, current.id, sendBackReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Complaint sent back'); setSendBackOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !record) return <ErrorCard title="Unable to load approval workflow" message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <ComplaintApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Approval Workflow"
          description={`${record.complaint_number} — ${record.product_name}`}
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'Approval', href: '/qms/complaints/approval' },
            { label: record.complaint_number },
          ]}
          actions={(
            <>
              <Link href={`/qms/complaints/${complaintId}`}>
                <Button variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Complaint Detail</Button>
              </Link>
              <Link href="/qms/complaints/approval">
                <Button variant="outline" size="sm">Approval Dashboard</Button>
              </Link>
            </>
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ComplaintStatusBadge status={record.status} />
          <CriticalityBadge value={record.complaint_criticality} />
          {current && <ComplaintWorkflowStepBadge step={current.current_workflow_step} />}
          {current && <ComplaintApprovalStatusBadge status={current.approval_status} />}
          {overdue && <ComplaintOverdueBadge overdue days={0} />}
          {readOnly && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Locked — Closed</span>}
        </div>

        {!investigationComplete && current && ['Investigation Review', 'QA Review', 'Head QA Approval', 'Closed'].includes(current.current_workflow_step || '') && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Investigation must be completed before QA approval.
          </div>
        )}
        {!impactComplete && current && ['Impact Assessment Review', 'QA Review', 'Head QA Approval', 'Closed'].includes(current.current_workflow_step || '') && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Impact assessment must be approved before final review.
          </div>
        )}
        {!capaSatisfied && current && ['CAPA Review', 'QA Review', 'Head QA Approval', 'Closed'].includes(current.current_workflow_step || '') && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            CAPA must be linked and satisfied before closure approval.
          </div>
        )}
        {!recallComplete && current?.current_workflow_step === 'Recall Evaluation Review' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Recall evaluation must be completed before approval at this step.
          </div>
        )}

        {workflowNotStarted && record.status !== 'draft' && !readOnly && (
          <Card>
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">Approval workflow not started</p>
                <p className="text-sm text-muted-foreground">Initialize the GMP approval workflow for this complaint.</p>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700" disabled={busy} onClick={() => void handleInitWorkflow()}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Start Workflow
              </Button>
            </CardContent>
          </Card>
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
                    <div className="grid grid-cols-2 gap-3">
                      {[['Step', current.current_workflow_step], ['Status', current.approval_status],
                        ['Approver Role', current.current_role], ['Due Date', current.due_date || '—'],
                        ['Level', String(current.approval_level)], ['E-Sign Required', current.e_signature_required ? 'Yes' : 'No'],
                      ].map(([l, v]) => (
                        <div key={String(l)}><p className="text-xs text-muted-foreground">{l}</p>
                          {l === 'Approver Role' ? <ComplaintRoleBadge role={String(v)} /> : <p className="font-medium">{v}</p>}
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
                      <ComplaintApprovalStatusBadge status={a.approval_status} />
                    </div>
                  ))}
                  {!approvals.length && <p className="text-sm text-muted-foreground">No workflow steps yet.</p>}
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
                      if (current.e_signature_required) setEsignOpen(true);
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
          </TabsContent>

          <TabsContent value="history">
            <Card><CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {approvals.filter((a) => ['Approved', 'Rejected', 'Sent Back', 'Completed'].includes(a.approval_status || '')).map((a) => (
                  <div key={a.id} className="rounded border p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{a.current_workflow_step} — {a.approver_name}</span>
                      <ComplaintApprovalStatusBadge status={a.approval_status} />
                    </div>
                    <p className="text-muted-foreground mt-1">{a.comments || a.rejection_reason || a.send_back_reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.completed_date || a.signed_at}</p>
                  </div>
                ))}
                {!approvals.some((a) => ['Approved', 'Rejected', 'Sent Back'].includes(a.approval_status || '')) && (
                  <p className="text-sm text-muted-foreground">No completed approval steps yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card><CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
              <CardContent><ComplaintApprovalTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent><ComplaintApprovalTimeline entries={timeline} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Complaint Approval"
          recordId={complaintId}
          documentNumber={record.complaint_number}
          actionType="Approve"
          signatureMeaning="I approve this complaint workflow step"
          onSuccess={async () => {
            await logComplaintEsignResult(complaintId, true, actor);
            await handleApprove(actor.name);
          }}
          onCancel={async () => { await logComplaintEsignResult(complaintId, false, actor, 'Cancelled'); }}
        />

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Complaint</DialogTitle></DialogHeader>
            <Textarea placeholder="Reject reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="destructive" disabled={busy} onClick={() => void handleReject()}>Confirm Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Back Complaint</DialogTitle></DialogHeader>
            <Textarea placeholder="Send back reason (required)" value={sendBackReason} onChange={(e) => setSendBackReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button disabled={busy} onClick={() => void handleSendBack()}>Confirm Send Back</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ComplaintApprovalAccessGuard>
  );
}
