'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Download, Eye, FlaskConical, Clock, CheckCircle, Calendar, AlertTriangle,
  TestTube, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StabilityDashboardCharts } from '@/components/stability/stability-dashboard-charts';
import { StabilityFiltersBar } from '@/components/stability/stability-filters';
import { StudyStatusBadge } from '@/components/stability/stability-sub-nav';
import { useStabilityStudies } from '@/hooks/use-stability';
import { exportStudiesCsv } from '@/lib/stability-service';
import type { StabilityFilters } from '@/lib/stability-types';
import { cn } from '@/lib/utils';

export default function StabilityDashboardPage() {
  const [filters, setFilters] = useState<StabilityFilters>({});
  const { records, pulls, results, metrics, loading, error } = useStabilityStudies(filters);

  const kpiCards = metrics ? [
    { label: 'Total Studies', value: metrics.total, icon: FlaskConical, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Ongoing Studies', value: metrics.ongoing, icon: Clock, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Completed Studies', value: metrics.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Samples Due', value: metrics.samplesDue, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Missed Samples', value: metrics.missedSamples, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'OOS Results', value: metrics.oosResults, icon: TestTube, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'OOT Results', value: metrics.ootResults, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Closing This Month', value: metrics.closingThisMonth, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stability Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant stability study management linked to PQR, CPV, and OOS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportStudiesCsv(records)}>
            <Download className="h-4 w-4" />Export
          </Button>
          <Link href="/qms/stability/create">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create Study</Button>
          </Link>
        </div>
      </div>

      <StabilityFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
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

          <StabilityDashboardCharts studies={records} pulls={pulls} results={results} />

          <Card>
            <CardHeader><CardTitle>Stability Study Register</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Initiation</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No stability studies found</TableCell></TableRow>
                  ) : records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.stability_study_number}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{r.product_name}</TableCell>
                      <TableCell>{r.batch_number}</TableCell>
                      <TableCell className="text-xs">{r.study_type}</TableCell>
                      <TableCell className="text-xs">{r.storage_condition}</TableCell>
                      <TableCell><StudyStatusBadge status={r.status} /></TableCell>
                      <TableCell>{r.study_initiation_date}</TableCell>
                      <TableCell>
                        <Link href={`/qms/stability/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
