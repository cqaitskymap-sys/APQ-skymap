'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Eye, TestTube, Clock, CheckCircle2, Flame, Link2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OosDashboardCharts } from '@/components/oos/oos-dashboard-charts';
import { OosFiltersBar } from '@/components/oos/oos-filters';
import { OosStatusBadge, ResultStatusBadge } from '@/components/oos/oos-sub-nav';
import { useOosRecords } from '@/hooks/use-oos';
import { exportOosCsv } from '@/lib/oos-service';
import type { OosFilters } from '@/lib/oos-types';
import { cn } from '@/lib/utils';

export default function OosDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <OosDashboardContent />
    </Suspense>
  );
}

function OosDashboardContent() {
  const searchParams = useSearchParams();
  const initialFilters = useMemo<OosFilters>(() => ({
    status: searchParams.get('status') || undefined,
    capa_linked: searchParams.get('capa_linked') === 'true' ? true : undefined,
  }), [searchParams]);
  const [filters, setFilters] = useState<OosFilters>(initialFilters);
  const { records, metrics, loading } = useOosRecords(filters);

  const kpis = metrics ? [
    { label: 'Total OOS', value: metrics.total, icon: TestTube, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
    { label: 'Open OOS', value: metrics.open, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
    { label: 'Closed OOS', value: metrics.closed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
    { label: 'Critical OOS', value: metrics.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
    { label: 'CAPA Linked', value: metrics.capaLinked, icon: Link2, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10' },
    { label: 'Overdue', value: metrics.overdue, icon: Flame, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">OOS Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant Out of Specification investigation workflow</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportOosCsv(records)}><Download className="h-4 w-4" />Export Excel</Button>
          <Link href="/qms/oos/create"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create OOS</Button></Link>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <OosFiltersBar filters={filters} onChange={setFilters} />
          {metrics && <OosDashboardCharts metrics={metrics} />}
          <Card><CardHeader><CardTitle>All OOS Records</CardTitle><CardDescription>{records.length} records</CardDescription></CardHeader>
            <CardContent><div className="rounded-lg border overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>OOS No.</TableHead><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>{records.length ? records.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm text-blue-600">{r.oos_number}</TableCell>
                  <TableCell className="text-sm">{r.oos_date}</TableCell>
                  <TableCell className="text-sm">{r.product_name}</TableCell>
                  <TableCell className="text-sm font-mono">{r.batch_number}</TableCell>
                  <TableCell className="text-sm">{r.test_name}</TableCell>
                  <TableCell><ResultStatusBadge status={r.result_status} /></TableCell>
                  <TableCell><OosStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-center"><Link href={`/qms/oos/${r.id}`}><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No OOS records</TableCell></TableRow>}</TableBody>
            </Table></div></CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
