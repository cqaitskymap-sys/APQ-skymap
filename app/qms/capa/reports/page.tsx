'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CapaPdfDocument } from '@/components/capa/capa-pdf-document';
import {
  listCapas, getCapaActions, getCapaEffectiveness, getCapaApprovals,
  getCapaSourceLinks, getAuditLogsForCapa,
} from '@/lib/capa-service';
import type { CapaRecord } from '@/lib/capa-types';
import { printPage } from '@/lib/export-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function CapaReportsPage() {
  const [records, setRecords] = useState<CapaRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    record: CapaRecord;
    actions: Awaited<ReturnType<typeof getCapaActions>>;
    effectiveness: Awaited<ReturnType<typeof getCapaEffectiveness>>;
    approvals: Awaited<ReturnType<typeof getCapaApprovals>>;
    sourceLinks: Awaited<ReturnType<typeof getCapaSourceLinks>>;
    auditLogs: Awaited<ReturnType<typeof getAuditLogsForCapa>>;
  } | null>(null);

  useEffect(() => {
    void listCapas().then((data) => {
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
    const [actions, effectiveness, approvals, sourceLinks, auditLogs] = await Promise.all([
      getCapaActions(id),
      getCapaEffectiveness(id),
      getCapaApprovals(id),
      getCapaSourceLinks(id),
      getAuditLogsForCapa(id),
    ]);
    setReportData({ record, actions, effectiveness, approvals, sourceLinks, auditLogs });
    setReportLoading(false);
  };

  useEffect(() => { if (selectedId) void loadReport(selectedId); }, [selectedId, records.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CAPA Reports</h1>
          <p className="text-muted-foreground text-sm">Generate GMP-compliant CAPA report for print / PDF save</p>
        </div>
        <Button variant="outline" className="gap-2 no-print" onClick={() => printPage()} disabled={!reportData}>
          <Printer className="h-4 w-4" />Print / Save PDF
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader><CardTitle>Select CAPA</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingSpinner /> : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Select CAPA" /></SelectTrigger>
              <SelectContent>
                {records.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.capa_number} — {r.capa_title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {reportLoading ? <LoadingSpinner label="Building report..." /> : reportData && (
        <CapaPdfDocument
          record={reportData.record}
          actions={reportData.actions}
          effectiveness={reportData.effectiveness}
          approvals={reportData.approvals}
          sourceLinks={reportData.sourceLinks}
          auditLogs={reportData.auditLogs}
        />
      )}
    </div>
  );
}
