'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Download, Filter, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/loaders/page-loader';

const mockOOS = [
  { id: '1', oos_number: 'OOS-2024-005', product: 'Amikacin 100mg', batch: 'BTH-2024-045', parameter: 'Assay', spec: '98-102%', result: '94.2%', status: 'under_investigation', created: '2024-01-23' },
  { id: '2', oos_number: 'OOS-2024-004', product: 'Meropenem 500mg', batch: 'BTH-2024-044', parameter: 'Water Content', spec: '<5%', result: '6.8%', status: 'invalidated', created: '2024-01-20' },
];

export default function OOSPage() {
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OOS Management</h1>
          <p className="text-muted-foreground">Out-of-Specification investigations</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Report OOS</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total OOS</p>
            <p className="text-3xl font-bold">24</p>
            <p className="text-xs text-amber-600 mt-2">YTD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Under Investigation</p>
            <p className="text-3xl font-bold">5</p>
            <p className="text-xs text-blue-600 mt-2">Avg 3.4 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Invalidated</p>
            <p className="text-3xl font-bold">17</p>
            <p className="text-xs text-green-600 mt-2">70.8%</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search OOS number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OOS Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockOOS.map((oos) => (
              <div key={oos.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-semibold text-sm">{oos.oos_number}</p>
                    <p className="text-sm text-muted-foreground">{oos.product}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{oos.status.replace('_', ' ')}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs mb-2">
                  <div>
                    <p className="text-muted-foreground">Test Parameter</p>
                    <p className="font-medium">{oos.parameter}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Specification</p>
                    <p className="font-medium">{oos.spec}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Obtained Result</p>
                    <p className="font-medium text-red-600">{oos.result}</p>
                  </div>
                  <div className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Eye className="h-3 w-3 mr-1" />View</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
