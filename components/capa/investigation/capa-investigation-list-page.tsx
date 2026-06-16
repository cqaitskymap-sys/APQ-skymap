'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Eye, FlaskConical, Layers, Search, Wrench, XCircle,
} from 'lucide-react';
import { fetchCapaInvestigationDashboard } from '@/lib/capa-investigation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaInvestigationAccessGuard } from './capa-investigation-access-guard';
import { CapaInvestigationStatusBadge } from './capa-investigation-status-badge';
import { CapaRcaCategoryBadge } from './capa-rca-badges';
import { Button } from '@/components/ui/button';
import type { CapaInvestigation, CapaRecord } from '@/lib/capa-types';

type Row = CapaInvestigation & { capa?: CapaRecord | null };

export function CapaInvestigationListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0, open: 0, approved: 0, rejected: 0, pendingQaReview: 0,
    trainingRelated: 0, equipmentRelated: 0, processRelated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await fetchCapaInvestigationDashboard();
      if (data.error) setError(data.error);
      setRows(data.investigations);
      setMetrics(data.metrics);
      setLoading(false);
    })();
  }, []);

  const columns = [
    { key: 'investigation_id', header: 'Investigation ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.investigation_id}</span> },
    { key: 'capa_number', header: 'CAPA #', render: (r: Row) => <span className="font-mono">{r.capa_number}</span> },
    { key: 'source_type', header: 'Source', render: (r: Row) => `${r.source_type} (${r.source_reference || '—'})` },
    { key: 'investigator_name', header: 'Investigator', render: (r: Row) => r.investigator_name || '—' },
    { key: 'department', header: 'Department' },
    { key: 'root_cause_category', header: 'RCA Category', render: (r: Row) => <CapaRcaCategoryBadge category={r.root_cause_category} /> },
    { key: 'status', header: 'Investigation Status', render: (r: Row) => <CapaInvestigationStatusBadge status={r.status} /> },
    { key: 'capa_status', header: 'CAPA Status', render: (r: Row) => r.capa ? <CapaStatusBadge status={r.capa.capa_status} /> : '—' },
    { key: 'priority', header: 'Priority', render: (r: Row) => r.capa ? <CapaPriorityBadge priority={r.capa.priority} /> : '—' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/capa/${r.capa_id}/investigation`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <CapaInvestigationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Investigation & Root Cause Analysis"
          description="GMP-compliant CAPA investigations, RCA worksheets, and QA review tracking"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Investigation & RCA' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Total Investigations" value={metrics.total} icon={ClipboardList} />
              <KpiCard label="Open Investigations" value={metrics.open} icon={Search} accent="border-l-amber-500" />
              <KpiCard label="Approved RCA" value={metrics.approved} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected RCA" value={metrics.rejected} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Pending QA Review" value={metrics.pendingQaReview} icon={AlertTriangle} accent="border-l-purple-600" />
              <KpiCard label="Training Related RCA" value={metrics.trainingRelated} icon={Layers} accent="border-l-amber-600" />
              <KpiCard label="Equipment Related RCA" value={metrics.equipmentRelated} icon={Wrench} accent="border-l-orange-600" />
              <KpiCard label="Process Related RCA" value={metrics.processRelated} icon={FlaskConical} accent="border-l-blue-600" />
            </div>

            {rows.length ? (
              <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="investigation_id" mobileSubtitleKey="capa_number" pageSize={15} />
            ) : (
              <EmptyState
                title="No CAPA investigations yet"
                message="Open a CAPA record and start investigation & root cause analysis from the investigation tab."
              />
            )}
          </>
        )}
      </div>
    </CapaInvestigationAccessGuard>
  );
}
