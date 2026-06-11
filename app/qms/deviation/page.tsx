'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Eye, AlertTriangle, Clock, CheckCircle2, Flame, Repeat, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DeviationDashboardCharts } from '@/components/deviations/deviation-dashboard-charts';
import { DeviationFiltersBar } from '@/components/deviations/deviation-filters';
import { DeviationStatusBadge, DeviationCriticalityBadge } from '@/components/deviations/deviation-sub-nav';
import { useDeviations } from '@/hooks/use-deviations';
import { exportDeviationsCsv } from '@/lib/deviation-service';
import type { DeviationFilters } from '@/lib/deviation-types';
import { cn } from '@/lib/utils';

export default function DeviationDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>}>
      <DeviationDashboardContent />
    </Suspense>
  );
}

function DeviationDashboardContent() {
  const searchParams = useSearchParams();
  const initialFilters = useMemo<DeviationFilters>(() => ({
    status: searchParams.get('status') || undefined,
    capa_required: searchParams.get('capa_required') === 'true' ? true : undefined,
  }), [searchParams]);

  const [filters, setFilters] = useState<DeviationFilters>(initialFilters);
  const { records, metrics, loading } = useDeviations(filters);

  const kpiCards = metrics ? [
    { label: 'Total Deviations', value: metrics.total, icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
    { label: 'Open Deviations', value: metrics.open, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
    { label: 'Closed Deviations', value: metrics.closed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
    { label: 'Overdue', value: metrics.overdue, icon: Flame, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
    { label: 'Critical', value: metrics.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
    { label: 'Repeat', value: metrics.repeat, icon: Repeat, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
    { label: 'CAPA Required', value: metrics.capaRequired, icon: Link2, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Deviation Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant deviation tracking, investigation &amp; closure</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportDeviationsCsv(records)}>
            <Download className="h-4 w-4" />Export Excel
          </Button>
          <Link href="/qms/deviation/create">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create Deviation</Button>
          </Link>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {kpiCards.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}>
                      <Icon className={cn('h-4 w-4', s.color)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DeviationFiltersBar filters={filters} onChange={setFilters} />

          {metrics && <DeviationDashboardCharts metrics={metrics} />}

          <Card>
            <CardHeader>
              <CardTitle>All Deviations</CardTitle>
              <CardDescription>{records.length} record(s) matching filters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Dev. No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.length ? records.map((dev) => (
                      <TableRow key={dev.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm text-blue-600">{dev.deviation_number}</TableCell>
                        <TableCell className="text-sm">{dev.deviation_date}</TableCell>
                        <TableCell className="text-sm">{dev.department}</TableCell>
                        <TableCell className="text-sm">{dev.product_name}</TableCell>
                        <TableCell className="text-sm font-mono">{dev.batch_number || '—'}</TableCell>
                        <TableCell className="text-sm">{dev.category}</TableCell>
                        <TableCell><DeviationCriticalityBadge criticality={dev.criticality} /></TableCell>
                        <TableCell><DeviationStatusBadge status={dev.status} /></TableCell>
                        <TableCell className="text-center">
                          <Link href={`/qms/deviation/${dev.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No deviations found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
