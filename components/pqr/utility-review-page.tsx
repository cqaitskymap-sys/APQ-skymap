'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MonitoringStatusBadge } from '@/components/monitoring-mgmt/monitoring-sub-nav';
import { listMonitoringForPqr } from '@/lib/monitoring-mgmt-service';

export function UtilityReviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listMonitoringForPqr>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMonitoringForPqr().then(setData).finally(() => setLoading(false));
  }, []);

  const utility = data?.utility || [];
  const environmental = data?.environmental || [];
  const excursions = data?.excursions || [];
  const openExcursions = excursions.filter((e) => e.status !== 'Closed');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Utility & Environmental Review</h1>
        <p className="text-muted-foreground text-sm">Review utility and environmental monitoring data for PQR</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Environmental Records', value: environmental.length },
              { label: 'Utility Records', value: utility.length },
              { label: 'Open Excursions', value: openExcursions.length },
              { label: 'Compliant Utility', value: utility.filter((u) => u.status === 'Complies').length },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
            ))}
          </div>
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Utility Monitoring for PQR</CardTitle>
            <Link href="/qms/monitoring" className="text-sm text-blue-600">Open Monitoring Module →</Link>
          </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>Record No</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead>
                <TableHead>Point</TableHead><TableHead>Parameter</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader><TableBody>
                {utility.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No utility data</TableCell></TableRow>
                  : utility.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.utility_record_no}</TableCell>
                      <TableCell>{u.monitoring_date}</TableCell><TableCell>{u.utility_type}</TableCell>
                      <TableCell>{u.sampling_point}</TableCell><TableCell>{u.parameter_name}</TableCell>
                      <TableCell>{u.observed_value} {u.unit}</TableCell>
                      <TableCell><MonitoringStatusBadge status={u.status} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody></Table>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>Environmental Monitoring Summary</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>No</TableHead><TableHead>Date</TableHead><TableHead>Area</TableHead>
                <TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader><TableBody>
                {environmental.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No environmental data</TableCell></TableRow>
                  : environmental.slice(0, 20).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-sm">{e.monitoring_number}</TableCell>
                      <TableCell>{e.monitoring_date}</TableCell>
                      <TableCell><Link href={`/qms/monitoring/${e.area_doc_id}`} className="text-blue-600">{e.area_name}</Link></TableCell>
                      <TableCell>{e.monitoring_type}</TableCell>
                      <TableCell>{e.observed_value} {e.unit}</TableCell>
                      <TableCell><MonitoringStatusBadge status={e.status} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody></Table>
            </CardContent></Card>
        </>
      )}
    </div>
  );
}
