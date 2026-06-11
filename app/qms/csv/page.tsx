'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Server, ShieldCheck, CheckCircle, Clock, Calendar, AlertTriangle, Lock, Archive, Download, Eye, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CsvDashboardCharts } from '@/components/csv-mgmt/csv-dashboard-charts';
import { CsvFiltersBar } from '@/components/csv-mgmt/csv-filters';
import { CsvStatusBadge, GxpBadge } from '@/components/csv-mgmt/csv-sub-nav';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';
import { exportSystemsCsv } from '@/lib/csv-mgmt-service';
import type { CsvFilters } from '@/lib/csv-mgmt-types';
import { cn } from '@/lib/utils';

export default function CsvDashboardPage() {
  const [filters, setFilters] = useState<CsvFilters>({});
  const { systems, riskAssessments, metrics, loading, error } = useCsvSystems(filters);

  const kpiCards = metrics ? [
    { label: 'Total Systems', value: metrics.total, icon: Server, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'GxP Critical', value: metrics.gxpCritical, icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Validated', value: metrics.validated, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Validation Pending', value: metrics.validationPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Review Due', value: metrics.periodicReviewDue, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Open Deviations', value: metrics.openDeviations, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Part 11 Gaps', value: metrics.part11Gaps, icon: Lock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Retired', value: metrics.retired, icon: Archive, color: 'text-gray-600', bg: 'bg-gray-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CSV Dashboard</h1>
          <p className="text-muted-foreground text-sm">Computer System Validation lifecycle for GxP systems and pharma digital applications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportSystemsCsv(systems)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/csv/systems"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Add System</Button></Link>
        </div>
      </div>
      <CsvFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <CsvDashboardCharts systems={systems} risks={riskAssessments} />
          <Card><CardHeader><CardTitle>System Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>System ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead>
              <TableHead>Owner</TableHead><TableHead>GxP</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {systems.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No systems registered</TableCell></TableRow>
                : systems.slice(0, 15).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.system_id}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{s.system_name}</TableCell>
                    <TableCell className="text-xs">{s.system_type}</TableCell>
                    <TableCell>{s.system_owner}</TableCell>
                    <TableCell><GxpBadge critical={s.gxp_impact} /></TableCell>
                    <TableCell><CsvStatusBadge status={s.validation_status} /></TableCell>
                    <TableCell><Link href={`/qms/csv/${s.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
