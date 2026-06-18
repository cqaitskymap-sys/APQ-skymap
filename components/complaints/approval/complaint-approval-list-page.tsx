'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnComplaintApproval,
  daysPendingComplaintApproval,
  type ComplaintApprovalDashboardCounts,
} from '@/lib/complaint-approval-records';
import {
  escalateOverdueComplaintApprovals,
  fetchComplaintApprovalDashboardData,
} from '@/lib/complaint-approval-service';
import type { ComplaintApproval } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ComplaintApprovalAccessGuard } from './complaint-approval-access-guard';
import {
  ComplaintApprovalStatusBadge,
  ComplaintOverdueBadge,
  ComplaintRoleBadge,
  ComplaintWorkflowStepBadge,
} from './complaint-approval-badges';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PendingRow = ComplaintApproval & { overdue: boolean; daysPending: number };

export function ComplaintApprovalListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ComplaintApproval[]>([]);
  const [counts, setCounts] = useState<ComplaintApprovalDashboardCounts | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComplaintApprovalDashboardData(actor, profile?.role);
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
      daysPending: daysPendingComplaintApproval(a),
      overdue: Boolean(a.due_date && a.due_date < today),
    })), [approvals, today]);

  const myPending = useMemo(() => pendingRows.filter((a) =>
    canActOnComplaintApproval(profile?.role, a.current_role) || a.current_approver === actor.id,
  ), [pendingRows, profile?.role, actor.id]);

  const columns = [
    { key: 'complaint_number', header: 'Complaint No', render: (r: PendingRow) => <span className="font-mono text-blue-600">{r.complaint_number || '—'}</span> },
    { key: 'step', header: 'Workflow Step', render: (r: PendingRow) => <ComplaintWorkflowStepBadge step={r.current_workflow_step} /> },
    { key: 'role', header: 'Pending With', render: (r: PendingRow) => <ComplaintRoleBadge role={r.current_role} /> },
    { key: 'due', header: 'Due Date', render: (r: PendingRow) => r.due_date || '—' },
    { key: 'days', header: 'Days Pending', render: (r: PendingRow) => r.daysPending },
    { key: 'priority', header: 'Priority', render: (r: PendingRow) => <ComplaintOverdueBadge overdue={r.overdue} days={r.daysPending} /> },
    { key: 'status', header: 'Status', render: (r: PendingRow) => <ComplaintApprovalStatusBadge status={r.approval_status} /> },
    { key: 'actions', header: 'Action', render: (r: PendingRow) => (
      <Link href={`/qms/complaints/${r.complaint_id}/approval`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueComplaintApprovals(actor);
    setBusy(false);
    toast.success(count ? `${count} approval(s) escalated` : 'No overdue approvals');
    void load();
  };

  return (
    <ComplaintApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Approval Workflow"
          description="GMP-compliant complaint review, approval, rejection, escalation, and final authorization"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
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
          <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
        ) : (
          <>
            {counts && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Pending Approvals" value={counts.pendingApprovals} />
                <KpiCard label="My Pending" value={counts.myPendingApprovals} />
                <KpiCard label="Approved This Month" value={counts.approvedThisMonth} />
                <KpiCard label="Rejected" value={counts.rejectedComplaints} />
                <KpiCard label="Sent Back" value={counts.sentBackComplaints} />
                <KpiCard label="Overdue" value={counts.overdueApprovals} tone="red" />
                <KpiCard label="Critical Pending" value={counts.criticalPending} tone="amber" />
                <KpiCard label="Closed" value={counts.closedComplaints} tone="green" />
              </div>
            )}

            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
                <TabsTrigger value="my">My Approvals</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-4">
                {pendingRows.length ? (
                  <ResponsiveDataTable columns={columns} data={pendingRows} mobileTitleKey="complaint_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No pending approvals" message="All complaint approval steps are complete or awaiting workflow initialization." />
                )}
              </TabsContent>
              <TabsContent value="my" className="mt-4">
                {myPending.length ? (
                  <ResponsiveDataTable columns={columns} data={myPending} mobileTitleKey="complaint_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No approvals assigned to you" message="Pending steps for your role will appear here." />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ComplaintApprovalAccessGuard>
  );
}
