'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { listOosImpactAssessments } from '@/lib/oos-impact-service';
import type { OosImpactAssessment, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { OosStatusBadge, RiskBadge } from '@/components/oos/oos-sub-nav';
import { OosImpactStatusBadge } from './oos-impact-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Row = OosRecord & { impact?: OosImpactAssessment | null };

export function OosImpactListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listOosImpactAssessments());
    } catch {
      setError('Failed to load OOS impact assessments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'oos_number', header: 'OOS No', render: (r: Row) => <span className="font-mono text-blue-600">{r.oos_number}</span> },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch' },
    { key: 'test_name', header: 'Test' },
    { key: 'oos_status', header: 'OOS Status', render: (r: Row) => <OosStatusBadge status={r.status} /> },
    { key: 'impact_status', header: 'Assessment', render: (r: Row) => <OosImpactStatusBadge status={r.impact?.status} /> },
    { key: 'risk', header: 'Risk', render: (r: Row) => r.impact?.risk_level ? <RiskBadge level={r.impact.risk_level} /> : '—' },
    { key: 'capa', header: 'CAPA', render: (r: Row) => (r.impact?.capa_required || r.capa_required) ? 'Yes' : 'No' },
    { key: 'assessed_by', header: 'Assessed By', render: (r: Row) => r.impact?.assessed_by_name || '—' },
    {
      key: 'action',
      header: 'Action',
      render: (r: Row) => (
        <Link href={`/qms/oos/${r.id}/impact-assessment`}>
          <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> Open</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CpvPageHeader
        title="OOS Impact Assessments"
        description="Product, batch, patient safety, regulatory, and market impact evaluations for OOS records"
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'QMS', href: '/qms/oos' },
          { label: 'OOS Management', href: '/qms/oos' },
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
              <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="oos_number" mobileSubtitleKey="test_name" pageSize={12} />
            ) : (
              <EmptyState title="No OOS impact assessments" message="OOS records requiring impact evaluation will appear here." />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
