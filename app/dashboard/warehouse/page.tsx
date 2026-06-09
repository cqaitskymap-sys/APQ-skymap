'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Boxes, Package } from 'lucide-react';

const mockWarehouse = [
  { id: '1', batch: 'BTH-2024-045', product: 'Amikacin 100mg', quantity: 5000, location: 'Shelf A1-2', storage: 'Cold (2-8°C)', expiry: '2026-01-01' },
  { id: '2', batch: 'BTH-2024-044', product: 'Meropenem 500mg', quantity: 3200, location: 'Shelf B2-4', storage: 'RT (25°C)', expiry: '2026-06-15' },
  { id: '3', batch: 'BTH-2024-043', product: 'Vancomycin 500mg', quantity: 2100, location: 'Shelf C1-1', storage: 'Cold (2-8°C)', expiry: '2026-02-28' },
];

export default function WarehousePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Traceability</h1>
          <p className="text-muted-foreground">Inventory tracking and product traceability</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />New Receipt</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Batches</p><p className="text-3xl font-bold">{mockWarehouse.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Units</p><p className="text-3xl font-bold">{mockWarehouse.reduce((sum, w) => sum + w.quantity, 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Storage Zones</p><p className="text-3xl font-bold">3</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Expiry Alert</p><p className="text-3xl font-bold">0</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {mockWarehouse.map(item => (
          <Card key={item.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono font-semibold text-sm">{item.batch}</p>
                  <h3 className="font-semibold">{item.product}</h3>
                </div>
                <Badge variant="outline">{item.storage}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 pt-3 border-t text-sm">
                <div className="flex items-center gap-1"><Boxes className="h-4 w-4" />{item.quantity} units</div>
                <div className="flex items-center gap-1"><Package className="h-4 w-4" />{item.location}</div>
                <div>Expiry: {new Date(item.expiry).toLocaleDateString()}</div>
                <div><Button variant="outline" size="sm" className="ml-auto">Trace</Button></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
