'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WarehouseFiltersBar } from '@/components/warehouse-mgmt/warehouse-filters';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';
import { exportInventoryCsv } from '@/lib/warehouse-mgmt-service';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { WarehouseFilters } from '@/lib/warehouse-mgmt-types';

export default function InventoryPage() {
  const [filters, setFilters] = useState<WarehouseFilters>({});
  const { inventory, loading } = useWarehouse(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-sm">Real-time stock levels with expiry and retest status</p>
        </div>
        <Button variant="outline" onClick={() => exportInventoryCsv(inventory)}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
      </div>
      <WarehouseFiltersBar filters={filters} onChange={setFilters} />
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Stock Register ({inventory.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Material</TableHead><TableHead>Code</TableHead><TableHead>AR No</TableHead>
              <TableHead>Lot</TableHead><TableHead>Available</TableHead><TableHead>Reserved</TableHead>
              <TableHead>Consumed</TableHead><TableHead>Location</TableHead>
              <TableHead>Expiry</TableHead><TableHead>Retest</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader><TableBody>
              {inventory.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No inventory</TableCell></TableRow>
                : inventory.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.material_name}</TableCell><TableCell className="font-mono text-sm">{i.material_code}</TableCell>
                    <TableCell>{i.ar_number}</TableCell><TableCell>{i.lot_number}</TableCell>
                    <TableCell>{i.available_quantity} {i.unit}</TableCell><TableCell>{i.reserved_quantity}</TableCell>
                    <TableCell>{i.consumed_quantity}</TableCell><TableCell>{i.storage_location}</TableCell>
                    <TableCell><WarehouseStatusBadge status={i.expiry_status} /></TableCell>
                    <TableCell><WarehouseStatusBadge status={i.retest_status} /></TableCell>
                    <TableCell><WarehouseStatusBadge status={i.receipt_status} /></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
      )}
    </div>
  );
}
