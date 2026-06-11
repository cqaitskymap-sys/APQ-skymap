'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CcPdfDocument } from '@/components/change-control/cc-pdf-document';
import {
  listChanges, getImpactAssessment, getRiskAssessment, getImplementationActions,
  getEffectivenessReview, getApprovals, getAuditLogsForChange,
} from '@/lib/change-control-service';
import type { ChangeControlRecord } from '@/lib/change-control-types';
import { printPage } from '@/lib/export-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function ChangeControlReportsPage() {
  const [records, setRecords] = useState<ChangeControlRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    record: ChangeControlRecord;
    impact: Awaited<ReturnType<typeof getImpactAssessment>>;
    risk: Awaited<ReturnType<typeof getRiskAssessment>>;
    actions: Awaited<ReturnType<typeof getImplementationActions>>;
    effectiveness: Awaited<ReturnType<typeof getEffectivenessReview>>;
    approvals: Awaited<ReturnType<typeof getApprovals>>;
    auditLogs: Awaited<ReturnType<typeof getAuditLogsForChange>>;
  } | null>(null);

  useEffect(() => {
    void listChanges().then((data) => {
      setRecords(data);
      if (data[0]) setSelectedId(data[0].id);
      setLoading(false);
    });
  }, []);

  const loadReport = async (id: string) => {
    if (!id) return;
    setReportLoading(true);
    const record = records.find((r) => r.id === id);
    if (!record) { setReportLoading(false); return; }
    const [impact, risk, actions, effectiveness, approvals, auditLogs] = await Promise.all([
      getImpactAssessment(id),
      getRiskAssessment(id),
      getImplementationActions(id),
      getEffectivenessReview(id),
      getApprovals(id),
      getAuditLogsForChange(id),
    ]);
    setReportData({ record, impact, risk, actions, effectiveness, approvals, auditLogs });
    setReportLoading(false);
  };

  useEffect(() => { if (selectedId) void loadReport(selectedId); }, [selectedId, records.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Change Control Reports</h1>
          <p className="text-muted-foreground text-sm">Generate GMP-compliant change control report for print / PDF save</p>
        </div>
        <Button variant="outline" className="gap-2 no-print" onClick={() => printPage()} disabled={!reportData}>
          <Printer className="h-4 w-4" />Print / Save PDF
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader><CardTitle>Select Change Control</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingSpinner /> : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Select change control" /></SelectTrigger>
              <SelectContent>
                {records.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.change_control_number} — {r.change_title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {reportLoading ? <LoadingSpinner label="Building report..." /> : reportData && (
        <div id="cc-pdf-document">
          <CcPdfDocument
            record={reportData.record}
            impact={reportData.impact}
            risk={reportData.risk}
            actions={reportData.actions}
            effectiveness={reportData.effectiveness}
            approvals={reportData.approvals}
            auditLogs={reportData.auditLogs}
          />
        </div>
      )}
    </div>
  );
}
