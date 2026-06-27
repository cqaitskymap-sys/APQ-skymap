'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Loader2, RotateCcw, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnCcApproval,
  ccApprovalMeaning,
  isCcApprovalReadOnly,
  mapHistoryToCcApprovalTimeline,
  validateCcApprovalAction,
  type CcWorkflowContext,
} from '@/lib/cc-approval-records';
import {
  approveCcStep,
  escalateCcApproval,
  fetchCcApprovalPageData,
  initializeCcApprovalWorkflow,
  logCcEsignResult,
  rejectCcStep,
  sendBackCcStep,
} from '@/lib/cc-approval-service';
import type { CcApprovalHistoryEntry, ChangeApproval, ChangeControlRecord } from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { CcStatusBadge, CcCategoryBadge } from '@/components/change-control/cc-sub-nav';
import { CcApprovalAccessGuard } from './cc-approval-access-guard';
import {
  CcApprovalStatusBadge,
  CcOverdueBadge,
  CcRoleBadge,
  CcWorkflowStepBadge,
} from './cc-approval-badges';
import { CcApprovalHistoryTable, CcApprovalTimeline } from './cc-approval-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type EsignAction = 'approve' | 'reject';

export function CcApprovalPage({ changeId }: { changeId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeControlRecord | null>(null);
  const [approvals, setApprovals] = useState<ChangeApproval[]>([]);
  const [history, setHistory] = useState<CcApprovalHistoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [current, setCurrent] = useState<ChangeApproval | null>(null);
  const [workflowContext, setWorkflowContext] = useState<CcWorkflowContext | null>(null);
  const [steps, setSteps] = useState<{ stepName: string; approverRole: string; level: number }[]>([]);

  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [sendBackReason, setSendBackReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
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
    const data = await fetchCcApprovalPageData(changeId);
    if ('error' in data && data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (!data.change) {
      setError('Change control not found');
      setLoading(false);
      return;
    }
    setChange(data.change);
    setApprovals(data.approvals || []);
    setHistory(data.history || []);
    setAuditLogs(data.auditLogs || []);
    setCurrent(data.current || null);
    setSteps(data.steps || []);
    setWorkflowContext(data.workflowContext || null);
    setLoading(false);
  }, [changeId]);

  useEffect(() => { void load(); }, [load]);

  const canAct = current ? canActOnCcApproval(profile?.role, current.current_role, change?.initiated_by, actor.id) : false;
  const readOnly = isCcApprovalReadOnly(profile?.role);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(current?.due_date && current.due_date < today);
  const timeline = useMemo(() => mapHistoryToCcApprovalTimeline(history), [history]);
  const noWorkflow = approvals.length === 0;

  const handleStartWorkflow = async () => {
    setBusy(true);
    const result = await initializeCcApprovalWorkflow(changeId, actor);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else { toast.success('Approval workflow started'); void load(); }
  };

  const openEsign = (action: EsignAction) => {
    setEsignAction(action);
    setEsignOpen(true);
  };

  const handleEsignSuccess = async (record: { esignRecordId?: string; id?: string }) => {
    if (!current) return;
    const sig = record.esignRecordId || record.id || '';
    setBusy(true);
    if (esignAction === 'approve') {
      const meaning = ccApprovalMeaning(current.current_workflow_step || '', 'approve');
      const res = await approveCcStep(changeId, current.id, comments, sig, meaning, actor);
      if (res.error) { toast.error(res.error); await logCcEsignResult(changeId, false, res.error, actor); }
      else { toast.success('Approved'); void load(); }
    } else {
      const meaning = ccApprovalMeaning(current.current_workflow_step || '', 'reject');
      const res = await rejectCcStep(changeId, current.id, rejectReason, comments, actor, sig, meaning);
      if (res.error) toast.error(res.error);
      else { toast.success('Rejected'); setRejectOpen(false); void load(); }
    }
    setBusy(false);
    setEsignOpen(false);
    setComments('');
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is mandatory'); return; }
    if (!current) return;
    if (current.e_signature_required) { setRejectOpen(false); openEsign('reject'); return; }
    setBusy(true);
    const res = await rejectCcStep(changeId, current.id, rejectReason, comments, actor);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else { toast.success('Rejected'); setRejectOpen(false); void load(); }
  };

  const handleSendBack = async () => {
    if (!sendBackReason.trim()) { toast.error('Send back reason is mandatory'); return; }
    if (!current) return;
    setBusy(true);
    const res = await sendBackCcStep(changeId, current.id, sendBackReason, comments, actor);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else { toast.success('Sent back to initiator'); setSendBackOpen(false); void load(); }
  };

  const handleEscalate = async () => {
    if (!current) return;
    setBusy(true);
    const res = await escalateCcApproval(changeId, current.id, actor);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else { toast.success('Approval escalated'); void load(); }
  };

  const workflowWarnings = useMemo(() => {
    if (!current || !workflowContext) return [];
    const v = validateCcApprovalAction(current.current_workflow_step || '', workflowContext);
    return v.ok ? [] : [v.error || 'Workflow gate not satisfied'];
  }, [current, workflowContext]);

  const stepValidation = useMemo(() => {
    if (!current || !workflowContext) return { ok: true as const };
    return validateCcApprovalAction(current.current_workflow_step || '', workflowContext);
  }, [current, workflowContext]);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !change) return <ErrorCard message={error || 'Not found'} onRetry={() => void load()} />;

  return (
    <CcApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Approval Workflow"
          description="GMP review, approval and implementation authorization workflow"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Approval Workflow', href: '/qms/change-control/approval' },
            { label: change.change_control_number },
          ]}
          actions={(
            <Link href="/qms/change-control/approval">
              <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to List</Button>
            </Link>
          )}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change Control</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-mono font-medium">{change.change_control_number}</p>
              <p className="truncate">{change.change_title}</p>
              <CcStatusBadge status={change.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Current Step</CardTitle></CardHeader>
            <CardContent>
              {current ? <CcWorkflowStepBadge step={current.current_workflow_step} /> : <span className="text-sm text-muted-foreground">—</span>}
              {current && <p className="mt-2 text-xs text-muted-foreground">Due: {current.due_date || '—'} <CcOverdueBadge overdue={overdue} /></p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Approver Role</CardTitle></CardHeader>
            <CardContent>{current ? <CcRoleBadge role={current.current_role} /> : '—'}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Category</CardTitle></CardHeader>
            <CardContent><CcCategoryBadge category={change.change_category} /></CardContent>
          </Card>
        </div>

        {workflowWarnings.map((w) => (
          <Alert key={w} variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Workflow Gate</AlertTitle>
            <AlertDescription>{w}</AlertDescription>
          </Alert>
        ))}

        {noWorkflow && !readOnly && (
          <Card>
            <CardHeader>
              <CardTitle>Start Approval Workflow</CardTitle>
              <CardDescription>Initialize the GMP approval workflow for this change control.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void handleStartWorkflow()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit for Approval
              </Button>
            </CardContent>
          </Card>
        )}

        {current && canAct && !readOnly && (
          <Card>
            <CardHeader>
              <CardTitle>Approval Actions — {current.current_workflow_step}</CardTitle>
              <CardDescription>
                {current.e_signature_required ? 'E-signature required for this step.' : 'Review and record your decision.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Approval comments..." value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => current.e_signature_required ? openEsign('approve') : void (async () => {
                    setBusy(true);
                    const res = await approveCcStep(changeId, current.id, comments, '', ccApprovalMeaning(current.current_workflow_step || '', 'approve'), actor);
                    setBusy(false);
                    if (res.error) toast.error(res.error);
                    else { toast.success('Approved'); void load(); }
                  })()}
                  disabled={busy || !stepValidation.ok}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
                  <XCircle className="mr-2 h-4 w-4" />Reject
                </Button>
                <Button variant="outline" onClick={() => setSendBackOpen(true)} disabled={busy}>
                  <RotateCcw className="mr-2 h-4 w-4" />Send Back
                </Button>
                {overdue && (
                  <Button variant="secondary" onClick={() => void handleEscalate()} disabled={busy}>
                    Escalate Overdue
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Workflow Steps</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
            <TabsTrigger value="timeline">Approval Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="steps" className="mt-4">
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Approver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No workflow steps yet</TableCell></TableRow>
                    ) : approvals.map((a) => (
                      <TableRow key={a.id} className={a.id === current?.id ? 'bg-amber-50/50' : ''}>
                        <TableCell>{a.approval_level}</TableCell>
                        <TableCell><CcWorkflowStepBadge step={a.current_workflow_step} /></TableCell>
                        <TableCell><CcRoleBadge role={a.current_role} /></TableCell>
                        <TableCell><CcApprovalStatusBadge status={a.approval_status} /></TableCell>
                        <TableCell>{a.due_date || '—'}</TableCell>
                        <TableCell>{a.approver_name || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {steps.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{steps.length} workflow steps configured for this change.</p>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <CcApprovalHistoryTable history={history} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <CcApprovalTimeline history={history} />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit events.</p>
                ) : (
                  <ol className="space-y-3 text-sm">
                    {auditLogs.slice(0, 30).map((log, i) => (
                      <li key={i} className="border-b pb-2 last:border-0">
                        <p className="font-medium">{String(log.actionType || log.action || 'Activity')}</p>
                        <p className="text-xs text-muted-foreground">
                          {String(log.changedByUserName || log.userName || 'System')} · {String(log.dateTime || log.timestamp || '')}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ESignatureModal
          open={esignOpen}
          onOpenChange={setEsignOpen}
          moduleName="Change Control Approval Workflow"
          recordId={changeId}
          documentNumber={change.change_control_number}
          actionType={esignAction === 'approve' ? 'Approve' : 'Reject'}
          signatureMeaning={current ? ccApprovalMeaning(current.current_workflow_step || '', esignAction) : undefined}
          onSuccess={(record) => void handleEsignSuccess(record)}
          onCancel={() => void logCcEsignResult(changeId, false, 'E-signature cancelled', actor)}
        />

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Change Control</DialogTitle></DialogHeader>
            <Textarea placeholder="Rejection reason (required)..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void handleReject()} disabled={busy}>Confirm Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Back to Initiator</DialogTitle></DialogHeader>
            <Textarea placeholder="Send back reason (required)..." value={sendBackReason} onChange={(e) => setSendBackReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleSendBack()} disabled={busy}>Confirm Send Back</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CcApprovalAccessGuard>
  );
}
