'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { fetchCcClosureDashboard } from '@/lib/cc-closure-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcStatusBadge, CcCategoryBadge } from '@/components/change-control/cc-sub-nav';
import { CcClosureAccessGuard } from './cc-closure-access-guard';
import { CcClosureStatusBadge } from './cc-closure-ui';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, CheckCircle2, Clock, RefreshCw, RotateCcw, Target, XCircle,
} from 'lucide-react';
import type { ChangeClosure, ChangeControlRecord } from '@/lib/change-control-types';

type Row = ChangeClosure & { change?: ChangeControlRecord | null };

export function CcClosureListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closures, setClosures] = useState<Row[]>([]);
  const [changes, setChanges] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState({
    readyForClosure: 0, pendingReview: 0, closed: 0, rejected: 0,
    reopened: 0, effectiveClosures: 0, partiallyEffective: 0, notEffective: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcClosureDashboard();
    if (data.error) setError(data.error);
    setClosures(data.closures);
    setChanges(data.changes);
    setMetrics(data.metrics);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const readyChanges = useMemo(() => changes.filter((r) =>
    ['implemented', 'effectiveness_completed', 'final_qa_review', 'approved'].includes(r.status) && r.status !== 'closed',
  ), [changes]);

  const columns = [
    { key: 'change_number', header: 'Change No', render: (r: Row) => <span className="font-mono text-blue-600">{r.change_control_number || r.change?.change_control_number}</span> },
    { key: 'department', header: 'Department', render: (r: Row) => r.department || r.change?.department || '—' },
    { key: 'status', header: 'Closure Status', render: (r: Row) => <CcClosureStatusBadge status={r.closure_status} /> },
    { key: 'eff', header: 'Effectiveness', render: (r: Row) => r.effectiveness_result || '—' },
    { key: 'readiness', header: 'Readiness', render: (r: Row) => `${r.readiness_percent ?? 0}%` },
    { key: 'cc_status', header: 'Change Status', render: (r: Row) => r.change ? <CcStatusBadge status={r.change.status} /> : '—' },
    { key: 'category', header: 'Category', render: (r: Row) => r.change ? <CcCategoryBadge category={r.change.change_category} /> : '—' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/change-control/${r.change_control_id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const readyColumns = [
    { key: 'change_number', header: 'Change No', render: (r: ChangeControlRecord) => <span className="font-mono text-blue-600">{r.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: ChangeControlRecord) => <span className="line-clamp-1 max-w-xs">{r.change_title}</span> },
    { key: 'department', header: 'Department' },
    { key: 'category', header: 'Category', render: (r: ChangeControlRecord) => <CcCategoryBadge category={r.change_category} /> },
    { key: 'status', header: 'Status', render: (r: ChangeControlRecord) => <CcStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: ChangeControlRecord) => (
      <Link href={`/qms/change-control/${r.id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <CcClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Closure"
          description="Final GMP closure review for implemented change controls"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Closure' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Ready For Closure" value={metrics.readyForClosure} icon={Target} accent="border-l-teal-600" />
              <KpiCard label="Pending Review" value={metrics.pendingReview} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Closed Changes" value={metrics.closed} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected" value={metrics.rejected} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Reopened" value={metrics.reopened} icon={RefreshCw} accent="border-l-orange-500" />
              <KpiCard label="Effective" value={metrics.effectiveClosures} icon={CheckCircle2} accent="border-l-emerald-600" />
              <KpiCard label="Partially Effective" value={metrics.partiallyEffective} icon={AlertTriangle} accent="border-l-amber-600" />
              <KpiCard label="Not Effective" value={metrics.notEffective} icon={XCircle} accent="border-l-red-600" />
            </div>

            {readyChanges.length > 0 && (
              <>
                <h3 className="text-sm font-semibold">Changes Ready For Closure</h3>
                <ResponsiveDataTable columns={readyColumns} data={readyChanges} mobileTitleKey="change_control_number" mobileSubtitleKey="change_title" pageSize={10} />
              </>
            )}

            {closures.length ? (
              <>
                <h3 className="text-sm font-semibold">Closure Records</h3>
                <ResponsiveDataTable columns={columns} data={closures} mobileTitleKey="change_control_number" mobileSubtitleKey="closure_status" pageSize={15} />
              </>
            ) : !readyChanges.length ? (
              <EmptyState title="No closure records yet" message="Change controls ready for closure will appear here after implementation and effectiveness review." />
            ) : null}
          </>
        )}
      </div>
    </CcClosureAccessGuard>
  );
}
