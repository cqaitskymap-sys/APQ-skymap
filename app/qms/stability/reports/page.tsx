'use client';

import { useCallback, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StabilityPdfDocument } from '@/components/stability/stability-pdf-document';
import {
  listStudies, getSchedules, getSamplePulls, getResults, getApprovals, getAuditLogsForStudy,
} from '@/lib/stability-service';
import type { StabilityStudy } from '@/lib/stability-types';
import { printPage } from '@/lib/export-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function StabilityReportsPage() {
  const [records, setRecords] = useState<StabilityStudy[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    record: StabilityStudy;
    schedules: Awaited<ReturnType<typeof getSchedules>>;
    pulls: Awaited<ReturnType<typeof getSamplePulls>>;
    results: Awaited<ReturnType<typeof getResults>>;
    approvals: Awaited<ReturnType<typeof getApprovals>>;
    auditLogs: Awaited<ReturnType<typeof getAuditLogsForStudy>>;
  } | null>(null);

  useEffect(() => {
    void listStudies().then((data) => {
      setRecords(data);
      if (data[0]) setSelectedId(data[0].id);
      setLoading(false);
    });
  }, []);

  const loadReport = useCallback(async (id: string) => {
    if (!id) return;
    setReportLoading(true);
    const record = records.find((r) => r.id === id);
    if (!record) { setReportLoading(false); return; }
    const [schedules, pulls, results, approvals, auditLogs] = await Promise.all([
      getSchedules(id), getSamplePulls(id), getResults(id), getApprovals(id), getAuditLogsForStudy(id),
    ]);
    setReportData({ record, schedules, pulls, results, approvals, auditLogs });
    setReportLoading(false);
  }, [records]);

  useEffect(() => { if (selectedId) void loadReport(selectedId); }, [selectedId, loadReport]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Stability Reports</h1>
          <p className="text-muted-foreground text-sm">Generate GMP-compliant stability report for print / PDF save</p>
        </div>
        <Button variant="outline" className="gap-2 no-print" onClick={() => printPage()} disabled={!reportData}>
          <Printer className="h-4 w-4" />Print / Save PDF
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader><CardTitle>Select Study</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingSpinner /> : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Select study" /></SelectTrigger>
              <SelectContent>
                {records.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.stability_study_number} — {r.product_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {reportLoading ? <LoadingSpinner label="Building report..." /> : reportData && (
        <div id="stability-pdf-document">
          <StabilityPdfDocument
            record={reportData.record}
            schedules={reportData.schedules}
            pulls={reportData.pulls}
            results={reportData.results}
            approvals={reportData.approvals}
            auditLogs={reportData.auditLogs}
          />
        </div>
      )}
    </div>
  );
}
