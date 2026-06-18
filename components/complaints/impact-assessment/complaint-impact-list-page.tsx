'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { listComplaintImpactAssessments } from '@/lib/complaint-impact-service';
import type { ComplaintImpactAssessment, ComplaintRecord } from '@/lib/complaint-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ComplaintStatusBadge, CriticalityBadge, RiskBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintImpactAccessGuard } from './complaint-impact-access-guard';
import { ComplaintImpactStatusBadge } from './complaint-impact-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Row = ComplaintRecord & { impact?: ComplaintImpactAssessment | null };

export function ComplaintImpactListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listComplaintImpactAssessments());
    } catch {
      setError('Failed to load complaint impact assessments.');
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
    { key: 'impact_status', header: 'Assessment', render: (r: Row) => <ComplaintImpactStatusBadge status={r.impact?.status} /> },
    { key: 'risk', header: 'Risk', render: (r: Row) => r.impact?.risk_level ? <RiskBadge level={r.impact.risk_level} /> : '—' },
    { key: 'capa', header: 'CAPA', render: (r: Row) => (r.impact?.capa_required || r.capa_required) ? 'Yes' : 'No' },
    { key: 'assessed_by', header: 'Assessed By', render: (r: Row) => r.impact?.assessed_by_name || '—' },
    {
      key: 'action',
      header: 'Action',
      render: (r: Row) => (
        <Link href={`/qms/complaints/${r.id}/impact-assessment`}>
          <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> Open</Button>
        </Link>
      ),
    },
  ];

  return (
    <ComplaintImpactAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Impact Assessments"
          description="Product quality, patient safety, regulatory, market, batch, and distribution impact evaluations"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'Impact Assessment' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Impact Assessment Queue</CardTitle></CardHeader>
            <CardContent>
              {rows.length ? (
                <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="complaint_number" mobileSubtitleKey="product_name" pageSize={12} />
              ) : (
                <EmptyState title="No complaint impact assessments" message="Complaints requiring impact evaluation will appear here." />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ComplaintImpactAccessGuard>
  );
}
