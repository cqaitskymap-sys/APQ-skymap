'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EquipmentStatusBadge } from '@/components/equipment-mgmt/equipment-sub-nav';
import { listEquipmentForPqr } from '@/lib/equipment-mgmt-service';
import type { EquipmentRecord } from '@/lib/equipment-mgmt-types';
import { isEquipmentUsable } from '@/lib/equipment-mgmt-types';

export function EquipmentReviewPage() {
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listEquipmentForPqr().then(setEquipment).finally(() => setLoading(false));
  }, []);

  const blocked = equipment.filter((e) => !isEquipmentUsable(e));
  const calOverdue = equipment.filter((e) => e.calibration_status === 'Overdue');
  const pmOverdue = equipment.filter((e) => e.pm_status === 'Overdue');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipment Review</h1>
        <p className="text-muted-foreground text-sm">Review equipment qualification, calibration, and maintenance records for PQR</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Equipment', value: equipment.length },
              { label: 'Blocked / Unusable', value: blocked.length },
              { label: 'Cal Overdue', value: calOverdue.length },
              { label: 'PM Overdue', value: pmOverdue.length },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
            ))}
          </div>
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Equipment Status for PQR</CardTitle>
            <Link href="/qms/equipment" className="text-sm text-blue-600">Open Equipment Module →</Link>
          </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead>
                <TableHead>Status</TableHead><TableHead>Calibration</TableHead><TableHead>PM</TableHead><TableHead>Usable</TableHead>
              </TableRow></TableHeader><TableBody>
                {equipment.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No equipment data</TableCell></TableRow>
                  : equipment.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-sm"><Link href={`/qms/equipment/${e.id}`} className="text-blue-600">{e.equipment_id}</Link></TableCell>
                      <TableCell>{e.equipment_name}</TableCell><TableCell>{e.department}</TableCell>
                      <TableCell><EquipmentStatusBadge status={e.equipment_status} /></TableCell>
                      <TableCell><EquipmentStatusBadge status={e.calibration_status} /></TableCell>
                      <TableCell><EquipmentStatusBadge status={e.pm_status} /></TableCell>
                      <TableCell>{isEquipmentUsable(e) ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody></Table>
            </CardContent></Card>
        </>
      )}
    </div>
  );
}
