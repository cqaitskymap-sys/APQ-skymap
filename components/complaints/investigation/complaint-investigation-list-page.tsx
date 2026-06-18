'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { listOpenComplaintInvestigations } from '@/lib/complaint-investigation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintInvestigationAccessGuard } from './complaint-investigation-access-guard';
import { ComplaintInvestigationStatusBadge } from './investigation-status-badge';
import { Button } from '@/components/ui/button';
import type { ComplaintInvestigation, ComplaintRecord } from '@/lib/complaint-types';

type Row = ComplaintRecord & { investigation?: ComplaintInvestigation | null };

export function ComplaintInvestigationListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setRows(await listOpenComplaintInvestigations());
      } catch {
        setError('Failed to load complaint investigations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = [
    { key: 'complaint_number', header: 'Complaint No', render: (r: Row) => <span className="font-mono text-blue-600">{r.complaint_number}</span> },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch' },
    { key: 'customer_name', header: 'Customer' },
    { key: 'assigned_to_name', header: 'Investigator', render: (r: Row) => r.assigned_to_name || '—' },
    { key: 'criticality', header: 'Criticality', render: (r: Row) => <CriticalityBadge value={r.complaint_criticality} /> },
    { key: 'status', header: 'Complaint Status', render: (r: Row) => <ComplaintStatusBadge status={r.status} /> },
    { key: 'inv_status', header: 'Investigation', render: (r: Row) => <ComplaintInvestigationStatusBadge status={r.investigation?.investigation_status} /> },
    { key: 'due_date', header: 'Due Date', render: (r: Row) => r.due_date || '—' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/complaints/${r.id}/investigation`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <ComplaintInvestigationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Investigations"
          description="Open and in-progress GMP complaint investigations"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'Investigations' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : rows.length ? (
          <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="complaint_number" mobileSubtitleKey="product_name" pageSize={15} />
        ) : (
          <EmptyState title="No open investigations" message="Submitted complaints awaiting investigation will appear here." />
        )}
      </div>
    </ComplaintInvestigationAccessGuard>
  );
}
