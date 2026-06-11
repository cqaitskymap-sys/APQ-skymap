'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuditDashboardCharts } from '@/components/audit-mgmt/audit-dashboard-charts';
import { useAudits } from '@/hooks/use-audit-mgmt';
import { exportAuditsCsv, exportFindingsCsv } from '@/lib/audit-mgmt-service';
import { printPage } from '@/lib/export-utils';

export default function AuditReportsPage() {
  const { audits, findings, metrics, loading } = useAudits({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Reports</h1>
          <p className="text-muted-foreground text-sm">Audit analytics, finding reports, and compliance exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportAuditsCsv(audits)}><Download className="h-4 w-4 mr-1" />Audits CSV</Button>
          <Button variant="outline" onClick={() => exportFindingsCsv(findings)}><Download className="h-4 w-4 mr-1" />Findings CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({
                'Total Audits': metrics.total, 'Open Findings': metrics.openFindings,
                'Critical Findings': metrics.criticalFindings, 'Overdue': metrics.overdueFindings,
              }).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
              ))}
            </div>
          )}
          <AuditDashboardCharts audits={audits} findings={findings} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['Audit Plan Report', 'Audit Finding Report', 'Complete Audit Report', 'Department Compliance Report'].map((title) => (
              <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Generate from individual audit detail page using the Report button, or export CSV for bulk data.</p>
                </CardContent></Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
