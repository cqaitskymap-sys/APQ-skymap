'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { fetchOosClosureDashboardData } from '@/lib/oos-closure-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { OosStatusBadge } from '@/components/oos/oos-sub-nav';
import { OosClosureAccessGuard } from './oos-closure-access-guard';
import { OosClosureStatusBadge } from './oos-closure-ui';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import type { OosClosure, OosRecord } from '@/lib/oos-types';

type Row = OosRecord & { closure?: OosClosure | null };

export function OosClosureListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<Row[]>([]);
  const [qaReview, setQaReview] = useState<Row[]>([]);
  const [closed, setClosed] = useState<Row[]>([]);
  const [pending, setPending] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOosClosureDashboardData();
      setReady(data.ready);
      setQaReview(data.qaReview);
      setClosed(data.closed);
      setPending(data.pending);
    } catch {
      setError('Failed to load closure dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => [
    { key: 'oos_number', header: 'OOS Number', render: (r: Row) => <span className="font-mono text-blue-600">{r.oos_number}</span> },
    { key: 'department', header: 'Department' },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch' },
    { key: 'status', header: 'OOS Status', render: (r: Row) => <OosStatusBadge status={r.status} /> },
    { key: 'closure_status', header: 'Closure Status', render: (r: Row) => <OosClosureStatusBadge status={r.closure?.closure_status} /> },
    { key: 'readiness', header: 'Readiness', render: (r: Row) => `${r.closure?.readiness_percent ?? 0}%` },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/oos/${r.id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ], []);

  const KPI = [
    { label: 'Pending Closure', value: pending.length, color: 'text-slate-700' },
    { label: 'Ready For Closure', value: ready.length, color: 'text-blue-700' },
    { label: 'QA Review', value: qaReview.length, color: 'text-purple-700' },
    { label: 'Closed', value: closed.length, color: 'text-green-700' },
  ];

  return (
    <OosClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Closure"
          description="Final closure review for Out of Specification investigation"
          trail={[
            { label: 'Dashboard', href: '/qms/oos' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'OOS Closure' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {KPI.map((k) => (
                <Card key={k.label}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
                </CardContent></Card>
              ))}
            </div>
            <Tabs defaultValue="ready">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="ready">Ready For Closure</TabsTrigger>
                <TabsTrigger value="qa">QA Review</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="all">All Open</TabsTrigger>
              </TabsList>
              {[
                ['ready', ready, 'No OOS records ready for closure'],
                ['qa', qaReview, 'No closures in QA review'],
                ['closed', closed, 'No closed OOS records'],
                ['all', pending, 'No open OOS records'],
              ].map(([tab, rows, empty]) => (
                <TabsContent key={String(tab)} value={String(tab)} className="mt-4">
                  {(rows as Row[]).length ? (
                    <ResponsiveDataTable columns={columns} data={rows as Row[]} mobileTitleKey="oos_number" mobileSubtitleKey="department" pageSize={15} />
                  ) : (
                    <EmptyState title="Nothing here" message={String(empty)} />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
    </OosClosureAccessGuard>
  );
}
