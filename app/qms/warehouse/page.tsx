'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Boxes, ShieldAlert, CheckCircle, XCircle, Clock, Beaker, Package, Download, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WarehouseDashboardCharts } from '@/components/warehouse-mgmt/warehouse-dashboard-charts';
import { WarehouseFiltersBar } from '@/components/warehouse-mgmt/warehouse-filters';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';
import { exportReceiptsCsv } from '@/lib/warehouse-mgmt-service';
import type { WarehouseFilters } from '@/lib/warehouse-mgmt-types';
import { cn } from '@/lib/utils';

export default function WarehouseDashboardPage() {
  const [filters, setFilters] = useState<WarehouseFilters>({});
  const { receipts, inventory, dispensing, finishedGoods, metrics, loading, error } = useWarehouse(filters);

  const kpiCards = metrics ? [
    { label: 'Total Materials', value: metrics.totalMaterials, icon: Boxes, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Quarantine Stock', value: metrics.quarantineStock, icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Approved Stock', value: metrics.approvedStock, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected Stock', value: metrics.rejectedStock, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Expired Stock', value: metrics.expiredStock, icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Retest Due', value: metrics.retestDue, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Dispensed Today', value: metrics.dispensedToday, icon: Beaker, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'FG Stock', value: metrics.finishedGoodsStock, icon: Package, color: 'text-green-600', bg: 'bg-green-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Warehouse Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP material receipt, quarantine, release, dispensing, and full batch traceability</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportReceiptsCsv(receipts)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/warehouse/receipt"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />New Receipt</Button></Link>
        </div>
      </div>
      <WarehouseFiltersBar filters={filters} onChange={setFilters} />
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
          <WarehouseDashboardCharts inventory={inventory} receipts={receipts} dispensing={dispensing} />
          <Card><CardHeader><CardTitle>Recent Receipts</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>GRN</TableHead><TableHead>Date</TableHead><TableHead>Material</TableHead>
              <TableHead>Vendor</TableHead><TableHead>AR No</TableHead><TableHead>Qty</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader><TableBody>
              {receipts.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No receipts</TableCell></TableRow>
                : receipts.slice(0, 15).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.grn_number}</TableCell>
                    <TableCell>{r.receipt_date}</TableCell><TableCell>{r.material_name}</TableCell>
                    <TableCell>{r.vendor_name}</TableCell><TableCell>{r.ar_number}</TableCell>
                    <TableCell>{r.received_quantity} {r.unit}</TableCell>
                    <TableCell><WarehouseStatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
