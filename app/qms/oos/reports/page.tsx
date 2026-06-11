'use client';

import { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OosPdfDocument } from '@/components/oos/oos-pdf-document';
import { useOosRecords } from '@/hooks/use-oos';
import { getPhase1, getPhase2, getImpactAssessment, getCapaLink, getApprovals, getAuditLogsForOos, exportOosCsv } from '@/lib/oos-service';
import { printPage } from '@/lib/export-utils';

export default function OosReportsPage() {
  const { records, loading } = useOosRecords();
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState<Awaited<ReturnType<typeof loadReport>> | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  async function loadReport(id: string) {
    setSelectedId(id);
    setLoadingReport(true);
    try {
      const record = records.find((r) => r.id === id);
      if (!record) return null;
      const [phase1, phase2, impact, capa, approvals, auditLogs] = await Promise.all([
        getPhase1(id), getPhase2(id), getImpactAssessment(id), getCapaLink(id), getApprovals(id), getAuditLogsForOos(id),
      ]);
      const data = { record, phase1, phase2, impact, capa, approvals, auditLogs };
      setReport(data);
      return data;
    } finally { setLoadingReport(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-bold">OOS Reports</h1><p className="text-muted-foreground text-sm">Generate official OOS investigation PDF reports</p></div>
        <Button variant="outline" className="gap-2" onClick={() => exportOosCsv(records)}><Download className="h-4 w-4" />Export All</Button>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Select OOS for PDF</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          {loading ? <LoadingSpinner /> : (
            <>
              <Select value={selectedId} onValueChange={loadReport}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose OOS..." /></SelectTrigger>
                <SelectContent>{records.map((r) => <SelectItem key={r.id} value={r.id}>{r.oos_number} — {r.test_name}</SelectItem>)}</SelectContent>
              </Select>
              {report && <Button variant="outline" className="gap-2" onClick={() => printPage()}><Printer className="h-4 w-4" />Print PDF</Button>}
            </>
          )}
        </CardContent>
      </Card>
      {loadingReport && <LoadingSpinner />}
      {report && !loadingReport && (
        <OosPdfDocument record={report.record} phase1={report.phase1} phase2={report.phase2} impact={report.impact} capa={report.capa} approvals={report.approvals} auditLogs={report.auditLogs} />
      )}
    </div>
  );
}
