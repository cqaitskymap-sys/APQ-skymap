'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DmsStatusBadge, DmsTypeBadge } from '@/components/dms/dms-sub-nav';
import { useDocuments } from '@/hooks/use-dms';

export default function RevisionControlPage() {
  const { records, loading, error } = useDocuments({});
  const revisionDocs = records.filter((r) => r.revision_number > 1 || r.parent_document_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Revision Control</h1>
        <p className="text-muted-foreground text-sm">Track document revisions and version history</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Revised Documents</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Version</TableHead>
            <TableHead>Rev #</TableHead><TableHead>Supersedes</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader><TableBody>
            {revisionDocs.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No revised documents</TableCell></TableRow>
              : revisionDocs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.document_number}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.document_title}</TableCell>
                  <TableCell>{r.version}</TableCell>
                  <TableCell>{r.revision_number}</TableCell>
                  <TableCell>{r.supersedes_document_no || '—'}</TableCell>
                  <TableCell><DmsStatusBadge status={r.status} /></TableCell>
                  <TableCell><Link href={`/qms/dms/${r.id}/revision`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
