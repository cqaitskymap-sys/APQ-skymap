'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Wrench, CheckCircle, Ban, Calendar, AlertTriangle, Settings, Activity, TrendingUp, Download, Eye, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EquipmentDashboardCharts } from '@/components/equipment-mgmt/equipment-dashboard-charts';
import { EquipmentFiltersBar } from '@/components/equipment-mgmt/equipment-filters';
import { EquipmentStatusBadge } from '@/components/equipment-mgmt/equipment-sub-nav';
import { useEquipment } from '@/hooks/use-equipment-mgmt';
import { exportEquipmentCsv } from '@/lib/equipment-mgmt-service';
import type { EquipmentFilters } from '@/lib/equipment-mgmt-types';
import { cn } from '@/lib/utils';

export default function EquipmentDashboardPage() {
  const [filters, setFilters] = useState<EquipmentFilters>({});
  const { equipment, breakdowns, metrics, loading, error } = useEquipment(filters);

  const kpiCards = metrics ? [
    { label: 'Total Equipment', value: metrics.total, icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Equipment', value: metrics.active, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Blocked Equipment', value: metrics.blocked, icon: Ban, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Calibration Due', value: metrics.calibrationDue, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Calibration Overdue', value: metrics.calibrationOverdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'PM Due', value: metrics.pmDue, icon: Settings, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'PM Overdue', value: metrics.pmOverdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Breakdowns This Month', value: metrics.breakdownsThisMonth, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Availability %', value: `${metrics.availabilityPercent}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipment Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant calibration, preventive maintenance, and equipment status management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportEquipmentCsv(equipment)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/equipment/master"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Add Equipment</Button></Link>
        </div>
      </div>
      <EquipmentFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <EquipmentDashboardCharts equipment={equipment} breakdowns={breakdowns} />
          <Card><CardHeader><CardTitle>Equipment Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead>
              <TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Calibration</TableHead><TableHead>PM</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {equipment.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No equipment registered</TableCell></TableRow>
                : equipment.slice(0, 15).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">{e.equipment_id}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{e.equipment_name}</TableCell>
                    <TableCell className="text-xs">{e.equipment_type}</TableCell>
                    <TableCell>{e.department}</TableCell>
                    <TableCell><EquipmentStatusBadge status={e.equipment_status} /></TableCell>
                    <TableCell><EquipmentStatusBadge status={e.calibration_status} /></TableCell>
                    <TableCell><EquipmentStatusBadge status={e.pm_status} /></TableCell>
                    <TableCell><Link href={`/qms/equipment/${e.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
