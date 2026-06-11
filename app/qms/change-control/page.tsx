'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Download, Eye, FileStack, Clock, CheckCircle, Flame, AlertTriangle,
  Shield, Database, GraduationCap, Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CcDashboardCharts } from '@/components/change-control/cc-dashboard-charts';
import { CcFiltersBar } from '@/components/change-control/cc-filters';
import { CcStatusBadge, CcPriorityBadge, CcCategoryBadge } from '@/components/change-control/cc-sub-nav';
import { useChangeControls } from '@/hooks/use-change-control';
import { exportChangesCsv } from '@/lib/change-control-service';
import type { CcFilters } from '@/lib/change-control-types';
import { cn } from '@/lib/utils';

export default function ChangeControlDashboardPage() {
  const [filters, setFilters] = useState<CcFilters>({});
  const { records, metrics, risks, loading, error } = useChangeControls(filters);

  const kpiCards = metrics ? [
    { label: 'Total Change Controls', value: metrics.total, icon: FileStack, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Changes', value: metrics.open, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Closed Changes', value: metrics.closed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Overdue Changes', value: metrics.overdue, icon: Flame, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Critical Changes', value: metrics.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Validation Impact', value: metrics.validationImpact, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'CSV Impact', value: metrics.csvImpact, icon: Database, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Training Pending', value: metrics.trainingPending, icon: GraduationCap, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Regulatory Impact', value: metrics.regulatoryImpact, icon: Scale, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Change Control Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant change control for process, equipment, documents, and systems</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportChangesCsv(records)}>
            <Download className="h-4 w-4" />Export
          </Button>
          <Link href="/qms/change-control/create">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create Change</Button>
          </Link>
        </div>
      </div>

      <CcFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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

          <CcDashboardCharts records={records} risks={risks} />

          <Card>
            <CardHeader><CardTitle>Change Control Register</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CC #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Planned</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No change controls found</TableCell></TableRow>
                  ) : records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.change_control_number}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{r.change_title}</TableCell>
                      <TableCell className="text-xs">{r.change_type}</TableCell>
                      <TableCell>{r.department}</TableCell>
                      <TableCell><CcCategoryBadge category={r.change_category} /></TableCell>
                      <TableCell><CcPriorityBadge priority={r.change_priority} /></TableCell>
                      <TableCell><CcStatusBadge status={r.status} /></TableCell>
                      <TableCell>{r.planned_implementation_date || '—'}</TableCell>
                      <TableCell>
                        <Link href={`/qms/change-control/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link>
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
