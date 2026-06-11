'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EquipmentFiltersBar } from '@/components/equipment-mgmt/equipment-filters';
import { EquipmentStatusBadge } from '@/components/equipment-mgmt/equipment-sub-nav';
import { useEquipment } from '@/hooks/use-equipment-mgmt';
import { useState } from 'react';
import type { EquipmentFilters } from '@/lib/equipment-mgmt-types';

export default function CalibrationSchedulePage() {
  const [filters, setFilters] = useState<EquipmentFilters>({});
  const { equipment, loading, error } = useEquipment(filters);

  const scheduled = equipment
    .filter((e) => e.calibration_required && e.calibration_due_date)
    .sort((a, b) => (a.calibration_due_date || '').localeCompare(b.calibration_due_date || ''));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Calibration Schedule</h1>
        <p className="text-muted-foreground text-sm">Upcoming and overdue calibration due dates across all equipment</p>
      </div>
      <EquipmentFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Schedule ({scheduled.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Equipment ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead>
              <TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {scheduled.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No calibration schedule</TableCell></TableRow>
                : scheduled.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">{e.equipment_id}</TableCell>
                    <TableCell>{e.equipment_name}</TableCell><TableCell>{e.department}</TableCell>
                    <TableCell>{e.calibration_due_date}</TableCell>
                    <TableCell><EquipmentStatusBadge status={e.calibration_status} /></TableCell>
                    <TableCell><Link href={`/qms/equipment/${e.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
      )}
    </div>
  );
}
