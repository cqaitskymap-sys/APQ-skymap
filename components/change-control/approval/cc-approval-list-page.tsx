'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Loader2, RefreshCw, ShieldCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnCcApproval,
  daysPendingCcApproval,
  mapHistoryToCcApprovalTimeline,
} from '@/lib/cc-approval-records';
import {
  escalateOverdueCcApprovals,
  fetchCcApprovalDashboardData,
} from '@/lib/cc-approval-service';
import type { CcApprovalDashboardCounts, CcApprovalHistoryEntry, ChangeApproval, ChangeControlRecord } from '@/lib/change-control-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CcStatusBadge, CcCategoryBadge } from '@/components/change-control/cc-sub-nav';
import { CcApprovalAccessGuard } from './cc-approval-access-guard';
import {
  CcApprovalStatusBadge,
  CcOverdueBadge,
  CcRoleBadge,
  CcWorkflowStepBadge,
} from './cc-approval-badges';
import { CcApprovalHistoryTable, CcApprovalTimeline } from './cc-approval-timeline';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PendingRow = ChangeApproval & {
  overdue: boolean;
  daysPending: number;
  change?: ChangeControlRecord | null;
};

export function CcApprovalListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ChangeApproval[]>([]);
  const [history, setHistory] = useState<CcApprovalHistoryEntry[]>([]);
  const [records, setRecords] = useState<ChangeControlRecord[]>([]);
  const [counts, setCounts] = useState<CcApprovalDashboardCounts | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcApprovalDashboardData(actor, profile?.role);
    if (data.error) setError(data.error);
    setApprovals(data.approvals);
    setHistory(data.history);
    setRecords(data.records);
    setCounts(data.counts);
    setLoading(false);
  }, [actor, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const changeById = useMemo(() => new Map(records.map((c) => [c.id, c])), [records]);
  const today = new Date().toISOString().slice(0, 10);

  const pendingRows: PendingRow[] = useMemo(() => approvals
    .filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .map((a) => ({
      ...a,
      overdue: Boolean(a.due_date && a.due_date < today),
      daysPending: daysPendingCcApproval(a),
      change: changeById.get(a.change_id) || null,
    })), [approvals, changeById, today]);

  const myRows = useMemo(() => pendingRows.filter((a) =>
    canActOnCcApproval(profile?.role, a.current_role, a.change?.initiated_by, actor.id),
  ), [pendingRows, profile?.role, actor.id]);

  const pendingColumns = [
    { key: 'cc', header: 'CC #', render: (r: PendingRow) => <span className="font-mono text-blue-600">{r.change_control_number || r.change?.change_control_number || '—'}</span> },
    { key: 'title', header: 'Title', render: (r: PendingRow) => <span className="max-w-[180px] truncate block">{r.change?.change_title || '—'}</span> },
    { key: 'step', header: 'Workflow Step', render: (r: PendingRow) => <CcWorkflowStepBadge step={r.current_workflow_step} /> },
    { key: 'role', header: 'Approver Role', render: (r: PendingRow) => <CcRoleBadge role={r.current_role} /> },
    { key: 'due', header: 'Due Date', render: (r: PendingRow) => (
      <span className="flex items-center gap-2">{r.due_date || '—'}<CcOverdueBadge overdue={r.overdue} /></span>
    ) },
    { key: 'status', header: 'Status', render: (r: PendingRow) => <CcApprovalStatusBadge status={r.approval_status} /> },
    { key: 'cc_status', header: 'CC Status', render: (r: PendingRow) => r.change ? <CcStatusBadge status={r.change.status} /> : '—' },
    { key: 'cat', header: 'Category', render: (r: PendingRow) => r.change ? <CcCategoryBadge category={r.change.change_category} /> : '—' },
    { key: 'actions', header: '', render: (r: PendingRow) => (
      <Link href={`/qms/change-control/${r.change_id}/approval`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const n = await escalateOverdueCcApprovals({ ...actor, email: profile?.email });
    setBusy(false);
    toast.success(n > 0 ? `Escalated ${n} overdue approval(s)` : 'No overdue approvals to escalate');
    void load();
  };

  const timeline = useMemo(() => mapHistoryToCcApprovalTimeline(history).slice(0, 20), [history]);

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
            { label: 'Approval Workflow' },
          ]}
          actions={(
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleEscalate()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                Escalate Overdue
              </Button>
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={6} /> : error ? <ErrorCard message={error} onRetry={() => void load()} /> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <KpiCard label="Pending Approvals" value={counts?.pendingApprovals ?? 0} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Approved Changes" value={counts?.approvedChanges ?? 0} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected Changes" value={counts?.rejectedChanges ?? 0} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Critical Pending" value={counts?.criticalPending ?? 0} icon={AlertTriangle} accent="border-l-red-500" />
              <KpiCard label="CSV Reviews Pending" value={counts?.csvReviewsPending ?? 0} icon={ShieldCheck} accent="border-l-indigo-600" />
              <KpiCard label="Validation Pending" value={counts?.validationReviewsPending ?? 0} icon={ShieldCheck} accent="border-l-violet-600" />
              <KpiCard label="Regulatory Pending" value={counts?.regulatoryReviewsPending ?? 0} icon={ShieldCheck} accent="border-l-cyan-600" />
              <KpiCard label="Head QA Pending" value={counts?.headQaPending ?? 0} icon={ShieldCheck} accent="border-l-purple-600" />
            </div>

            <Tabs defaultValue="pending">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="pending">Pending Approvals ({pendingRows.length})</TabsTrigger>
                <TabsTrigger value="my">My Approvals ({myRows.length})</TabsTrigger>
                <TabsTrigger value="history">Approval History</TabsTrigger>
                <TabsTrigger value="timeline">Approval Timeline</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4">
                {pendingRows.length === 0 ? (
                  <EmptyState title="No pending approvals" message="Submitted change controls awaiting workflow approval will appear here." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={pendingRows} mobileTitleKey="change_control_number" pageSize={15} />
                )}
              </TabsContent>

              <TabsContent value="my" className="mt-4">
                {myRows.length === 0 ? (
                  <EmptyState title="No approvals assigned to you" message="Approvals matching your role will appear here." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={myRows} mobileTitleKey="change_control_number" pageSize={15} />
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <CcApprovalHistoryTable history={history} />
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <CcApprovalTimeline history={history} />
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <CcApprovalHistoryTable history={history.filter((h) =>
                  /approved|rejected|sent back|escalated|submitted|signature/i.test(h.action),
                )} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CcApprovalAccessGuard>
  );
}
