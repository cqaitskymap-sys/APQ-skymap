'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Loader2, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnRiskApproval,
  isRiskApprovalReadOnly,
  isRiskRecordLocked,
  mapHistoryToRiskApprovalTimeline,
  riskApprovalMeaning,
} from '@/lib/risk-approval-records';
import type { RiskApproval, RiskApprovalHistoryEntry } from '@/lib/risk-approval-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import {
  approveRiskStep,
  fetchRiskApprovalPageData,
  initializeRiskApprovalWorkflow,
  logRiskEsignResult,
  rejectRiskStep,
  sendBackRiskStep,
} from '@/lib/risk-approval-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { RiskApprovalAccessGuard } from './risk-approval-access-guard';
import {
  RiskApprovalStatusBadge,
  RiskLevelBadge,
  RiskOverdueBadge,
  RiskRoleBadge,
  RiskWorkflowStepBadge,
} from './risk-approval-badges';
import { RiskApprovalTimeline } from './risk-approval-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type EsignAction = 'approve' | 'reject';

export function RiskApprovalPage({ riskAssessmentId }: { riskAssessmentId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentRecord | null>(null);
  const [approvals, setApprovals] = useState<RiskApproval[]>([]);
  const [history, setHistory] = useState<RiskApprovalHistoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [current, setCurrent] = useState<RiskApproval | null>(null);
  const [workflowWarnings, setWorkflowWarnings] = useState<string[]>([]);

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
    const data = await fetchRiskApprovalPageData(riskAssessmentId);
    if (data.error || !data.risk) {
      setError(data.error || 'Not found');
      setLoading(false);
      return;
    }
    setRisk(data.risk);
    setApprovals(data.approvals || []);
    setHistory(data.history || []);
    setAuditLogs(data.auditLogs || []);
    setCurrent(data.current || null);

    const warnings: string[] = [];
    const ctx = data.workflowContext;
    if (ctx && !ctx.fmeaCompleted) warnings.push('FMEA must be completed before approval workflow.');
    if (ctx && !ctx.mitigationPlanExists) warnings.push('Mitigation plan must exist before approval workflow.');
    if (ctx?.headQaRequired) warnings.push('High/Critical or patient safety risk — Head QA approval required.');
    if (ctx?.csvReviewRequired) warnings.push('CSV/Data Integrity review step will be included.');
    if (ctx?.regulatoryReviewRequired) warnings.push('Regulatory review step will be included.');
    if (ctx?.validationReviewRequired) warnings.push('Validation review step will be included.');
    setWorkflowWarnings(warnings);
    setLoading(false);
  }, [riskAssessmentId]);

  useEffect(() => { void load(); }, [load]);

  const canAct = current ? canActOnRiskApproval(profile?.role, current.current_role || current.current_approver_role, risk?.createdBy, actor.id) : false;
  const readOnly = isRiskApprovalReadOnly(profile?.role) || (risk ? isRiskRecordLocked(risk) && risk.riskStatus === 'Closed' : false);
  const today = new Date().toISOString().split('T')[0];
  const overdue = Boolean(current?.due_date && current.due_date < today);
  const timeline = useMemo(() => mapHistoryToRiskApprovalTimeline(history), [history]);
  const title = risk?.parameterName || risk?.riskDescription?.slice(0, 80) || risk?.riskNumber || '';

  const handleStartWorkflow = async () => {
    setBusy(true);
    const result = await initializeRiskApprovalWorkflow(riskAssessmentId, actor);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else { toast.success('Approval workflow started'); void load(); }
  };

  const handleApprove = async (esignRecord?: { esignRecordId?: string }) => {
    if (!current) return;
    setBusy(true);
    const meaning = riskApprovalMeaning(current.current_workflow_step, 'approve');
    const { error: err } = await approveRiskStep(riskAssessmentId, current.id, comments, esignRecord?.esignRecordId || '', actor, meaning);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Approval recorded'); setComments(''); setEsignOpen(false); void load(); }
  };

  const handleReject = async () => {
    if (!current || !rejectReason.trim()) { toast.error('Reject reason required'); return; }
    setBusy(true);
    const { error: err } = await rejectRiskStep(riskAssessmentId, current.id, rejectReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Risk rejected'); setRejectOpen(false); void load(); }
  };

  const handleSendBack = async () => {
    if (!current || !sendBackReason.trim()) { toast.error('Send back reason required'); return; }
    setBusy(true);
    const { error: err } = await sendBackRiskStep(riskAssessmentId, current.id, sendBackReason, comments, actor);
    setBusy(false);
    if (err) toast.error(err);
    else { toast.success('Risk sent back'); setSendBackOpen(false); void load(); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !risk) return <ErrorCard title="Unable to load approval workflow" message={error || 'Not found'} onRetry={load} />;

  return (
    <RiskApprovalAccessGuard>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Link href="/qms/risk-management/approval">
            <Button variant="ghost" size="sm" className="gap-1 mt-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <div className="flex-1">
            <CpvPageHeader
              title="Risk Approval Workflow"
              description={`${risk.riskNumber} — ${title}`}
              trail={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'QMS', href: '/qms/risk-management/audit-trail' },
                { label: 'Approval Workflow', href: '/qms/risk-management/approval' },
                { label: risk.riskNumber },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">{risk.riskStatus}</span>
          <RiskLevelBadge level={risk.riskLevel} />
          {current && <RiskWorkflowStepBadge step={current.current_workflow_step} />}
          {current && <RiskApprovalStatusBadge status={current.approval_status} />}
          <RiskOverdueBadge overdue={overdue} />
          {risk.isLocked && <span className="text-xs rounded-full bg-slate-200 px-2 py-0.5">Locked</span>}
        </div>

        {workflowWarnings.length > 0 && (
          <Alert>
            <AlertTitle>Workflow notes</AlertTitle>
            <AlertDescription><ul className="list-disc pl-4">{workflowWarnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription>
          </Alert>
        )}

        {!approvals.length && !readOnly && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Start Approval Workflow</CardTitle>
              <CardDescription>Initialize ICH Q9 multi-step approval after FMEA and mitigation plan are complete.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartWorkflow} disabled={busy || workflowWarnings.some((w) => w.includes('must be'))}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Submit for Approval
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
                    Pending with <RiskRoleBadge role={current.current_role || current.current_approver_role} />
                    {current.due_date && ` · Due ${current.due_date}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="Approval comments" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} disabled={!canAct || readOnly} />
                  {canAct && !readOnly && (
                    <div className="flex flex-wrap gap-2">
                      {current.e_signature_required ? (
                        <Button onClick={() => { setEsignAction('approve'); setEsignOpen(true); }} disabled={busy}>
                          <CheckCircle className="h-4 w-4 mr-1" />Approve (E-Sign)
                        </Button>
                      ) : (
                        <Button onClick={() => void handleApprove()} disabled={busy}>
                          <CheckCircle className="h-4 w-4 mr-1" />Approve
                        </Button>
                      )}
                      <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
                        <XCircle className="h-4 w-4 mr-1" />Reject
                      </Button>
                      <Button variant="outline" onClick={() => setSendBackOpen(true)} disabled={busy}>Send Back</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Workflow Steps</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>E-Sign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.approval_level}</TableCell>
                        <TableCell><RiskWorkflowStepBadge step={a.current_workflow_step} /></TableCell>
                        <TableCell><RiskRoleBadge role={a.current_role || a.current_approver_role} /></TableCell>
                        <TableCell><RiskApprovalStatusBadge status={a.approval_status} /></TableCell>
                        <TableCell>{a.due_date || '—'}</TableCell>
                        <TableCell>{a.e_signature_status || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card><CardContent className="pt-4">
              {history.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Step</TableHead><TableHead>Date</TableHead><TableHead>Comments</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={`${h.created_at}-${h.action}`}>
                        <TableCell>{h.action}</TableCell>
                        <TableCell>{h.user_name}</TableCell>
                        <TableCell>{h.workflow_step}</TableCell>
                        <TableCell>{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</TableCell>
                        <TableCell className="max-w-xs truncate">{h.comments || h.rejection_reason || h.send_back_reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card><CardContent className="pt-4"><RiskApprovalTimeline entries={timeline} /></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="pt-4">
              {auditLogs.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.filter((l) => /approv|reject|sent back|escalat|sign|submit|activ/i.test(String(l.actionType || l.action || ''))).map((l) => (
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
          moduleName="Risk Approval Workflow"
          recordId={riskAssessmentId}
          documentNumber={risk.riskNumber}
          actionType="Risk Approval Authorization"
          signatureMeaning={riskApprovalMeaning(current?.current_workflow_step, esignAction)}
          onSuccess={async (record) => {
            await logRiskEsignResult(riskAssessmentId, true, actor, record.esignRecordId);
            await handleApprove({ esignRecordId: record.esignRecordId });
          }}
          onCancel={() => void logRiskEsignResult(riskAssessmentId, false, actor, 'Cancelled')}
        />

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Risk Assessment</DialogTitle></DialogHeader>
            <Textarea placeholder="Reject reason (required)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Back Risk Assessment</DialogTitle></DialogHeader>
            <Textarea placeholder="Send back reason (required)" value={sendBackReason} onChange={(e) => setSendBackReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button>
              <Button onClick={handleSendBack} disabled={!sendBackReason.trim()}>Send Back</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RiskApprovalAccessGuard>
  );
}
