'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecallPdfDocument } from '@/components/recall/recall-pdf-document';
import { listRecalls, getDistributions, getRecoveries, getAuditLogsForRecall } from '@/lib/recall-service';
import type { RecallRecord } from '@/lib/recall-types';
import { printPage } from '@/lib/export-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function RecallReportsPage() {
  const [records, setRecords] = useState<RecallRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{ record: RecallRecord; distributions: Awaited<ReturnType<typeof getDistributions>>; recoveries: Awaited<ReturnType<typeof getRecoveries>>; auditLogs: Awaited<ReturnType<typeof getAuditLogsForRecall>> } | null>(null);

  useEffect(() => { void listRecalls().then((d) => { setRecords(d); if (d[0]) setSelectedId(d[0].id); setLoading(false); }); }, []);
  useEffect(() => {
    if (!selectedId) return;
    const record = records.find((r) => r.id === selectedId);
    if (!record) return;
    void Promise.all([getDistributions(selectedId), getRecoveries(selectedId), getAuditLogsForRecall(selectedId)]).then(([distributions, recoveries, auditLogs]) => {
      setReportData({ record, distributions, recoveries, auditLogs });
    });
  }, [selectedId, records.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Recall Reports</h1><p className="text-muted-foreground text-sm">Generate recall or mock recall report</p></div>
        <Button variant="outline" className="gap-2 no-print" onClick={() => printPage()} disabled={!reportData}><Printer className="h-4 w-4" />Print / Save PDF</Button>
      </div>
      <Card className="no-print"><CardHeader><CardTitle>Select Recall</CardTitle></CardHeader><CardContent>
        {loading ? <LoadingSpinner /> : (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>{records.map((r) => <SelectItem key={r.id} value={r.id}>{r.recall_number} — {r.product_name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </CardContent></Card>
      {reportData && <div id="recall-pdf-document"><RecallPdfDocument record={reportData.record} distributions={reportData.distributions} recoveries={reportData.recoveries} auditLogs={reportData.auditLogs} /></div>}
    </div>
  );
}
