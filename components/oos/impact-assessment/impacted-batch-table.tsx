'use client';

import { parseImpactedBatches } from '@/lib/oos-impact-records';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ImpactedBatchTableProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function ImpactedBatchTable({ value, onChange, disabled }: ImpactedBatchTableProps) {
  const batches = parseImpactedBatches(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Other Batch Impact</CardTitle>
        <CardDescription>Enter impacted batch numbers separated by commas or new lines</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={3}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="BATCH-001, BATCH-002..."
          className="font-mono text-sm"
        />
        {batches.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Batch Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch, i) => (
                  <TableRow key={`${batch}-${i}`}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-mono">{batch}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
