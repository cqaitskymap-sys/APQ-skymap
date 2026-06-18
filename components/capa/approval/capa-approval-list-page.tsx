'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Loader2, RefreshCw, RotateCcw, ShieldCheck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  canActOnCapaApproval,
  daysPendingCapaApproval,
  capaApprovalPriority,
  mapHistoryToCapaApprovalTimeline,
} from '@/lib/capa-approval-records';
import {
  escalateOverdueCapaApprovals,
  fetchCapaApprovalDashboardData,
} from '@/lib/capa-approval-service';
import type {
  CapaApproval,
  CapaApprovalDashboardCounts,
  CapaApprovalHistoryEntry,
  CapaRecord,
} from '@/lib/capa-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { CapaApprovalAccessGuard } from './capa-approval-access-guard';
import {
  CapaApprovalStatusBadge,
  CapaOverdueBadge,
  CapaPriorityBadge,
  CapaRoleBadge,
  CapaWorkflowStepBadge,
} from './capa-approval-badges';
import { CapaApprovalTimeline } from './capa-approval-timeline';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PendingRow = CapaApproval & {
  overdue: boolean;
  daysPending: number;
  priority: string;
  department?: string;
  source?: string;
};

export function CapaApprovalListPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<CapaApproval[]>([]);
  const [history, setHistory] = useState<CapaApprovalHistoryEntry[]>([]);
  const [records, setRecords] = useState<CapaRecord[]>([]);
  const [counts, setCounts] = useState<CapaApprovalDashboardCounts | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCapaApprovalDashboardData(actor, profile?.role);
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
  const timeline = useMemo(() => mapHistoryToCapaApprovalTimeline(history.slice(0, 50)), [history]);

  const pendingRows: PendingRow[] = useMemo(() => approvals
    .filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .map((a) => {
      const rec = recordMap.get(a.capa_id);
      const daysPending = daysPendingCapaApproval(a);
      return {
        ...a,
        daysPending,
        overdue: Boolean(a.due_date && a.due_date < today),
        priority: capaApprovalPriority(rec, daysPending),
        department: rec?.department,
        source: rec?.capa_source,
      };
    }), [approvals, recordMap, today]);

  const myPending = useMemo(() => pendingRows.filter((a) => {
    const capa = recordMap.get(a.capa_id);
    return canActOnCapaApproval(profile?.role, a.current_role || a.current_approver_role, capa?.action_owner, actor.id)
      || a.current_approver === actor.id;
  }), [pendingRows, profile?.role, actor.id, recordMap]);

  const pendingColumns = [
    { key: 'capa_number', header: 'CAPA Number', render: (r: PendingRow) => <span className="font-mono text-blue-600">{r.capa_number || '—'}</span> },
    { key: 'source', header: 'Source', render: (r: PendingRow) => r.source || '—' },
    { key: 'department', header: 'Department', render: (r: PendingRow) => r.department || '—' },
    { key: 'step', header: 'Current Step', render: (r: PendingRow) => <CapaWorkflowStepBadge step={r.current_workflow_step} /> },
    { key: 'role', header: 'Pending With', render: (r: PendingRow) => <CapaRoleBadge role={r.current_role || r.current_approver_role} /> },
    { key: 'due', header: 'Due Date', render: (r: PendingRow) => (
      <span className="flex items-center gap-1">{r.due_date || '—'} <CapaOverdueBadge overdue={r.overdue} /></span>
    ) },
    { key: 'days', header: 'Days Pending', render: (r: PendingRow) => r.daysPending },
    { key: 'priority', header: 'Priority', render: (r: PendingRow) => <CapaPriorityBadge priority={r.priority} /> },
    { key: 'status', header: 'Status', render: (r: PendingRow) => <CapaApprovalStatusBadge status={r.approval_status} /> },
    { key: 'actions', header: 'Action', render: (r: PendingRow) => (
      <Link href={`/qms/capa/${r.capa_id}/approval`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const historyColumns = [
    { key: 'capa_number', header: 'CAPA Number', render: (h: CapaApprovalHistoryEntry) => <span className="font-mono text-blue-600">{h.capa_number}</span> },
    { key: 'action', header: 'Action', render: (h: CapaApprovalHistoryEntry) => h.action },
    { key: 'user', header: 'User', render: (h: CapaApprovalHistoryEntry) => h.user_name },
    { key: 'role', header: 'Role', render: (h: CapaApprovalHistoryEntry) => <CapaRoleBadge role={h.user_role} /> },
    { key: 'date', header: 'Date Time', render: (h: CapaApprovalHistoryEntry) => h.created_at ? new Date(h.created_at).toLocaleString() : '—' },
    { key: 'comments', header: 'Comments', render: (h: CapaApprovalHistoryEntry) => h.comments || h.rejection_reason || h.send_back_reason || '—' },
    { key: 'esign', header: 'E-Signature Status', render: (h: CapaApprovalHistoryEntry) => h.e_signature_status || '—' },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const count = await escalateOverdueCapaApprovals(actor);
    setBusy(false);
    toast.success(count ? `${count} approval(s) escalated` : 'No overdue approvals');
    void load();
  };

  return (
    <CapaApprovalAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Approval Workflow"
          description="Review, approve and authorize CAPA records"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
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
              <KpiCard label="Approved CAPA" value={counts?.approvedCapa ?? 0} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected CAPA" value={counts?.rejectedCapa ?? 0} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Sent Back CAPA" value={counts?.sentBackCapa ?? 0} icon={RotateCcw} accent="border-l-orange-500" />
              <KpiCard label="Critical CAPA Pending" value={counts?.criticalPending ?? 0} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="Overdue Approvals" value={counts?.overdueApprovals ?? 0} icon={AlertTriangle} accent="border-l-purple-600" />
              <KpiCard label="Head QA Pending" value={counts?.headQaPending ?? 0} icon={ShieldCheck} accent="border-l-indigo-600" />
              <KpiCard label="CAPA Ready For Closure" value={counts?.readyForClosure ?? 0} icon={CheckCircle2} accent="border-l-teal-600" />
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
                  <ResponsiveDataTable columns={pendingColumns} data={pendingRows} mobileTitleKey="capa_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No pending approvals" message="All CAPA approval steps are complete or awaiting submission." />
                )}
              </TabsContent>

              <TabsContent value="my" className="mt-4">
                {myPending.length ? (
                  <ResponsiveDataTable columns={pendingColumns} data={myPending} mobileTitleKey="capa_number" mobileSubtitleKey="current_workflow_step" pageSize={15} />
                ) : (
                  <EmptyState title="No approvals assigned to you" message="Pending steps for your role will appear here." />
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {history.length ? (
                  <ResponsiveDataTable columns={historyColumns} data={history.slice(0, 200)} mobileTitleKey="capa_number" mobileSubtitleKey="action" pageSize={20} />
                ) : (
                  <EmptyState title="No approval history" message="Approval actions will appear here once recorded." />
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <Card><CardHeader><CardTitle className="text-base">Recent Approval Timeline</CardTitle></CardHeader>
                  <CardContent><CapaApprovalTimeline entries={timeline} /></CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Audit Trail Summary</CardTitle></CardHeader>
                  <CardContent>
                    {history.length ? (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>CAPA #</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Step</TableHead><TableHead>Date</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {history.slice(0, 30).map((h) => (
                            <TableRow key={`${h.capa_id}-${h.created_at}-${h.action}`}>
                              <TableCell className="font-mono">{h.capa_number}</TableCell>
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
    </CapaApprovalAccessGuard>
  );
}
