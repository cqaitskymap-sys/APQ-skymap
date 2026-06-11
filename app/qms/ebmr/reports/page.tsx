'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EbmrFullPdfDocument } from '@/components/ebmr-mgmt/ebmr-pdf-document';
import { listEbmr, getEbmrFullData } from '@/lib/ebmr-mgmt-service';
import type { EbmrRecord } from '@/lib/ebmr-mgmt-types';
import { printPage } from '@/lib/export-utils';

export default function EbmrReportsPage() {
  const [records, setRecords] = useState<EbmrRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [reportData, setReportData] = useState<Awaited<ReturnType<typeof getEbmrFullData>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listEbmr().then((r) => { setRecords(r); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedId) { setReportData(null); return; }
    getEbmrFullData(selectedId).then(setReportData);
  }, [selectedId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">eBMR Reports</h1>
          <p className="text-muted-foreground text-sm">Complete eBMR, line clearance, dispensing, manufacturing, CPP, IPC, and release reports</p>
        </div>
        {reportData?.record && <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print Report</Button>}
      </div>
      <Card><CardHeader><CardTitle>Select Batch Record</CardTitle></CardHeader>
        <CardContent>
          <select className="w-full max-w-md border rounded-md px-3 py-2 text-sm" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">— Select eBMR —</option>
            {records.map((r) => <option key={r.id} value={r.id}>{r.ebmr_number} — {r.product_name} ({r.batch_number})</option>)}
          </select>
        </CardContent></Card>
      {reportData?.record && (
        <div className="border rounded-lg overflow-hidden">
          <EbmrFullPdfDocument record={reportData.record} lineClearance={reportData.lineClearance}
            dispensing={reportData.dispensing} steps={reportData.steps} equipment={reportData.equipment}
            cpp={reportData.cpp} ipc={reportData.ipc} reviews={reportData.reviews} releases={reportData.releases} />
        </div>
      )}
    </div>
  );
}
