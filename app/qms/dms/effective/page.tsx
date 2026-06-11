'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DmsStatusBadge, DmsTypeBadge } from '@/components/dms/dms-sub-nav';
import { useDocuments } from '@/hooks/use-dms';

export default function EffectiveDocumentsPage() {
  const { records, loading, error } = useDocuments({ effectiveOnly: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Effective Documents</h1>
        <p className="text-muted-foreground text-sm">Currently effective controlled documents — latest versions only</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Effective Register ({records.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
            <TableHead>Department</TableHead><TableHead>Version</TableHead><TableHead>Effective Date</TableHead>
            <TableHead>Next Review</TableHead><TableHead></TableHead>
          </TableRow></TableHeader><TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No effective documents</TableCell></TableRow>
              : records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.document_number}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.document_title}</TableCell>
                  <TableCell><DmsTypeBadge type={r.document_type} /></TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.version}</TableCell>
                  <TableCell>{r.effective_date}</TableCell>
                  <TableCell>{r.next_review_date || '—'}</TableCell>
                  <TableCell><Link href={`/qms/dms/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
