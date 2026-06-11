'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';

export default function QuarantinePage() {
  const { receipts, inventory, loading } = useWarehouse();

  const quarantine = receipts.filter((r) => ['Quarantine', 'Under Sampling', 'Under Test', 'Blocked'].includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quarantine</h1>
        <p className="text-muted-foreground text-sm">Materials held in quarantine pending QC sampling and release</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Quarantine', 'Under Sampling', 'Under Test', 'Blocked'].map((status) => (
              <Card key={status}><CardContent className="p-4">
                <WarehouseStatusBadge status={status} />
                <p className="text-2xl font-bold mt-2">{receipts.filter((r) => r.status === status).length}</p>
              </CardContent></Card>
            ))}
          </div>
          <Card><CardHeader><CardTitle>Quarantine Register ({quarantine.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>GRN</TableHead><TableHead>Material</TableHead><TableHead>AR No</TableHead>
                <TableHead>Vendor</TableHead><TableHead>Qty</TableHead><TableHead>QC</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader><TableBody>
                {quarantine.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quarantine stock</TableCell></TableRow>
                  : quarantine.map((r) => {
                    const inv = inventory.find((i) => i.ar_number === r.ar_number);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.grn_number}</TableCell>
                        <TableCell>{r.material_name}</TableCell><TableCell>{r.ar_number}</TableCell>
                        <TableCell>{r.vendor_name}</TableCell>
                        <TableCell>{inv?.reserved_quantity ?? r.received_quantity} {r.unit}</TableCell>
                        <TableCell><WarehouseStatusBadge status={r.qc_status} /></TableCell>
                        <TableCell><WarehouseStatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody></Table>
            </CardContent></Card>
        </>
      )}
    </div>
  );
}
