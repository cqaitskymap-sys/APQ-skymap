'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ResultStatusBadge } from '@/components/stability/stability-sub-nav';
import { useStabilityStudies } from '@/hooks/use-stability';

export default function StabilityResultsPage() {
  const { results, loading } = useStabilityStudies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stability Results</h1>
        <p className="text-muted-foreground text-sm">All stability test results across active studies</p>
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
                  <TableHead>Parameter</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No results recorded</TableCell></TableRow>
                ) : results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.study_number}</TableCell>
                    <TableCell>{r.batch_number}</TableCell>
                    <TableCell>{r.interval}</TableCell>
                    <TableCell>{r.parameter_name}</TableCell>
                    <TableCell>{r.observed_result} {r.unit}</TableCell>
                    <TableCell><ResultStatusBadge status={r.result_status} /></TableCell>
                    <TableCell>
                      <Link href={`/qms/stability/${r.study_id}/results`}>
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
