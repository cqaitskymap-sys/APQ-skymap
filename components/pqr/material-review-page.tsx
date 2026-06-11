'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { listMaterialsForPqr } from '@/lib/warehouse-mgmt-service';

export function MaterialReviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listMaterialsForPqr>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMaterialsForPqr().then(setData).finally(() => setLoading(false));
  }, []);

  const receipts = data?.receipts || [];
  const inventory = data?.inventory || [];
  const dispensing = data?.dispensing || [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Material Review</h1>
        <p className="text-muted-foreground text-sm">Review material receipts, inventory, and dispensing for PQR</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Receipts', value: receipts.length },
              { label: 'Approved Lots', value: inventory.filter((i) => i.receipt_status === 'Approved').length },
              { label: 'Quarantine', value: receipts.filter((r) => r.status === 'Quarantine').length },
              { label: 'Dispensing Records', value: dispensing.length },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
            ))}
          </div>
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Material Receipts for PQR</CardTitle>
            <Link href="/qms/warehouse" className="text-sm text-blue-600">Open Warehouse Module →</Link>
          </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>GRN</TableHead><TableHead>Date</TableHead><TableHead>Material</TableHead>
                <TableHead>Type</TableHead><TableHead>Vendor</TableHead><TableHead>AR No</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader><TableBody>
                {receipts.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No material data</TableCell></TableRow>
                  : receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.grn_number}</TableCell>
                      <TableCell>{r.receipt_date}</TableCell><TableCell>{r.material_name}</TableCell>
                      <TableCell>{r.material_type}</TableCell><TableCell>{r.vendor_name}</TableCell>
                      <TableCell>{r.ar_number}</TableCell>
                      <TableCell><WarehouseStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody></Table>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>Approved Inventory Summary</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>Material</TableHead><TableHead>AR No</TableHead><TableHead>Available</TableHead>
                <TableHead>Consumed</TableHead><TableHead>Expiry</TableHead>
              </TableRow></TableHeader><TableBody>
                {inventory.filter((i) => i.receipt_status === 'Approved').slice(0, 20).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.material_name}</TableCell><TableCell>{i.ar_number}</TableCell>
                    <TableCell>{i.available_quantity} {i.unit}</TableCell><TableCell>{i.consumed_quantity}</TableCell>
                    <TableCell><WarehouseStatusBadge status={i.expiry_status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent></Card>
        </>
      )}
    </div>
  );
}
