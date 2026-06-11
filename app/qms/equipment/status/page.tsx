'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EquipmentFiltersBar } from '@/components/equipment-mgmt/equipment-filters';
import { EquipmentStatusBadge } from '@/components/equipment-mgmt/equipment-sub-nav';
import { useEquipment } from '@/hooks/use-equipment-mgmt';
import { isEquipmentUsable } from '@/lib/equipment-mgmt-types';
import type { EquipmentFilters } from '@/lib/equipment-mgmt-types';

export default function EquipmentStatusPage() {
  const [filters, setFilters] = useState<EquipmentFilters>({});
  const { equipment, loading, error } = useEquipment(filters);

  const grouped = {
    Active: equipment.filter((e) => e.equipment_status === 'Active'),
    Blocked: equipment.filter((e) => e.equipment_status === 'Blocked'),
    'Under Maintenance': equipment.filter((e) => e.equipment_status === 'Under Maintenance'),
    Inactive: equipment.filter((e) => e.equipment_status === 'Inactive'),
    Retired: equipment.filter((e) => e.equipment_status === 'Retired'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipment Status</h1>
        <p className="text-muted-foreground text-sm">Real-time equipment availability and blocking status for batch/CPP/PQR selection</p>
      </div>
      <EquipmentFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(grouped).map(([status, items]) => (
              <Card key={status}><CardContent className="p-4">
                <EquipmentStatusBadge status={status} />
                <p className="text-2xl font-bold mt-2">{items.length}</p>
              </CardContent></Card>
            ))}
          </div>
          <Card><CardHeader><CardTitle>Status Register</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead>
                <TableHead>Calibration</TableHead><TableHead>PM</TableHead><TableHead>Usable</TableHead><TableHead></TableHead>
              </TableRow></TableHeader><TableBody>
                {equipment.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No equipment</TableCell></TableRow>
                  : equipment.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-sm">{e.equipment_id}</TableCell>
                      <TableCell>{e.equipment_name}</TableCell>
                      <TableCell><EquipmentStatusBadge status={e.equipment_status} /></TableCell>
                      <TableCell><EquipmentStatusBadge status={e.calibration_status} /></TableCell>
                      <TableCell><EquipmentStatusBadge status={e.pm_status} /></TableCell>
                      <TableCell>{isEquipmentUsable(e) ? 'Yes' : 'No'}</TableCell>
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
