'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Star } from 'lucide-react';

const mockVendors = [
  { id: '1', code: 'VND-001', name: 'ChemPure Supplies', type: 'raw_material', rating: 5, status: 'approved' },
  { id: '2', code: 'VND-002', name: 'PackTech International', type: 'packaging', rating: 4, status: 'approved' },
  { id: '3', code: 'VND-003', name: 'AdvAPI Corp', type: 'api', rating: 5, status: 'conditional' },
  { id: '4', code: 'VND-004', name: 'Calibration Services Ltd', type: 'service', rating: 4, status: 'approved' },
];

export default function VendorsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Management</h1>
          <p className="text-muted-foreground">Supplier qualification and audit tracking</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Vendors</p><p className="text-3xl font-bold">{mockVendors.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Approved</p><p className="text-3xl font-bold">{mockVendors.filter(v => v.status === 'approved').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Audits Due</p><p className="text-3xl font-bold">2</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Avg Quality Rating</p><p className="text-3xl font-bold">4.5</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {mockVendors.map(vendor => (
          <Card key={vendor.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm">{vendor.code}</p>
                  <h3 className="font-semibold">{vendor.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {[...Array(vendor.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Badge variant="outline">{vendor.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
