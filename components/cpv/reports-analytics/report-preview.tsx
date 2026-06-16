'use client';

import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CpvReportMetrics } from '@/lib/cpv-reports-records';
import { HealthScoreBadge } from './health-score-badge';

export function ReportPreview({
  metrics,
  rows,
}: {
  metrics: CpvReportMetrics;
  rows: Record<string, unknown>[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-md border p-3"><p className="text-muted-foreground">Total Records</p><p className="text-xl font-bold">{metrics.totalRecords}</p></div>
        <div className="rounded-md border p-3"><p className="text-muted-foreground">CPV Compliance</p><p className="text-xl font-bold">{metrics.cpvCompliancePct}%</p></div>
        <div className="rounded-md border p-3"><p className="text-muted-foreground">Avg Cpk</p><p className="text-xl font-bold">{metrics.averageCpk.toFixed(2)}</p></div>
        <div className="rounded-md border p-3"><p className="text-muted-foreground">Health Score</p><div className="mt-1"><HealthScoreBadge score={metrics.healthScore} label={metrics.healthLabel} /></div></div>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {['Module', 'Product', 'Batch', 'Parameter', 'Status', 'Date'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r._module || '—')}</TableCell>
                  <TableCell>{String(r.productName || r.product_name || '—')}</TableCell>
                  <TableCell>{String(r.batchNo || r.batchNumber || '—')}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{String(r.parameterName || r.testParameter || r.parameter_name || '—')}</TableCell>
                  <TableCell>{String(r.status || r.riskLevel || '—')}</TableCell>
                  <TableCell>{String(r._date || '').slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No data for selected filters" message="Adjust product, batch, or date range and preview again." />
      )}
    </div>
  );
}
