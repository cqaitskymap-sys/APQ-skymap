'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Download, Eye, CheckSquare, Clock, Flame, AlertTriangle, Calendar, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CapaDashboardCharts } from '@/components/capa/capa-dashboard-charts';
import { CapaFiltersBar } from '@/components/capa/capa-filters';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { useCapas } from '@/hooks/use-capa';
import { exportCapasCsv } from '@/lib/capa-service';
import type { CapaFilters } from '@/lib/capa-types';
import { cn } from '@/lib/utils';

export default function CapaDashboardPage() {
  const [filters, setFilters] = useState<CapaFilters>({});
  const { records, metrics, loading, error } = useCapas(filters);

  const kpiCards = metrics ? [
    { label: 'Total CAPA', value: metrics.total, icon: CheckSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open CAPA', value: metrics.open, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Closed CAPA', value: metrics.closed, icon: CheckSquare, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Overdue CAPA', value: metrics.overdue, icon: Flame, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Effective CAPA', value: metrics.effective, icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Not Effective', value: metrics.notEffective, icon: ThumbsDown, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Critical CAPA', value: metrics.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Due This Week', value: metrics.dueThisWeek, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CAPA Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant corrective & preventive action management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportCapasCsv(records)}>
            <Download className="h-4 w-4" />Export
          </Button>
          <Link href="/qms/capa/create">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create CAPA</Button>
          </Link>
        </div>
      </div>

      <CapaFiltersBar filters={filters} onChange={setFilters} />

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

          <CapaDashboardCharts records={records} />

          <Card>
            <CardHeader><CardTitle>CAPA Register</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CAPA #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No CAPA records found</TableCell></TableRow>
                  ) : records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.capa_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.capa_title}</TableCell>
                      <TableCell>{r.capa_source}</TableCell>
                      <TableCell>{r.department}</TableCell>
                      <TableCell><CapaPriorityBadge priority={r.priority} /></TableCell>
                      <TableCell><CapaStatusBadge status={r.capa_status} /></TableCell>
                      <TableCell>{r.target_completion_date || '—'}</TableCell>
                      <TableCell>
                        <Link href={`/qms/capa/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link>
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
