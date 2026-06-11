'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PullStatusBadge } from '@/components/stability/stability-sub-nav';
import { useStabilityStudies } from '@/hooks/use-stability';

export default function SamplePullingPage() {
  const { pulls, loading } = useStabilityStudies();
  const pending = pulls.filter((p) => ['Pending', 'Missed'].includes(p.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sample Pulling</h1>
        <p className="text-muted-foreground text-sm">Pending and missed stability sample pulls</p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0 pt-4">
          {loading ? <LoadingSpinner /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Study #</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending sample pulls</TableCell></TableRow>
                ) : pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.study_number}</TableCell>
                    <TableCell>{p.batch_number}</TableCell>
                    <TableCell>{p.interval}</TableCell>
                    <TableCell>{p.pulling_due_date}</TableCell>
                    <TableCell><PullStatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <Link href={`/qms/stability/${p.study_id}/sample-pulling`}>
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
