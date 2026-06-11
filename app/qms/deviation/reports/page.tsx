'use client';

import { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DeviationPdfDocument } from '@/components/deviations/deviation-pdf-document';
import { useDeviations } from '@/hooks/use-deviations';
import {
  getInvestigation, getImpactAssessment, getApprovals, getAuditLogsForDeviation,
  exportDeviationsCsv,
} from '@/lib/deviation-service';
import { printPage } from '@/lib/export-utils';
import type { DeviationRecord } from '@/lib/deviation-types';

export default function DeviationReportsPage() {
  const { records, loading } = useDeviations();
  const [selectedId, setSelectedId] = useState<string>('');
  const [reportData, setReportData] = useState<{
    record: DeviationRecord;
    investigation: Awaited<ReturnType<typeof getInvestigation>>;
    impact: Awaited<ReturnType<typeof getImpactAssessment>>;
    approvals: Awaited<ReturnType<typeof getApprovals>>;
    auditLogs: Record<string, unknown>[];
  } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadReport = async (id: string) => {
    setSelectedId(id);
    setLoadingReport(true);
    try {
      const record = records.find((r) => r.id === id);
      if (!record) return;
      const [investigation, impact, approvals, auditLogs] = await Promise.all([
        getInvestigation(id), getImpactAssessment(id), getApprovals(id), getAuditLogsForDeviation(id),
      ]);
      setReportData({ record, investigation, impact, approvals, auditLogs });
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Deviation Reports</h1>
          <p className="text-muted-foreground text-sm">Generate official deviation investigation PDF reports</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportDeviationsCsv(records)}>
          <Download className="h-4 w-4" />Export All (CSV)
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Select Deviation for PDF Report</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          {loading ? <LoadingSpinner /> : (
            <>
              <Select value={selectedId} onValueChange={loadReport}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose deviation..." /></SelectTrigger>
                <SelectContent>
                  {records.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.deviation_number} — {r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reportData && (
                <Button variant="outline" className="gap-2" onClick={() => printPage()}>
                  <Printer className="h-4 w-4" />Print / Save PDF
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {loadingReport && <LoadingSpinner />}
      {reportData && !loadingReport && (
        <DeviationPdfDocument
          record={reportData.record}
          investigation={reportData.investigation}
          impact={reportData.impact}
          approvals={reportData.approvals}
          auditLogs={reportData.auditLogs}
        />
      )}
    </div>
  );
}
