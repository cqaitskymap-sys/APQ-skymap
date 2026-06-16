'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { listCapaLinkDeviations } from '@/lib/deviation-capa-service';
import { isCapaLinkOverdue } from '@/lib/deviation-capa-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationCapaAccessGuard } from './deviation-capa-access-guard';
import { CapaLinkStatusBadge } from './capa-link-status-badge';
import { Button } from '@/components/ui/button';
import type { DeviationCapaLink, DeviationRecord } from '@/lib/deviation-types';

type Row = DeviationRecord & { link?: DeviationCapaLink | null };

export function DeviationCapaListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setRows(await listCapaLinkDeviations());
      } catch {
        setError('Failed to load CAPA links.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = [
    { key: 'deviation_number', header: 'Deviation No', render: (r: Row) => <span className="font-mono text-blue-600">{r.deviation_number}</span> },
    { key: 'department', header: 'Department' },
    { key: 'product_name', header: 'Product' },
    { key: 'capa_required', header: 'CAPA Req', render: (r: Row) => (r.capa_required ? 'Yes' : 'No') },
    { key: 'capa_number', header: 'CAPA No', render: (r: Row) => <span className="font-mono">{r.link?.capa_number || r.linked_capa_number || '—'}</span> },
    { key: 'capa_status', header: 'CAPA Status', render: (r: Row) => <CapaLinkStatusBadge status={r.link?.capa_status} /> },
    { key: 'overdue', header: 'Overdue', render: (r: Row) => (isCapaLinkOverdue(r.link) ? <span className="text-red-600 text-xs font-medium">Yes</span> : '—') },
    { key: 'criticality', header: 'Criticality', render: (r: Row) => <DeviationCriticalityBadge criticality={r.criticality} /> },
    { key: 'status', header: 'Deviation Status', render: (r: Row) => <DeviationStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/deviation/${r.id}/capa`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <DeviationCapaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation CAPA Links"
          description="Track CAPA linkage, status, and effectiveness for deviations"
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: 'CAPA Links' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : rows.length ? (
          <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="deviation_number" mobileSubtitleKey="department" pageSize={15} />
        ) : (
          <EmptyState title="No CAPA-linked deviations" message="Deviations requiring or linked to CAPA will appear here." />
        )}
      </div>
    </DeviationCapaAccessGuard>
  );
}
