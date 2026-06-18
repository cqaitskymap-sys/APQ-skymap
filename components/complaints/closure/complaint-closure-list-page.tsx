'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { fetchComplaintClosureDashboardData } from '@/lib/complaint-closure-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { ComplaintClosureAccessGuard } from './complaint-closure-access-guard';
import { ComplaintClosureStatusBadge } from './complaint-closure-ui';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/cpv/cpv-ui';
import type { ComplaintClosure, ComplaintRecord } from '@/lib/complaint-types';

type Row = ComplaintRecord & { closure?: ComplaintClosure | null };

export function ComplaintClosureListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<Row[]>([]);
  const [qaReview, setQaReview] = useState<Row[]>([]);
  const [closed, setClosed] = useState<Row[]>([]);
  const [pending, setPending] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchComplaintClosureDashboardData();
        setReady(data.ready);
        setQaReview(data.qaReview);
        setClosed(data.closed);
        setPending(data.pending);
      } catch {
        setError('Failed to load closure dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = useMemo(() => [
    { key: 'complaint_number', header: 'Complaint No', render: (r: Row) => <span className="font-mono text-blue-600">{r.complaint_number}</span> },
    { key: 'customer_name', header: 'Customer' },
    { key: 'product_name', header: 'Product' },
    { key: 'complaint_criticality', header: 'Criticality', render: (r: Row) => <CriticalityBadge value={r.complaint_criticality} /> },
    { key: 'status', header: 'Complaint Status', render: (r: Row) => <ComplaintStatusBadge status={r.status} /> },
    { key: 'closure_status', header: 'Closure Status', render: (r: Row) => <ComplaintClosureStatusBadge status={r.closure?.closure_status} /> },
    { key: 'readiness', header: 'Readiness', render: (r: Row) => `${r.closure?.readiness_percent ?? 0}%` },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/complaints/${r.id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ], []);

  return (
    <ComplaintClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Closure"
          description="GMP-compliant complaint closure after investigation, impact assessment, CAPA, recall evaluation, and QA approval"
          trail={[
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'Closure' },
          ]}
        />
        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Pending Closure" value={pending.length} />
              <KpiCard label="Ready For Closure" value={ready.length} tone="blue" />
              <KpiCard label="QA Review" value={qaReview.length} tone="amber" />
              <KpiCard label="Closed" value={closed.length} tone="green" />
            </div>
            <Tabs defaultValue="ready">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="ready">Ready For Closure</TabsTrigger>
                <TabsTrigger value="qa">QA Review</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="all">All Open</TabsTrigger>
              </TabsList>
              {[
                ['ready', ready, 'No complaints ready for closure'],
                ['qa', qaReview, 'No closures in QA review'],
                ['closed', closed, 'No closed complaints'],
                ['all', pending, 'No open complaints'],
              ].map(([tab, rows, empty]) => (
                <TabsContent key={String(tab)} value={String(tab)} className="mt-4">
                  {(rows as Row[]).length ? (
                    <ResponsiveDataTable columns={columns} data={rows as Row[]} mobileTitleKey="complaint_number" mobileSubtitleKey="customer_name" pageSize={15} />
                  ) : (
                    <EmptyState title="Nothing here" message={String(empty)} />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
    </ComplaintClosureAccessGuard>
  );
}
