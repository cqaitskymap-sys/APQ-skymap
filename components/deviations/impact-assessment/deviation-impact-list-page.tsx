'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { listImpactAssessments } from '@/lib/deviation-impact-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { DeviationImpactAccessGuard } from './deviation-impact-access-guard';
import { ImpactStatusBadge } from './impact-status-badge';
import { Button } from '@/components/ui/button';
import type { DeviationImpactAssessment, DeviationRecord } from '@/lib/deviation-types';

type Row = DeviationRecord & { impact?: DeviationImpactAssessment | null };

export function DeviationImpactListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setRows(await listImpactAssessments());
      } catch {
        setError('Failed to load impact assessments.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = [
    { key: 'deviation_number', header: 'Deviation No', render: (r: Row) => <span className="font-mono text-blue-600">{r.deviation_number}</span> },
    { key: 'department', header: 'Department' },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch', render: (r: Row) => r.batch_number || '—' },
    { key: 'criticality', header: 'Criticality', render: (r: Row) => <DeviationCriticalityBadge criticality={r.criticality} /> },
    { key: 'status', header: 'Deviation Status', render: (r: Row) => <DeviationStatusBadge status={r.status} /> },
    { key: 'impact_status', header: 'Assessment', render: (r: Row) => <ImpactStatusBadge status={r.impact?.status} /> },
    { key: 'risk', header: 'Risk', render: (r: Row) => r.impact?.risk_level ? `${r.impact.risk_score} (${r.impact.risk_level})` : '—' },
    { key: 'capa', header: 'CAPA', render: (r: Row) => (r.impact?.capa_required || r.capa_required) ? 'Yes' : 'No' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/deviation/${r.id}/impact-assessment`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <DeviationImpactAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Deviation Impact Assessments"
          description="GMP impact evaluations for batch, product quality, patient safety, and regulatory compliance"
          trail={[
            { label: 'QMS', href: '/qms/deviation' },
            { label: 'Deviation Management', href: '/qms/deviation' },
            { label: 'Impact Assessments' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : rows.length ? (
          <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="deviation_number" mobileSubtitleKey="department" pageSize={15} />
        ) : (
          <EmptyState title="No deviations pending impact assessment" message="Submitted deviations requiring impact evaluation will appear here." />
        )}
      </div>
    </DeviationImpactAccessGuard>
  );
}
