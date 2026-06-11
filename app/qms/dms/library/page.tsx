'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DmsFiltersBar } from '@/components/dms/dms-filters';
import { DmsStatusBadge, DmsTypeBadge } from '@/components/dms/dms-sub-nav';
import { useDocuments } from '@/hooks/use-dms';
import { exportDocumentsCsv } from '@/lib/dms-service';
import type { DmsFilters } from '@/lib/dms-types';

export default function DocumentLibraryPage() {
  const [filters, setFilters] = useState<DmsFilters>({});
  const { records, loading, error } = useDocuments(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Document Library</h1>
          <p className="text-muted-foreground text-sm">Browse and search all controlled documents</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportDocumentsCsv(records)}><Download className="h-4 w-4" />Export</Button>
      </div>
      <DmsFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Document Number</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
            <TableHead>Department</TableHead><TableHead>Product</TableHead><TableHead>Version</TableHead>
            <TableHead>Effective Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader><TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No documents found</TableCell></TableRow>
              : records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.document_number}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.document_title}</TableCell>
                  <TableCell><DmsTypeBadge type={r.document_type} /></TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.product_name || '—'}</TableCell>
                  <TableCell>{r.version}</TableCell>
                  <TableCell>{r.effective_date || '—'}</TableCell>
                  <TableCell><DmsStatusBadge status={r.status} /></TableCell>
                  <TableCell><Link href={`/qms/dms/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
