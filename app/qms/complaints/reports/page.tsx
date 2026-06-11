'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComplaintPdfDocument } from '@/components/complaints/complaint-pdf-document';
import { listComplaints, getInvestigation, getAuditLogsForComplaint } from '@/lib/complaint-service';
import type { ComplaintRecord } from '@/lib/complaint-types';
import { printPage } from '@/lib/export-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function ComplaintReportsPage() {
  const [records, setRecords] = useState<ComplaintRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{ record: ComplaintRecord; investigation: Awaited<ReturnType<typeof getInvestigation>>; auditLogs: Awaited<ReturnType<typeof getAuditLogsForComplaint>> } | null>(null);

  useEffect(() => { void listComplaints().then((d) => { setRecords(d); if (d[0]) setSelectedId(d[0].id); setLoading(false); }); }, []);
  useEffect(() => {
    if (!selectedId) return;
    const record = records.find((r) => r.id === selectedId);
    if (!record) return;
    void Promise.all([getInvestigation(selectedId), getAuditLogsForComplaint(selectedId)]).then(([investigation, auditLogs]) => {
      setReportData({ record, investigation, auditLogs });
    });
  }, [selectedId, records.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Complaint Reports</h1><p className="text-muted-foreground text-sm">Generate complaint investigation report</p></div>
        <Button variant="outline" className="gap-2 no-print" onClick={() => printPage()} disabled={!reportData}><Printer className="h-4 w-4" />Print / Save PDF</Button>
      </div>
      <Card className="no-print"><CardHeader><CardTitle>Select Complaint</CardTitle></CardHeader><CardContent>
        {loading ? <LoadingSpinner /> : (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>{records.map((r) => <SelectItem key={r.id} value={r.id}>{r.complaint_number} — {r.product_name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </CardContent></Card>
      {reportData && <div id="complaint-pdf-document"><ComplaintPdfDocument record={reportData.record} investigation={reportData.investigation} auditLogs={reportData.auditLogs} /></div>}
    </div>
  );
}
