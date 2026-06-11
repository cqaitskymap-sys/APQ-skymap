'use client';

import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DmsDashboardCharts } from '@/components/dms/dms-dashboard-charts';
import { useDocuments } from '@/hooks/use-dms';
import { exportDocumentsCsv } from '@/lib/dms-service';

export default function DmsReportsPage() {
  const { records, metrics, loading, error } = useDocuments({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">DMS Reports</h1>
          <p className="text-muted-foreground text-sm">Document analytics and export</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportDocumentsCsv(records)} disabled={loading}>
          <Download className="h-4 w-4" />Export CSV
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Total', metrics.total], ['Effective', metrics.effective], ['Under Review', metrics.underReview],
                ['Review Due', metrics.reviewDue],
              ].map(([label, value]) => (
                <Card key={label as string}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p>
                </CardContent></Card>
              ))}
            </div>
          )}
          <DmsDashboardCharts records={records} />
          <Card><CardHeader><CardTitle>Document Status Summary</CardTitle></CardHeader><CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {metrics && Object.entries({
                Draft: metrics.draft, 'Under Review': metrics.underReview, Effective: metrics.effective,
                Obsolete: metrics.obsolete, 'Review Due': metrics.reviewDue, 'Training Pending': metrics.trainingPending,
              }).map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3"><p className="text-muted-foreground">{k}</p><p className="text-xl font-bold">{v}</p></div>
              ))}
            </div>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
