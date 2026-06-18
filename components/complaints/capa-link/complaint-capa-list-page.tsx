'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { listComplaintCapaLinks, isComplaintCapaLinkOverdue } from '@/lib/complaint-capa-service';
import type { ComplaintCapaLink, ComplaintRecord } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintCapaAccessGuard } from './complaint-capa-access-guard';
import { ComplaintCapaStatusBadge } from './complaint-capa-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Row = ComplaintRecord & { link?: ComplaintCapaLink | null };

export function ComplaintCapaListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listComplaintCapaLinks());
    } catch {
      setError('Failed to load complaint CAPA links.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'complaint_number', header: 'Complaint No', render: (r: Row) => <span className="font-mono text-blue-600">{r.complaint_number}</span> },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch' },
    { key: 'customer_name', header: 'Customer' },
    { key: 'criticality', header: 'Criticality', render: (r: Row) => <CriticalityBadge value={r.complaint_criticality} /> },
    { key: 'complaint_status', header: 'Complaint Status', render: (r: Row) => <ComplaintStatusBadge status={r.status} /> },
    { key: 'capa_number', header: 'CAPA No', render: (r: Row) => <span className="font-mono">{r.link?.capa_number || r.linked_capa_number || '—'}</span> },
    { key: 'capa_status', header: 'CAPA Status', render: (r: Row) => <ComplaintCapaStatusBadge status={r.link?.capa_status} /> },
    { key: 'overdue', header: 'Overdue', render: (r: Row) => isComplaintCapaLinkOverdue(r.link) ? 'Yes' : 'No' },
    { key: 'owner', header: 'Action Owner', render: (r: Row) => r.link?.action_owner_name || '—' },
    {
      key: 'action',
      header: 'Action',
      render: (r: Row) => (
        <Link href={`/qms/complaints/${r.id}/capa`}>
          <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> Open</Button>
        </Link>
      ),
    },
  ];

  return (
    <ComplaintCapaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint CAPA Links"
          description="Create, link, track and verify CAPA actions from customer and market complaints"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'CAPA Link' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">CAPA Link Queue</CardTitle></CardHeader>
            <CardContent>
              {rows.length ? (
                <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="complaint_number" mobileSubtitleKey="product_name" pageSize={12} />
              ) : (
                <EmptyState title="No complaint CAPA links" message="Complaints requiring CAPA will appear here." />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ComplaintCapaAccessGuard>
  );
}
