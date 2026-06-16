'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnDeviationApproval,
  daysPendingApproval,
  type DeviationApprovalDashboardCounts,
} from '@/lib/deviation-approval-records';
import {
  escalateOverdueApprovals,
  fetchApprovalDashboardData,
} from '@/lib/deviation-approval-service';
import type { DeviationApproval } from '@/lib/deviation-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DeviationApprovalAccessGuard } from './deviation-approval-access-guard';
import {
  DeviationApprovalStatusBadge,
  DeviationOverdueBadge,
  DeviationRoleBadge,
  DeviationWorkflowStepBadge,
} from './deviation-approval-badges';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PendingRow = DeviationApproval & { overdue: boolean; daysPending: number };

export function DeviationApprovalListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<DeviationApproval[]>([]);
  const [counts, setCounts] = useState<DeviationApprovalDashboardCounts | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalDashboardData(actor, profile?.role);
      setApprovals(data.approvals);
      setCounts(data.counts);
    } catch {
      setError('Failed to load approval dashboard.');
    } finally {
      setLoading(false);
    }
  }, [actor, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const pendingRows: PendingRow[] = useMemo(() => approvals
    .filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .map((a) => ({
      ...a,
      daysPending: daysPendingApproval(a),
      overdue: Boolean(a.due_date && a.due_date < today),
    })), [approvals, today]);

  const myPending = useMemo(() => pendingRows.filter((a) =>
    canActOnDeviationApproval(profile?.role, a.current_role) || a.current_approver === actor.id,
  ), [pendingRows, profile?.role, actor.id]);

  const columns = [
    { key: 'deviation_number', header: 'Deviation No', render: (r: PendingRow) => <span className="font-mono text-blue-600">{r.deviation_number || '—'}</span> },
    { key: 'step', header: 'Workflow Step', render: (r: PendingRow) => <DeviationWorkflowStepBadge step={r.current_workflow_step} /> },
    { key: 'role', header: 'Pending With', render: (r: PendingRow) => <DeviationRoleBadge role={r.current_role} /> },
    { key: 'due', header: 'Due Date', render: (r: PendingRow) => r.due_date || '—' },
    { key: 'days', header: 'Days Pending', render: (r: PendingRow) => r.daysPending },
    { key: 'priority', header: 'Priority', render: (r: PendingRow) => <DeviationOverdueBadge overdue={r.overdue} days={r.daysPending} /> },
    { key: 'status', header: 'Status', render: (r: PendingRow) => <DeviationApprovalStatusBadge status={r.approval_status} /> },
    { key: 'actions', header: 'Action', render: (r: PendingRow) => (
      <Link href={`/qms/deviation/${r.deviation_id}/approval`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueApprovals(actor);
    setBusy(false);
    toast.success(count ? `${count} approval(s) escalated` : 'No overdue approvals');
    void load();
  };

  return (
    <DeviationApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Approval Workflow"
          description="GMP-compliant deviation review, approval, rejection, and escalation"
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
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
            {counts && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Pending Approvals" value={counts.pendingApprovals} />
                <KpiCard label="My Pending" value={counts.myPendingApprovals} />
                <KpiCard label="Approved This Month" value={counts.approvedThisMonth} />
                <KpiCard label="Rejected" value={counts.rejectedDeviations} />
                <KpiCard label="Sent Back" value={counts.sentBackDeviations} />
                <KpiCard label="Overdue" value={counts.overdueApprovals} tone="red" />
                <KpiCard label="Critical Pending" value={counts.criticalPending} tone="amber" />
                <KpiCard label="Final Approved" value={counts.finalApprovedDeviations} tone="green" />
                <KpiCard label="Closed" value={counts.closedDeviations} />
              </div>
            )}

            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
                <TabsTrigger value="my">My Approvals</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-4">
                {pendingRows.length ? (
                  <ResponsiveDataTable columns={columns} data={pendingRows} mobileTitleKey="deviation_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No pending approvals" message="All deviation approval steps are complete or awaiting submission." />
                )}
              </TabsContent>
              <TabsContent value="my" className="mt-4">
                {myPending.length ? (
                  <ResponsiveDataTable columns={columns} data={myPending} mobileTitleKey="deviation_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No approvals assigned to you" message="Pending steps for your role will appear here." />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DeviationApprovalAccessGuard>
  );
}
