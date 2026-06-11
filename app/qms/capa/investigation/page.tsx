'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CapaStatusBadge } from '@/components/capa/capa-sub-nav';
import { useCapas } from '@/hooks/use-capa';

export default function CapaInvestigationLinkPage() {
  const { records, loading } = useCapas();

  const linked = records.filter((r) => r.source_reference_number || r.deviation_id || r.oos_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Investigation Link</h1>
        <p className="text-muted-foreground text-sm">CAPA records linked to Deviation, OOS, CPV Risk, and other QMS sources</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Source-Linked CAPA</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? <LoadingSpinner /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CAPA #</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linked.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No linked CAPA records</TableCell></TableRow>
                ) : linked.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.capa_number}</TableCell>
                    <TableCell>{r.capa_source}</TableCell>
                    <TableCell>{r.source_reference_number}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
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
