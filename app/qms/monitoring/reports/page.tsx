'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MonitoringDashboardCharts } from '@/components/monitoring-mgmt/monitoring-dashboard-charts';
import { MonitoringPdfDocument } from '@/components/monitoring-mgmt/monitoring-pdf-document';
import { useMonitoring } from '@/hooks/use-monitoring-mgmt';
import { exportAreasCsv, exportEnvironmentalCsv, exportUtilityCsv, exportExcursionsCsv } from '@/lib/monitoring-mgmt-service';
import { printPage } from '@/lib/export-utils';

const REPORTS = [
  'Environmental Monitoring Report', 'Utility Monitoring Report', 'Excursion Report',
  'Trend Report', 'Area Wise Compliance Report',
];

export default function MonitoringReportsPage() {
  const { areas, environmental, utility, excursions, metrics, loading } = useMonitoring();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Monitoring Reports</h1>
          <p className="text-muted-foreground text-sm">GMP registers, compliance analytics, and PDF exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportEnvironmentalCsv(environmental)}><Download className="h-4 w-4 mr-1" />Environmental CSV</Button>
          <Button variant="outline" onClick={() => exportUtilityCsv(utility)}><Download className="h-4 w-4 mr-1" />Utility CSV</Button>
          <Button variant="outline" onClick={() => exportExcursionsCsv(excursions)}><Download className="h-4 w-4 mr-1" />Excursion CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print PDF</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({
                'Total Records': metrics.totalRecords, 'Compliant': metrics.compliant,
                'Excursions': metrics.excursions, 'Open': metrics.openExcursions,
              }).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
              ))}
            </div>
          )}
          <MonitoringDashboardCharts environmental={environmental} utility={utility} excursions={excursions} areas={areas} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map((title) => (
              <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground"><p>Export CSV or print PDF for GMP documentation.</p></CardContent></Card>
            ))}
          </div>
          <div className="hidden print:block">
            <MonitoringPdfDocument areas={areas} environmental={environmental} utility={utility} excursions={excursions} />
          </div>
        </>
      )}
    </div>
  );
}
