'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { useChangeControls } from '@/hooks/use-change-control';

export default function ImplementationQueuePage() {
  const { records, loading } = useChangeControls();
  const filtered = records.filter((r) =>
    ['approved_for_implementation', 'implementation_in_progress', 'overdue'].includes(r.status),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Implementation Plan</h1>
        <p className="text-muted-foreground text-sm">Approved changes pending or in implementation</p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0 pt-4">
          {loading ? <LoadingSpinner /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CC #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Planned Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records in this queue</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.change_control_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.change_title}</TableCell>
                    <TableCell>{r.planned_implementation_date || '—'}</TableCell>
                    <TableCell><CcStatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      <Link href={`/qms/change-control/${r.id}/implementation`}>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
