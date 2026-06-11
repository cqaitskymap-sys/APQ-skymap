'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList, CheckCircle, AlertTriangle, Bell, Activity, XCircle, RotateCcw, Download, Eye, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MonitoringDashboardCharts } from '@/components/monitoring-mgmt/monitoring-dashboard-charts';
import { AreaFiltersBar } from '@/components/monitoring-mgmt/monitoring-filters';
import { MonitoringStatusBadge, GradeBadge } from '@/components/monitoring-mgmt/monitoring-sub-nav';
import { useMonitoring } from '@/hooks/use-monitoring-mgmt';
import { exportAreasCsv } from '@/lib/monitoring-mgmt-service';
import type { AreaFilters } from '@/lib/monitoring-mgmt-types';
import { cn } from '@/lib/utils';

export default function MonitoringDashboardPage() {
  const [filters, setFilters] = useState<AreaFilters>({});
  const { areas, environmental, utility, excursions, metrics, loading, error } = useMonitoring(filters);

  const kpiCards = metrics ? [
    { label: 'Total Records', value: metrics.totalRecords, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Compliant', value: metrics.compliant, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Alerts', value: metrics.alert, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Action', value: metrics.action, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Excursions', value: metrics.excursions, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Open Excursions', value: metrics.openExcursions, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Closed Excursions', value: metrics.closedExcursions, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Repeated Excursions', value: metrics.repeatedExcursions, icon: RotateCcw, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Monitoring Dashboard</h1>
          <p className="text-muted-foreground text-sm">Environmental and utility monitoring for cleanrooms, HVAC, water, and compressed air systems</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportAreasCsv(areas)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/monitoring/area-master"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Add Area</Button></Link>
        </div>
      </div>
      <AreaFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <MonitoringDashboardCharts environmental={environmental} utility={utility} excursions={excursions} areas={areas} />
          <Card><CardHeader><CardTitle>Area Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Grade</TableHead>
              <TableHead>Department</TableHead><TableHead>Room</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {areas.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No areas registered</TableCell></TableRow>
                : areas.slice(0, 15).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.area_code}</TableCell>
                    <TableCell>{a.area_name}</TableCell>
                    <TableCell><GradeBadge grade={a.cleanroom_grade} /></TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>{a.room_number || '—'}</TableCell>
                    <TableCell><MonitoringStatusBadge status={a.area_status} /></TableCell>
                    <TableCell><Link href={`/qms/monitoring/${a.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
