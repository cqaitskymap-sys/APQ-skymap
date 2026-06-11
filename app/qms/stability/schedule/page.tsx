'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StudyStatusBadge } from '@/components/stability/stability-sub-nav';
import { useStabilityStudies } from '@/hooks/use-stability';

export default function StabilitySchedulePage() {
  const { records, loading } = useStabilityStudies();
  const filtered = records.filter((r) => !['draft', 'cancelled', 'closed'].includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stability Schedule</h1>
        <p className="text-muted-foreground text-sm">Active studies with testing schedules</p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0 pt-4">
          {loading ? <LoadingSpinner /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Study #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No active schedules</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.stability_study_number}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell>{r.batch_number}</TableCell>
                    <TableCell className="text-xs">{r.study_type}</TableCell>
                    <TableCell><StudyStatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      <Link href={`/qms/stability/${r.id}/schedule`}>
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
