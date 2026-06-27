'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Loader2, RefreshCw, ShieldCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnRiskApproval,
  daysPendingRiskApproval,
  mapHistoryToRiskApprovalTimeline,
  riskApprovalPriority,
} from '@/lib/risk-approval-records';
import type { RiskApproval, RiskApprovalDashboardCounts, RiskApprovalHistoryEntry } from '@/lib/risk-approval-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import {
  escalateOverdueRiskApprovals,
  fetchRiskApprovalDashboardData,
} from '@/lib/risk-approval-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskApprovalAccessGuard } from './risk-approval-access-guard';
import {
  RiskApprovalStatusBadge,
  RiskLevelBadge,
  RiskOverdueBadge,
  RiskRoleBadge,
  RiskWorkflowStepBadge,
} from './risk-approval-badges';
import { RiskApprovalTimeline } from './risk-approval-timeline';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PendingRow = RiskApproval & {
  overdue: boolean;
  daysPending: number;
  priority: string;
  riskLevel?: string;
  department?: string;
};

export function RiskApprovalListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<RiskApproval[]>([]);
  const [history, setHistory] = useState<RiskApprovalHistoryEntry[]>([]);
  const [risks, setRisks] = useState<RiskAssessmentRecord[]>([]);
  const [counts, setCounts] = useState<RiskApprovalDashboardCounts | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRiskApprovalDashboardData(actor, profile?.role);
      setApprovals(data.approvals);
      setHistory(data.history);
      setRisks(data.risks);
      setCounts(data.counts);
    } catch {
      setError('Failed to load approval dashboard.');
    } finally {
      setLoading(false);
    }
  }, [actor, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const riskMap = useMemo(() => new Map(risks.map((r) => [r.id, r])), [risks]);
  const today = new Date().toISOString().split('T')[0];
  const timeline = useMemo(() => mapHistoryToRiskApprovalTimeline(history.slice(0, 50)), [history]);

  const pendingRows: PendingRow[] = useMemo(() => approvals
    .filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .map((a) => {
      const risk = riskMap.get(a.risk_assessment_id);
      const daysPending = daysPendingRiskApproval(a);
      return {
        ...a,
        daysPending,
        overdue: Boolean(a.due_date && a.due_date < today),
        priority: riskApprovalPriority(risk, daysPending),
        riskLevel: risk?.riskLevel,
        department: risk ? `${risk.riskCategory}` : undefined,
      };
    }), [approvals, riskMap, today]);

  const myPending = useMemo(() => pendingRows.filter((a) => {
    const risk = riskMap.get(a.risk_assessment_id);
    return canActOnRiskApproval(profile?.role, a.current_role || a.current_approver_role, risk?.createdBy, actor.id)
      || a.current_approver === actor.id;
  }), [pendingRows, profile?.role, actor.id, riskMap]);

  const pendingColumns = [
    { key: 'risk_number', header: 'Risk No', render: (r: PendingRow) => <span className="font-mono text-blue-600">{r.risk_number || '—'}</span> },
    { key: 'level', header: 'Risk Level', render: (r: PendingRow) => <RiskLevelBadge level={r.riskLevel} /> },
    { key: 'step', header: 'Current Step', render: (r: PendingRow) => <RiskWorkflowStepBadge step={r.current_workflow_step} /> },
    { key: 'role', header: 'Pending With', render: (r: PendingRow) => <RiskRoleBadge role={r.current_role || r.current_approver_role} /> },
    { key: 'due', header: 'Due Date', render: (r: PendingRow) => (
      <span className="flex items-center gap-1">{r.due_date || '—'} <RiskOverdueBadge overdue={r.overdue} /></span>
    ) },
    { key: 'days', header: 'Days Pending', render: (r: PendingRow) => r.daysPending },
    { key: 'status', header: 'Status', render: (r: PendingRow) => <RiskApprovalStatusBadge status={r.approval_status} /> },
    { key: 'actions', header: 'Action', render: (r: PendingRow) => (
      <Link href={`/qms/risk-management/${r.risk_assessment_id}/approval`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const historyColumns = [
    { key: 'risk_number', header: 'Risk No', render: (h: RiskApprovalHistoryEntry) => <span className="font-mono text-blue-600">{h.risk_number}</span> },
    { key: 'action', header: 'Action', render: (h: RiskApprovalHistoryEntry) => h.action },
    { key: 'user', header: 'User', render: (h: RiskApprovalHistoryEntry) => h.user_name },
    { key: 'role', header: 'Role', render: (h: RiskApprovalHistoryEntry) => <RiskRoleBadge role={h.user_role} /> },
    { key: 'date', header: 'Date Time', render: (h: RiskApprovalHistoryEntry) => h.created_at ? new Date(h.created_at).toLocaleString() : '—' },
    { key: 'comments', header: 'Comments', render: (h: RiskApprovalHistoryEntry) => h.comments || h.rejection_reason || h.send_back_reason || '—' },
    { key: 'esign', header: 'E-Signature', render: (h: RiskApprovalHistoryEntry) => h.e_signature_status || '—' },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueRiskApprovals(actor);
    setBusy(false);
    toast.success(count ? `${count} approval(s) escalated` : 'No overdue approvals');
    void load();
  };

  return (
    <RiskApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Risk Approval Workflow"
          description="GMP and ICH Q9 compliant risk review and approval process"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/risk-management/audit-trail' },
            { label: 'Risk Management', href: '/qms/risk-management/audit-trail' },
            { label: 'Approval Workflow' },
          ]}
          actions={(
            <>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-1 h-4 w-4" />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleEscalate} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Escalate Overdue
              </Button>
            </>
          )}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Pending Approvals" value={counts?.pendingApprovals ?? 0} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Approved Risks" value={counts?.approvedRisks ?? 0} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected Risks" value={counts?.rejectedRisks ?? 0} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Critical Pending" value={counts?.criticalPending ?? 0} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="CSV Reviews Pending" value={counts?.csvReviewsPending ?? 0} icon={ShieldCheck} accent="border-l-sky-600" />
              <KpiCard label="Validation Pending" value={counts?.validationReviewsPending ?? 0} icon={ShieldCheck} accent="border-l-teal-600" />
              <KpiCard label="Regulatory Pending" value={counts?.regulatoryReviewsPending ?? 0} icon={ShieldCheck} accent="border-l-violet-600" />
              <KpiCard label="Head QA Pending" value={counts?.headQaPending ?? 0} icon={ShieldCheck} accent="border-l-indigo-600" />
            </div>

            <Tabs defaultValue="pending">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
                <TabsTrigger value="my">My Approvals ({counts?.myPendingApprovals ?? 0})</TabsTrigger>
                <TabsTrigger value="history">Approval History</TabsTrigger>
                <TabsTrigger value="timeline">Approval Timeline</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4">
                {pendingRows.length ? (
                  <ResponsiveDataTable columns={pendingColumns} data={pendingRows} mobileTitleKey="risk_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No pending approvals" message="All risk approval steps are complete or awaiting submission." />
                )}
              </TabsContent>

              <TabsContent value="my" className="mt-4">
                {myPending.length ? (
                  <ResponsiveDataTable columns={pendingColumns} data={myPending} mobileTitleKey="risk_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No approvals assigned to you" message="Pending steps for your role will appear here." />
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {history.length ? (
                  <ResponsiveDataTable columns={historyColumns} data={history.slice(0, 200)} mobileTitleKey="risk_number" mobileSubtitleKey="action" pageSize={20} />
                ) : (
                  <EmptyState title="No approval history" message="Approval actions will appear here once recorded." />
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Recent Approval Timeline</CardTitle></CardHeader>
                  <CardContent><RiskApprovalTimeline entries={timeline} /></CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Audit Trail Summary</CardTitle></CardHeader>
                  <CardContent>
                    {history.length ? (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Risk #</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Step</TableHead><TableHead>Date</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {history.slice(0, 30).map((h) => (
                            <TableRow key={`${h.risk_assessment_id}-${h.created_at}-${h.action}`}>
                              <TableCell className="font-mono">{h.risk_number}</TableCell>
                              <TableCell>{h.action}</TableCell>
                              <TableCell>{h.user_name}</TableCell>
                              <TableCell>{h.workflow_step}</TableCell>
                              <TableCell>{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No audit entries yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RiskApprovalAccessGuard>
  );
}
