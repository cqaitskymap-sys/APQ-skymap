'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck, Clock, CheckCircle, XCircle, AlertTriangle, Link2, RefreshCw, Calendar, Download, Eye, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ValidationDashboardCharts } from '@/components/validation-mgmt/validation-dashboard-charts';
import { ValidationFiltersBar } from '@/components/validation-mgmt/validation-filters';
import { ValidationStatusBadge } from '@/components/validation-mgmt/validation-sub-nav';
import { useValidations } from '@/hooks/use-validation-mgmt';
import { exportValidationsCsv } from '@/lib/validation-mgmt-service';
import type { ValidationFilters } from '@/lib/validation-mgmt-types';
import { cn } from '@/lib/utils';

export default function ValidationDashboardPage() {
  const [filters, setFilters] = useState<ValidationFilters>({});
  const { records, metrics, loading, error } = useValidations(filters);

  const kpiCards = metrics ? [
    { label: 'Total Validations', value: metrics.total, icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Validations', value: metrics.open, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Approved', value: metrics.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: metrics.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Deviation Observed', value: metrics.deviationObserved, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'CAPA Linked', value: metrics.capaLinked, icon: Link2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Revalidation Due', value: metrics.revalidationDue, icon: RefreshCw, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Overdue', value: metrics.overdue, icon: Calendar, color: 'text-red-600', bg: 'bg-red-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Validation Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant validation lifecycle for equipment, process, cleaning, method, and CSV</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportValidationsCsv(records)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/validation/vmp"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />New Validation</Button></Link>
        </div>
      </div>
      <ValidationFiltersBar filters={filters} onChange={setFilters} />
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
          <ValidationDashboardCharts records={records} />
          <Card><CardHeader><CardTitle>Validation Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
              <TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Deviation</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {records.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No validations found</TableCell></TableRow>
                : records.slice(0, 15).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.validation_number}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.validation_title}</TableCell>
                    <TableCell className="text-xs">{r.validation_type}</TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell><ValidationStatusBadge status={r.validation_status} /></TableCell>
                    <TableCell>{r.deviation_observed ? 'Yes' : 'No'}</TableCell>
                    <TableCell><Link href={`/qms/validation/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
