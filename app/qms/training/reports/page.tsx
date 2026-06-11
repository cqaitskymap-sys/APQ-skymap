'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TmsDashboardCharts } from '@/components/training/tms-dashboard-charts';
import { useTrainingDashboard } from '@/hooks/use-training';
import { exportMatrixCsv, exportAssignmentsCsv } from '@/lib/training-service';
import { printPage } from '@/lib/export-utils';

export default function TrainingReportsPage() {
  const { assignments, matrix, competency, metrics, loading } = useTrainingDashboard({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Training Reports</h1>
          <p className="text-muted-foreground text-sm">Training matrix, compliance, effectiveness, and competency reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportMatrixCsv(matrix)}><Download className="h-4 w-4 mr-1" />Matrix CSV</Button>
          <Button variant="outline" onClick={() => exportAssignmentsCsv(assignments)}><Download className="h-4 w-4 mr-1" />Assignments CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print Report</Button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Total Employees', metrics.totalEmployees],
                ['Compliance %', `${metrics.compliancePercent}%`],
                ['Pending', metrics.pending],
                ['Overdue', metrics.overdue],
                ['Effective', metrics.effective],
                ['Failed', metrics.failedAssessments],
                ['Retraining', metrics.retrainingRequired],
              ].map(([label, value]) => (
                <Card key={label as string}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p>
                </CardContent></Card>
              ))}
            </div>
          )}
          <TmsDashboardCharts matrix={matrix} assignments={assignments} competency={competency} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-sm">Training Matrix Report</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">
              <p>{matrix.length} employees tracked</p>
              <p>Avg compliance: {metrics?.compliancePercent ?? 0}%</p>
              <p className="mt-2">Export CSV for full matrix with required/completed/pending/overdue counts.</p>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Department Compliance Report</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">
              <p>Department-wise compliance chart above shows training completion rates.</p>
              <p className="mt-2">Overdue: {metrics?.overdue ?? 0} assignments require immediate action.</p>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Training Effectiveness Report</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">
              <p>{metrics?.effective ?? 0} trainings evaluated as Effective.</p>
              <p>Failed assessments: {metrics?.failedAssessments ?? 0}</p>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Competency Report</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">
              <p>{competency.length} competency records on file.</p>
              <p>Gaps identified: {competency.filter((c) => c.gap !== 'None').length}</p>
            </CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}
