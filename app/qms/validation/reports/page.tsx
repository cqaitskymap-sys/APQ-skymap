'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ValidationDashboardCharts } from '@/components/validation-mgmt/validation-dashboard-charts';
import { useValidations } from '@/hooks/use-validation-mgmt';
import { exportValidationsCsv } from '@/lib/validation-mgmt-service';
import { printPage } from '@/lib/export-utils';

const REPORTS = [
  'Validation Protocol PDF', 'Validation Execution Report', 'DQ/IQ/OQ/PQ Report',
  'Process Validation Report', 'Cleaning Validation Report', 'CSV Validation Report', 'Validation Master Plan Register',
];

export default function ValidationReportsPage() {
  const { records, metrics, loading } = useValidations({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Validation Reports</h1>
          <p className="text-muted-foreground text-sm">Protocol reports, execution summaries, and compliance exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportValidationsCsv(records)}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({
                'Total': metrics.total, 'Approved': metrics.approved,
                'Deviations': metrics.deviationObserved, 'Revalidation Due': metrics.revalidationDue,
              }).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
              ))}
            </div>
          )}
          <ValidationDashboardCharts records={records} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map((title) => (
              <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Generate from validation detail page using Report button, or export CSV for bulk register data.</p>
                </CardContent></Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
