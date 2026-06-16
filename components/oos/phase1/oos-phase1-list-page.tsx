'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { listPhase1Queue } from '@/lib/oos-phase1-service';
import type { OosPhase1, OosRecord } from '@/lib/oos-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { OosStatusBadge } from '@/components/oos/oos-sub-nav';
import { Phase1StatusBadge } from './phase1-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Row = OosRecord & { phase1?: OosPhase1 | null };

export function OosPhase1ListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPhase1Queue());
    } catch {
      setError('Failed to load Phase-I queue.');
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
    { key: 'phase1_status', header: 'Phase-I Status', render: (r: Row) => <Phase1StatusBadge status={r.phase1?.status} /> },
    { key: 'investigator', header: 'Investigator', render: (r: Row) => r.phase1?.qc_investigator || r.assigned_to_name || '—' },
    { key: 'due', header: 'Due Date', render: (r: Row) => r.target_closure_date || '—' },
    {
      key: 'action',
      header: 'Action',
      render: (r: Row) => (
        <Link href={`/qms/oos/${r.id}/phase1`}>
          <Button variant="outline" size="sm"><Eye className="mr-1 h-3.5 w-3.5" /> Open</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CpvPageHeader
        title="Phase-I Investigations"
        description="Laboratory Phase-I OOS investigations pending or in progress"
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'QMS', href: '/qms/oos' },
          { label: 'OOS Management', href: '/qms/oos' },
          { label: 'Phase-I' },
        ]}
      />
      {loading ? <LoadingSkeleton rows={3} /> : error ? (
        <ErrorCard title="Load error" message={error} onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Phase-I Queue</CardTitle></CardHeader>
          <CardContent>
            {rows.length ? (
              <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="oos_number" mobileSubtitleKey="test_name" pageSize={12} />
            ) : (
              <EmptyState title="No Phase-I investigations" message="No OOS records are currently in Phase-I workflow." />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
