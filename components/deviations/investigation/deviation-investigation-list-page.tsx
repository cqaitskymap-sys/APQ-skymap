'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { listOpenInvestigations } from '@/lib/deviation-investigation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationInvestigationAccessGuard } from './deviation-investigation-access-guard';
import { InvestigationStatusBadge } from './investigation-status-badge';
import { Button } from '@/components/ui/button';
import type { DeviationInvestigation, DeviationRecord } from '@/lib/deviation-types';

type Row = DeviationRecord & { investigation?: DeviationInvestigation | null };

export function DeviationInvestigationListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setRows(await listOpenInvestigations());
      } catch {
        setError('Failed to load investigations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = [
    { key: 'deviation_number', header: 'Deviation No', render: (r: Row) => <span className="font-mono text-blue-600">{r.deviation_number}</span> },
    { key: 'department', header: 'Department' },
    { key: 'product_name', header: 'Product' },
    { key: 'assigned_investigator_name', header: 'Investigator', render: (r: Row) => r.assigned_investigator_name || '—' },
    { key: 'criticality', header: 'Criticality', render: (r: Row) => <DeviationCriticalityBadge criticality={r.criticality} /> },
    { key: 'status', header: 'Deviation Status', render: (r: Row) => <DeviationStatusBadge status={r.status} /> },
    { key: 'inv_status', header: 'Investigation', render: (r: Row) => <InvestigationStatusBadge status={r.investigation?.investigation_status} /> },
    { key: 'target_closure_date', header: 'Due Date', render: (r: Row) => r.target_closure_date || '—' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/deviation/${r.id}/investigation`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <DeviationInvestigationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Investigations"
          description="Open and in-progress GMP deviation investigations"
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: 'Investigations' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : rows.length ? (
          <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="deviation_number" mobileSubtitleKey="department" pageSize={15} />
        ) : (
          <EmptyState title="No open investigations" message="Submitted deviations awaiting investigation will appear here." />
        )}
      </div>
    </DeviationInvestigationAccessGuard>
  );
}
