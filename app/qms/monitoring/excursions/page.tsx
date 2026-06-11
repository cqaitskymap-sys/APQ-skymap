'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MonitoringStatusBadge } from '@/components/monitoring-mgmt/monitoring-sub-nav';
import { useMonitoring, useMonitoringActor } from '@/hooks/use-monitoring-mgmt';
import { closeExcursion, exportExcursionsCsv } from '@/lib/monitoring-mgmt-service';
import { canReviewExcursions } from '@/lib/monitoring-mgmt-types';

export default function ExcursionsPage() {
  const { excursions, loading, error, refresh } = useMonitoring();
  const actor = useMonitoringActor();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  const filtered = excursions.filter((e) => {
    if (filter === 'open') return e.status === 'Open' || e.status === 'Under Review';
    if (filter === 'closed') return e.status === 'Closed';
    return true;
  });

  const handleClose = async (id: string) => {
    const remarks = prompt('Closing remarks:');
    if (!remarks) return;
    try {
      await closeExcursion(id, remarks, actor);
      toast.success('Excursion closed');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to close');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alert & Excursion</h1>
          <p className="text-muted-foreground text-sm">Review out-of-limit events, deviations, and CAPA recommendations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportExcursionsCsv(excursions)}>Export CSV</Button>
          <div className="flex gap-1">
            {(['all', 'open', 'closed'] as const).map((f) => (
              <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Excursions ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Area</TableHead>
              <TableHead>Parameter</TableHead><TableHead>Value</TableHead><TableHead>Critical</TableHead>
              <TableHead>Repeated</TableHead><TableHead>Deviation</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No excursions</TableCell></TableRow>
                : filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">{e.excursion_number}</TableCell>
                    <TableCell>{e.excursion_date}</TableCell><TableCell>{e.area_name}</TableCell>
                    <TableCell>{e.parameter_name}</TableCell>
                    <TableCell>{e.observed_value} {e.unit}</TableCell>
                    <TableCell>{e.is_critical_area ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{e.is_repeated ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{e.linked_deviation_number ? <Link href="/qms/deviation" className="text-blue-600 text-sm">{e.linked_deviation_number}</Link> : '—'}</TableCell>
                    <TableCell><MonitoringStatusBadge status={e.status} /></TableCell>
                    <TableCell>
                      {canReviewExcursions(actor.role) && e.status !== 'Closed' && (
                        <Button variant="outline" size="sm" onClick={() => handleClose(e.id)}>Close</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
      )}
    </div>
  );
}
