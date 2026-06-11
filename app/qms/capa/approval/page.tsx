'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { useCapas } from '@/hooks/use-capa';

export default function CapaApprovalQueuePage() {
  const { records, loading } = useCapas();
  const filtered = records.filter((r) => ['qa_review', 'effectiveness_completed', 'submitted'].includes(r.capa_status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Workflow</h1>
        <p className="text-muted-foreground text-sm">CAPA pending QA or Head QA approval (critical CAPA requires Head QA)</p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0 pt-4">
          {loading ? <LoadingSpinner /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CAPA #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No CAPA pending approval</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.capa_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.capa_title}</TableCell>
                    <TableCell><CapaPriorityBadge priority={r.priority} /></TableCell>
                    <TableCell>{r.capa_source}</TableCell>
                    <TableCell><CapaStatusBadge status={r.capa_status} /></TableCell>
                    <TableCell>
                      <Link href={`/qms/capa/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link>
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
