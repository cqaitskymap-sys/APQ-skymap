'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { fetchCapaClosureDashboard } from '@/lib/capa-closure-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaClosureAccessGuard } from './capa-closure-access-guard';
import { CapaClosureStatusBadge } from './capa-closure-ui';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, CheckCircle2, Clock, RefreshCw, RotateCcw, Target, XCircle,
} from 'lucide-react';
import type { CapaClosure, CapaRecord } from '@/lib/capa-types';

type Row = CapaClosure & { capa?: CapaRecord | null };

export function CapaClosureListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closures, setClosures] = useState<Row[]>([]);
  const [capas, setCapas] = useState<CapaRecord[]>([]);
  const [metrics, setMetrics] = useState({
    readyForClosure: 0, pendingReview: 0, closed: 0, rejected: 0,
    reopened: 0, effectiveClosures: 0, partiallyEffective: 0, notEffective: 0,
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await fetchCapaClosureDashboard();
      if (data.error) setError(data.error);
      setClosures(data.closures);
      setCapas(data.capas);
      setMetrics(data.metrics);
      setLoading(false);
    })();
  }, []);

  const readyCapas = useMemo(() => capas.filter((r) =>
    ['approved', 'effectiveness_completed'].includes(r.capa_status) && r.capa_status !== 'closed',
  ), [capas]);

  const columns = [
    { key: 'capa_number', header: 'CAPA Number', render: (r: Row) => <span className="font-mono text-blue-600">{r.capa_number || r.capa?.capa_number}</span> },
    { key: 'source', header: 'Source', render: (r: Row) => r.source_type || r.capa?.capa_source || '—' },
    { key: 'department', header: 'Department', render: (r: Row) => r.department || r.capa?.department || '—' },
    { key: 'status', header: 'Closure Status', render: (r: Row) => <CapaClosureStatusBadge status={r.closure_status} /> },
    { key: 'eff', header: 'Effectiveness', render: (r: Row) => r.effectiveness_result || '—' },
    { key: 'readiness', header: 'Readiness', render: (r: Row) => `${r.readiness_percent ?? 0}%` },
    { key: 'capa_status', header: 'CAPA Status', render: (r: Row) => r.capa ? <CapaStatusBadge status={r.capa.capa_status} /> : '—' },
    { key: 'priority', header: 'Priority', render: (r: Row) => r.capa ? <CapaPriorityBadge priority={r.capa.priority} /> : '—' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/capa/${r.capa_id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const readyColumns = [
    { key: 'capa_number', header: 'CAPA Number', render: (r: CapaRecord) => <span className="font-mono text-blue-600">{r.capa_number}</span> },
    { key: 'title', header: 'Title', render: (r: CapaRecord) => <span className="line-clamp-1 max-w-xs">{r.capa_title}</span> },
    { key: 'source', header: 'Source', render: (r: CapaRecord) => r.capa_source },
    { key: 'department', header: 'Department' },
    { key: 'eff', header: 'Effectiveness', render: (r: CapaRecord) => r.effectiveness_result },
    { key: 'status', header: 'CAPA Status', render: (r: CapaRecord) => <CapaStatusBadge status={r.capa_status} /> },
    { key: 'priority', header: 'Priority', render: (r: CapaRecord) => <CapaPriorityBadge priority={r.priority} /> },
    { key: 'actions', header: 'Action', render: (r: CapaRecord) => (
      <Link href={`/qms/capa/${r.id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <CapaClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Closure"
          description="Final closure review and authorization of CAPA records"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Closure' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Ready For Closure" value={metrics.readyForClosure} icon={Target} accent="border-l-teal-600" />
              <KpiCard label="Pending Closure Review" value={metrics.pendingReview} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Closed CAPA" value={metrics.closed} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected Closures" value={metrics.rejected} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Reopened CAPA" value={metrics.reopened} icon={RefreshCw} accent="border-l-orange-500" />
              <KpiCard label="Effective Closures" value={metrics.effectiveClosures} icon={CheckCircle2} accent="border-l-emerald-600" />
              <KpiCard label="Partially Effective" value={metrics.partiallyEffective} icon={AlertTriangle} accent="border-l-amber-600" />
              <KpiCard label="Not Effective" value={metrics.notEffective} icon={XCircle} accent="border-l-red-600" />
            </div>

            {readyCapas.length > 0 && (
              <>
                <h3 className="text-sm font-semibold">CAPA Ready For Closure</h3>
                <ResponsiveDataTable columns={readyColumns} data={readyCapas} mobileTitleKey="capa_number" mobileSubtitleKey="capa_title" pageSize={10} />
              </>
            )}

            {closures.length ? (
              <>
                <h3 className="text-sm font-semibold">Closure Records</h3>
                <ResponsiveDataTable columns={columns} data={closures} mobileTitleKey="capa_number" mobileSubtitleKey="closure_status" pageSize={15} />
              </>
            ) : !readyCapas.length ? (
              <EmptyState title="No closure records yet" message="CAPA records ready for closure will appear here after approvals and effectiveness checks." />
            ) : null}
          </>
        )}
      </div>
    </CapaClosureAccessGuard>
  );
}
