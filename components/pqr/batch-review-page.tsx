'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EbmrStatusBadge } from '@/components/ebmr-mgmt/ebmr-sub-nav';
import { listEbmrForPqr, listAllCppRecords, listAllIpcChecks } from '@/lib/ebmr-mgmt-service';
import type { EbmrRecord } from '@/lib/ebmr-mgmt-types';

export function BatchReviewPage() {
  const [records, setRecords] = useState<EbmrRecord[]>([]);
  const [cppOot, setCppOot] = useState(0);
  const [ipcFail, setIpcFail] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listEbmrForPqr(), listAllCppRecords(), listAllIpcChecks()]).then(([ebmr, cpp, ipc]) => {
      setRecords(ebmr);
      setCppOot(cpp.filter((c) => c.status === 'OOT').length);
      setIpcFail(ipc.filter((i) => i.status === 'Failed').length);
    }).finally(() => setLoading(false));
  }, []);

  const released = records.filter((r) => r.batch_status === 'Released').length;
  const rejected = records.filter((r) => r.batch_status === 'Rejected').length;
  const inProgress = records.filter((r) => !['Released', 'Rejected', 'Cancelled', 'Draft'].includes(r.batch_status)).length;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Batch Review</h1>
        <p className="text-muted-foreground text-sm">Manufacturing batch data auto-pulled from eBMR module for PQR and CPV</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Batches', value: records.length },
              { label: 'Released', value: released },
              { label: 'In Progress', value: inProgress },
              { label: 'Rejected', value: rejected },
              { label: 'CPP OOT / IPC Fail', value: `${cppOot} / ${ipcFail}` },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></CardContent></Card>
            ))}
          </div>
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>eBMR Batch Records</CardTitle>
            <div className="flex gap-3 text-sm">
              <Link href="/qms/ebmr" className="text-blue-600">Open eBMR Module →</Link>
              <Link href="/cpv/cpp" className="text-blue-600">CPV CPP Monitoring →</Link>
            </div>
          </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table><TableHeader><TableRow>
                <TableHead>eBMR No</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead>
                <TableHead>MFG</TableHead><TableHead>EXP</TableHead><TableHead>Status</TableHead><TableHead>Deviations</TableHead>
              </TableRow></TableHeader><TableBody>
                {records.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No eBMR batch data</TableCell></TableRow>
                  : records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Link href={`/qms/ebmr/${r.id}`} className="font-mono text-sm text-blue-600 hover:underline">{r.ebmr_number}</Link></TableCell>
                      <TableCell>{r.product_name}</TableCell><TableCell>{r.batch_number}</TableCell>
                      <TableCell>{r.mfg_date}</TableCell><TableCell>{r.exp_date}</TableCell>
                      <TableCell><EbmrStatusBadge status={r.batch_status} /></TableCell>
                      <TableCell>{r.linked_deviation_ids.length + r.linked_oos_ids.length}</TableCell>
                    </TableRow>
                  ))}
              </TableBody></Table>
            </CardContent></Card>
        </>
      )}
    </div>
  );
}
