'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { listOosCapaManagement } from '@/lib/oos-capa-service';
import { isOosCapaLinkOverdue } from '@/lib/oos-capa-records';
import type { OosCapaDashboardMetrics, OosCapaLink, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { OosStatusBadge } from '@/components/oos/oos-sub-nav';
import { OosCapaAccessGuard } from './oos-capa-access-guard';
import { OosCapaStatusBadge } from './oos-capa-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Row = OosRecord & { link?: OosCapaLink | null };

const KPI_CARDS: { key: keyof OosCapaDashboardMetrics; label: string; color: string }[] = [
  { key: 'totalLinked', label: 'Total Linked CAPA', color: 'text-blue-700' },
  { key: 'openCapa', label: 'Open CAPA', color: 'text-indigo-700' },
  { key: 'closedCapa', label: 'Closed CAPA', color: 'text-green-700' },
  { key: 'overdueCapa', label: 'Overdue CAPA', color: 'text-red-700' },
  { key: 'effectivenessPending', label: 'Effectiveness Pending', color: 'text-purple-700' },
  { key: 'effectiveCapa', label: 'Effective CAPA', color: 'text-emerald-700' },
  { key: 'notEffectiveCapa', label: 'Not Effective CAPA', color: 'text-orange-700' },
  { key: 'repeatOosCapa', label: 'Repeat OOS CAPA', color: 'text-amber-700' },
];

export function OosCapaListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [metrics, setMetrics] = useState<OosCapaDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOosCapaManagement();
      setRows(data.rows);
      setMetrics(data.metrics);
    } catch {
      setError('Failed to load OOS CAPA records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'oos_number', header: 'OOS No', render: (r: Row) => <span className="font-mono text-blue-600">{r.oos_number}</span> },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch' },
    { key: 'capa_required', header: 'CAPA Req', render: (r: Row) => (r.capa_required ? 'Yes' : 'No') },
    { key: 'capa_number', header: 'CAPA No', render: (r: Row) => <span className="font-mono">{r.link?.capa_number || r.linked_capa_number || '—'}</span> },
    { key: 'capa_status', header: 'CAPA Status', render: (r: Row) => <OosCapaStatusBadge status={r.link?.capa_status} overdue={isOosCapaLinkOverdue(r.link)} /> },
    { key: 'oos_status', header: 'OOS Status', render: (r: Row) => <OosStatusBadge status={r.status} /> },
    {
      key: 'action',
      header: 'Action',
      render: (r: Row) => (
        <Link href={`/qms/oos/${r.id}/capa`}>
          <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> Open</Button>
        </Link>
      ),
    },
  ];

  return (
    <OosCapaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS CAPA Management"
          description="Track CAPA linkage, implementation, effectiveness, and closure for OOS investigations"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'CAPA Management' },
          ]}
        />

        {metrics && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            {KPI_CARDS.map(({ key, label, color }) => (
              <Card key={key}><CardContent className="p-3">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{metrics[key]}</p>
              </CardContent></Card>
            ))}
          </div>
        )}

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
        ) : (
          <Card><CardContent className="pt-6">
            {rows.length ? (
              <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="oos_number" mobileSubtitleKey="product_name" pageSize={12} />
            ) : (
              <EmptyState title="No OOS CAPA records" message="OOS records requiring or linked to CAPA will appear here." />
            )}
          </CardContent></Card>
        )}
      </div>
    </OosCapaAccessGuard>
  );
}
