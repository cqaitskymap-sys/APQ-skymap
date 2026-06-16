'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnOosApproval,
  daysPendingOosApproval,
  oosApprovalPriority,
} from '@/lib/oos-approval-records';
import {
  escalateOverdueOosApprovals,
  fetchOosApprovalDashboardData,
} from '@/lib/oos-approval-service';
import type { OosApproval, OosApprovalHistoryEntry, OosApprovalDashboardCounts, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { OosApprovalAccessGuard } from './oos-approval-access-guard';
import {
  OosApprovalStatusBadge,
  OosOverdueBadge,
  OosPriorityBadge,
  OosRoleBadge,
  OosWorkflowStepBadge,
} from './oos-approval-badges';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

type PendingRow = OosApproval & {
  overdue: boolean;
  daysPending: number;
  priority: string;
  product_name?: string;
  batch_number?: string;
};

export function OosApprovalListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<OosApproval[]>([]);
  const [history, setHistory] = useState<OosApprovalHistoryEntry[]>([]);
  const [records, setRecords] = useState<OosRecord[]>([]);
  const [counts, setCounts] = useState<OosApprovalDashboardCounts | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOosApprovalDashboardData(actor, profile?.role);
      setApprovals(data.approvals);
      setHistory(data.history);
      setRecords(data.records);
      setCounts(data.counts);
    } catch {
      setError('Failed to load approval dashboard.');
    } finally {
      setLoading(false);
    }
  }, [actor, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const recordMap = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const today = new Date().toISOString().slice(0, 10);

  const pendingRows: PendingRow[] = useMemo(() => approvals
    .filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .map((a) => {
      const rec = recordMap.get(a.oos_id);
      const daysPending = daysPendingOosApproval(a);
      return {
        ...a,
        daysPending,
        overdue: Boolean(a.due_date && a.due_date < today),
        priority: oosApprovalPriority(rec, daysPending),
        product_name: rec?.product_name,
        batch_number: rec?.batch_number,
      };
    }), [approvals, recordMap, today]);

  const myPending = useMemo(() => pendingRows.filter((a) =>
    canActOnOosApproval(profile?.role, a.current_role || a.current_approver_role) || a.current_approver === actor.id,
  ), [pendingRows, profile?.role, actor.id]);

  const pendingColumns = [
    { key: 'oos_number', header: 'OOS Number', render: (r: PendingRow) => <span className="font-mono text-blue-600">{r.oos_number || '—'}</span> },
    { key: 'product', header: 'Product', render: (r: PendingRow) => r.product_name || '—' },
    { key: 'batch', header: 'Batch Number', render: (r: PendingRow) => r.batch_number || '—' },
    { key: 'step', header: 'Current Step', render: (r: PendingRow) => <OosWorkflowStepBadge step={r.current_workflow_step} /> },
    { key: 'role', header: 'Pending With', render: (r: PendingRow) => <OosRoleBadge role={r.current_role || r.current_approver_role} /> },
    { key: 'due', header: 'Due Date', render: (r: PendingRow) => r.due_date || '—' },
    { key: 'days', header: 'Days Pending', render: (r: PendingRow) => r.daysPending },
    { key: 'priority', header: 'Priority', render: (r: PendingRow) => <OosPriorityBadge priority={r.priority} /> },
    { key: 'status', header: 'Status', render: (r: PendingRow) => <OosApprovalStatusBadge status={r.approval_status} /> },
    { key: 'actions', header: 'Action', render: (r: PendingRow) => (
      <Link href={`/qms/oos/${r.oos_id}/approval`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const historyColumns = [
    { key: 'oos_number', header: 'OOS Number', render: (h: OosApprovalHistoryEntry) => <span className="font-mono text-blue-600">{h.oos_number}</span> },
    { key: 'action', header: 'Action', render: (h: OosApprovalHistoryEntry) => h.action },
    { key: 'user', header: 'User', render: (h: OosApprovalHistoryEntry) => h.user_name },
    { key: 'role', header: 'Role', render: (h: OosApprovalHistoryEntry) => <OosRoleBadge role={h.user_role} /> },
    { key: 'date', header: 'Date Time', render: (h: OosApprovalHistoryEntry) => h.created_at },
    { key: 'comments', header: 'Comments', render: (h: OosApprovalHistoryEntry) => h.comments || h.rejection_reason || h.send_back_reason || '—' },
    { key: 'esign', header: 'E-Signature Status', render: (h: OosApprovalHistoryEntry) => h.e_signature_status || '—' },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueOosApprovals(actor);
    setBusy(false);
    toast.success(count ? `${count} approval(s) escalated` : 'No overdue approvals');
    void load();
  };

  const KPI = counts ? [
    { label: 'Pending Approvals', value: counts.pendingApprovals, color: 'text-blue-700' },
    { label: 'Approved OOS', value: counts.approvedOos, color: 'text-green-700' },
    { label: 'Rejected OOS', value: counts.rejectedOos, color: 'text-red-700' },
    { label: 'Sent Back OOS', value: counts.sentBackOos, color: 'text-amber-700' },
    { label: 'Critical OOS Pending', value: counts.criticalPending, color: 'text-orange-700' },
    { label: 'Overdue Approvals', value: counts.overdueApprovals, color: 'text-red-700' },
    { label: 'Head QA Pending', value: counts.headQaPending, color: 'text-purple-700' },
    { label: 'Closed OOS', value: counts.closedOos, color: 'text-slate-700' },
  ] : [];

  return (
    <OosApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Approval Workflow"
          description="GMP-compliant OOS review, approval, rejection, escalation, and e-signature"
          trail={[
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {KPI.map((k) => (
                <Card key={k.label}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
                </CardContent></Card>
              ))}
            </div>

            <Tabs defaultValue="pending">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
                <TabsTrigger value="my">My Approvals ({counts?.myPendingApprovals ?? 0})</TabsTrigger>
                <TabsTrigger value="history">Approval History</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-4">
                {pendingRows.length ? (
                  <ResponsiveDataTable columns={pendingColumns} data={pendingRows} mobileTitleKey="oos_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No pending approvals" message="All OOS approval steps are complete or awaiting submission." />
                )}
              </TabsContent>
              <TabsContent value="my" className="mt-4">
                {myPending.length ? (
                  <ResponsiveDataTable columns={pendingColumns} data={myPending} mobileTitleKey="oos_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No approvals assigned to you" message="Pending steps for your role will appear here." />
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {history.length ? (
                  <ResponsiveDataTable columns={historyColumns} data={history.slice(0, 200)} mobileTitleKey="oos_number" mobileSubtitleKey="action" pageSize={20} />
                ) : (
                  <EmptyState title="No approval history" message="Approval actions will appear here once recorded." />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </OosApprovalAccessGuard>
  );
}
