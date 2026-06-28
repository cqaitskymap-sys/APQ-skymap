'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, RefreshCw, Save, Calendar, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingReports } from '@/hooks/use-training-reports';
import {
  TRAINING_REPORT_TYPES, TRAINING_REPORT_FREQUENCIES, exportTrainingReportCsv,
} from '@/lib/training-reports-records';
import {
  logTrainingReportExported, openTrainingReportPrint, saveReportTemplate, saveReportSchedule,
} from '@/lib/training-reports-service';
import { downloadCsv } from '@/lib/export-utils';
import { ReportCard } from './report-card';
import { ReportFilter } from './report-filter';
import { TrainingReportsCharts } from './training-reports-charts';
import { ReportViewer } from './report-viewer';
import { ExportMenu } from './export-menu';

const KPI_CONFIG = [
  { label: 'Reports Generated', key: 'totalReportsGenerated' as const, tone: 'blue' as const },
  { label: 'Compliance %', key: 'trainingCompliancePercent' as const, tone: 'green' as const, suffix: '%' },
  { label: 'Fully Trained', key: 'employeesFullyTrained' as const, tone: 'green' as const },
  { label: 'Overdue Employees', key: 'employeesOverdue' as const, tone: 'red' as const },
  { label: 'Certs Expiring', key: 'certificatesExpiring' as const, tone: 'amber' as const },
  { label: 'Retraining Due', key: 'retrainingDue' as const, tone: 'amber' as const },
  { label: 'Avg Assessment', key: 'averageAssessmentScore' as const, tone: 'blue' as const },
  { label: 'Competency Rate', key: 'competencyRate' as const, tone: 'green' as const, suffix: '%' },
  { label: 'Dept Compliance', key: 'departmentCompliance' as const, tone: 'blue' as const, suffix: '%' },
  { label: 'Monthly Completion', key: 'monthlyCompletionPercent' as const, tone: 'green' as const, suffix: '%' },
];

const REPORT_DESCRIPTIONS: Record<string, string> = {
  'Training Compliance Report': 'Overall training compliance across all employees and departments.',
  'Department Training Report': 'Department-wise completion rates and compliance summary.',
  'Employee Training History Report': 'Complete training history per employee.',
  'Overdue Training Report': 'All overdue assignments requiring immediate action.',
  'Upcoming Training Report': 'Trainings due within the next 30 days.',
  'Training Effectiveness Report': 'Effectiveness evaluation results and pending reviews.',
  'Competency Report': 'Competency gaps and skill level assessments.',
  'Assessment Result Report': 'Pass/fail assessment results with scores.',
  'Certificate Status Report': 'Active and expired training certificates.',
  'Certificate Expiry Report': 'Certificates expiring within 30 days.',
  'Retraining Report': 'Retraining assignments and status tracking.',
  'Trainer Performance Report': 'Trainer session counts and pass rates.',
  'Training Matrix Coverage Report': 'Matrix coverage and compliance per employee.',
  'Annual GMP Training Report': 'Annual GMP training completion for regulatory review.',
  'Regulatory Inspection Report': 'Inspection-ready summary of risks and gaps.',
};

interface TrainingReportsPageProps {
  defaultTab?: 'dashboard' | 'reports' | 'templates';
}

export function TrainingReportsPage({ defaultTab = 'dashboard' }: TrainingReportsPageProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [scheduleEmail, setScheduleEmail] = useState('');
  const [scheduleFreq, setScheduleFreq] = useState('Monthly');

  const {
    filters, setFilters, analytics, templates, schedules,
    loading, generating, error, actor, refresh, generate,
    canView, canGenerate, canExport, isReadOnly,
  } = useTrainingReports();

  const employees = analytics?.employees ?? [];
  const trainers = analytics?.trainers ?? [];

  const paginatedRows = useMemo(() => {
    if (!analytics) return [];
    const size = 15;
    const start = (page - 1) * size;
    return analytics.previewRows.slice(start, start + size);
  }, [analytics, page]);

  const totalPages = analytics ? Math.max(1, Math.ceil(analytics.previewRows.length / 15)) : 1;

  const handleGenerate = useCallback(async () => {
    try {
      await generate();
      toast.success(`${filters.report_type} generated`);
      setPage(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed');
    }
  }, [generate, filters.report_type]);

  const handleExportCsv = useCallback(async () => {
    if (!analytics) return;
    const { headers, rows } = exportTrainingReportCsv(analytics.previewRows);
    downloadCsv(`${filters.report_type?.replace(/\s+/g, '-').toLowerCase()}.csv`, headers, rows);
    await logTrainingReportExported(actor, 'CSV', filters.report_type || '', rows.length);
    toast.success('CSV exported');
  }, [analytics, filters.report_type, actor]);

  const handleExportExcel = useCallback(async () => {
    if (!analytics) return;
    const { headers, rows } = exportTrainingReportCsv(analytics.previewRows);
    downloadCsv(`${filters.report_type?.replace(/\s+/g, '-').toLowerCase()}.csv`, headers, rows);
    await logTrainingReportExported(actor, 'Excel', filters.report_type || '', rows.length);
    toast.success('Excel export downloaded');
  }, [analytics, filters.report_type, actor]);

  const handlePrint = useCallback(async () => {
    if (!analytics) return;
    openTrainingReportPrint(filters.report_type || 'Training Report', analytics.previewRows, analytics.summary, actor.name);
    await logTrainingReportExported(actor, 'Print', filters.report_type || '', analytics.previewRows.length);
  }, [analytics, filters.report_type, actor]);

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view Training Reports.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Reports & Analytics"
        description="Generate inspection-ready GMP training reports and analytics."
        trail={[{ label: 'Reports & Analytics' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <ExportMenu canExport={canExport && !isReadOnly} onExportCsv={handleExportCsv} onExportExcel={handleExportExcel} onPrint={handlePrint} />
            {canGenerate && !isReadOnly && (
              <Button onClick={handleGenerate} disabled={generating}>
                <Play className="h-4 w-4 mr-1" /> {generating ? 'Generating…' : 'Generate Report'}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">Inspection Ready</Badge>
        <Badge variant="outline" className="text-xs">Live Firestore Data</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor access — view and export only where permitted.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      <ReportFilter filters={filters} onChange={setFilters} employees={employees} trainers={trainers} />

      {loading ? <LoadingSkeleton rows={8} /> : analytics ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ label, key, tone, suffix }) => (
              <KpiCard key={key} label={label} value={`${analytics.kpis[key]}${suffix ?? ''}`} tone={tone} />
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Analytics Dashboard</TabsTrigger>
              <TabsTrigger value="reports">Report Viewer</TabsTrigger>
              <TabsTrigger value="templates">Templates & Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-4">
              <TrainingReportsCharts charts={analytics.charts} />
            </TabsContent>

            <TabsContent value="reports" className="mt-4 space-y-4">
              <ReportViewer
                rows={paginatedRows}
                reportType={filters.report_type || 'Training Compliance Report'}
                summary={analytics.summary}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {analytics.previewRows.length} records</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates" className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {canGenerate && !isReadOnly && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
                      <Save className="h-4 w-4 mr-1" /> Save Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                      <Calendar className="h-4 w-4 mr-1" /> Schedule Report
                    </Button>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {TRAINING_REPORT_TYPES.map((type) => (
                  <ReportCard
                    key={type}
                    title={type}
                    description={REPORT_DESCRIPTIONS[type] || ''}
                    selected={filters.report_type === type}
                    onClick={() => setFilters((f) => ({ ...f, report_type: type }))}
                  />
                ))}
              </div>
              {templates.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Saved Templates</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {templates.map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <span>{t.name} — {t.report_type}</span>
                        <Button size="sm" variant="ghost" onClick={() => setFilters({ ...filters, ...t.filters, report_type: t.report_type })}>Load</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {schedules.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Scheduled Reports</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {schedules.map((s) => (
                      <div key={s.id} className="text-sm border-b pb-2">
                        <span className="font-medium">{s.report_type}</span> · {s.frequency}
                        {s.email_to && <span className="text-muted-foreground"> → {s.email_to}</span>}
                        <span className="text-xs text-muted-foreground block">Next: {new Date(s.next_run).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save Report Template</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Monthly QA Compliance" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!templateName.trim()) { toast.error('Name required'); return; }
              saveReportTemplate(actor.id, { name: templateName, report_type: filters.report_type as typeof TRAINING_REPORT_TYPES[number], filters });
              toast.success('Template saved');
              setTemplateOpen(false);
              setTemplateName('');
              refresh();
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-4 w-4" /> Email delivery is a placeholder — schedule stored locally.</p>
            <div>
              <Label>Frequency</Label>
              <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRAINING_REPORT_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email To (optional)</Label>
              <Input type="email" value={scheduleEmail} onChange={(e) => setScheduleEmail(e.target.value)} placeholder="qa@company.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              saveReportSchedule(actor.id, {
                report_type: filters.report_type as typeof TRAINING_REPORT_TYPES[number],
                frequency: scheduleFreq,
                email_to: scheduleEmail,
                filters,
              });
              toast.success('Report scheduled');
              setScheduleOpen(false);
              refresh();
            }}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
