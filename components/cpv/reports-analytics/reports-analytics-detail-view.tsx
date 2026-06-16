'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Archive, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { reportStatusLabel } from '@/lib/cpv-reports-records';
import {
  archiveCpvReport, fetchCpvReportAuditTrail, fetchCpvReportById, logCpvReportDownload,
} from '@/lib/cpv-reports-service';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { AnalyticsChart } from './analytics-chart';
import { HealthScoreBadge } from './health-score-badge';
import { ReportPreview } from './report-preview';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function ReportsAnalyticsDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const canExport = cpvPermissions.canExportReports(profile?.role);
  const canArchive = cpvPermissions.canArchiveReports(profile?.role);

  const [record, setRecord] = useState<Awaited<ReturnType<typeof fetchCpvReportById>>>(null);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchCpvReportById(id);
    setRecord(r);
    if (r) setAudit(await fetchCpvReportAuditTrail(id));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={1} /></div>;
  if (!record) return <div className="p-4 sm:p-6"><ErrorCard message="Report not found." onRetry={load} /></div>;

  const charts = record.charts || {};

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={record.reportNumber}
        description={`${record.reportType} · ${record.productName}`}
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Reports & Analytics', href: '/cpv/reports-analytics' },
          { label: record.reportNumber },
        ]}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/reports-analytics')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canExport && (
              <>
                <Button size="sm" variant="outline" onClick={() => {
                  downloadCsv(`${record.reportNumber}.csv`, ['Module', 'Product', 'Batch', 'Status', 'Date'],
                    record.previewRows.map((r) => [
                      String(r._module || ''), String(r.productName || ''), String(r.batchNo || ''),
                      String(r.status || ''), String(r._date || '').slice(0, 10),
                    ]));
                  void logCpvReportDownload(actor, record);
                  toast.success('CSV downloaded');
                }}><Download className="h-4 w-4 mr-1" />CSV</Button>
                <Button size="sm" variant="outline" onClick={() => { printPage(); void logCpvReportDownload(actor, record); }}>
                  <Printer className="h-4 w-4 mr-1" />Print
                </Button>
              </>
            )}
            {canArchive && record.reportStatus !== 'Archived' && (
              <Button size="sm" variant="outline" onClick={async () => {
                await archiveCpvReport(record.id, actor, record);
                toast.success('Archived');
                await load();
              }}><Archive className="h-4 w-4 mr-1" />Archive</Button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Status" value={reportStatusLabel(String(record.reportStatus))} tone="blue" />
        <KpiCard label="Records" value={record.totalRecords} />
        <KpiCard label="Compliance" value={`${record.metrics?.cpvCompliancePct || 0}%`} tone="green" />
        <KpiCard label="Health" value={record.metrics?.healthScore || 0} tone={record.metrics?.healthScore >= 75 ? 'green' : 'amber'} />
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <ReportPreview metrics={record.metrics} rows={record.previewRows} />
        </TabsContent>
        <TabsContent value="charts">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="pt-6"><AnalyticsChart title="CPP vs CQA" data={(charts.cppVsCqa as Array<{ name: string; value: number }>) || []} /></CardContent></Card>
            <Card><CardContent className="pt-6"><AnalyticsChart title="Risk Distribution" data={(charts.riskDistribution as Array<{ name: string; value: number }>) || []} type="pie" /></CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="audit">
          <Card><CardContent className="pt-6">
            {audit.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                <TableBody>
                  {audit.map((row) => (
                    <TableRow key={String(row.id)}>
                      <TableCell>{String(row.action || row.actionType || '')}</TableCell>
                      <TableCell>{String(row.userName || row.userId || '')}</TableCell>
                      <TableCell>{String(row.createdAt || row.timestamp || '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">No audit entries.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
