'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WarehouseDashboardCharts } from '@/components/warehouse-mgmt/warehouse-dashboard-charts';
import { WarehousePdfDocument } from '@/components/warehouse-mgmt/warehouse-pdf-document';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';
import { exportReceiptsCsv, exportInventoryCsv, exportDispensingCsv } from '@/lib/warehouse-mgmt-service';
import { printPage } from '@/lib/export-utils';

const REPORTS = [
  'GRN Report', 'Material Receipt Register', 'Sampling Register', 'Material Release Report',
  'Dispensing Sheet', 'Inventory Report', 'Traceability Report', 'Finished Goods Stock Report',
];

export default function WarehouseReportsPage() {
  const { receipts, inventory, dispensing, finishedGoods, metrics, loading } = useWarehouse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Warehouse Reports</h1>
          <p className="text-muted-foreground text-sm">GMP registers, inventory analytics, and PDF exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportReceiptsCsv(receipts)}><Download className="h-4 w-4 mr-1" />Receipts CSV</Button>
          <Button variant="outline" onClick={() => exportInventoryCsv(inventory)}><Download className="h-4 w-4 mr-1" />Inventory CSV</Button>
          <Button variant="outline" onClick={() => exportDispensingCsv(dispensing)}><Download className="h-4 w-4 mr-1" />Dispensing CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print PDF</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({
                'Total Materials': metrics.totalMaterials, 'Approved Stock': metrics.approvedStock,
                'Quarantine': metrics.quarantineStock, 'FG Stock': metrics.finishedGoodsStock,
              }).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
              ))}
            </div>
          )}
          <WarehouseDashboardCharts inventory={inventory} receipts={receipts} dispensing={dispensing} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map((title) => (
              <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground"><p>Export CSV or print PDF for GMP documentation.</p></CardContent></Card>
            ))}
          </div>
          <div className="hidden print:block">
            <WarehousePdfDocument receipts={receipts} inventory={inventory} dispensing={dispensing} finishedGoods={finishedGoods} />
          </div>
        </>
      )}
    </div>
  );
}
