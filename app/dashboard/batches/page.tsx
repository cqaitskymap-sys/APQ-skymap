'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Download, Filter } from 'lucide-react';
import { PageLoader } from '@/components/loaders/page-loader';

export default function BatchesPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Batch Management</h1>
          <p className="text-muted-foreground">Manufacturing batch records and release documentation</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />New Batch</Button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search batch number, product..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Batches</CardTitle>
          <CardDescription>0 batches this year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Batch Number</TableHead>
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold">Mfg Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Yield</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No batches found.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
