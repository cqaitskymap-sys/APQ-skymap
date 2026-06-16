'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, CheckCircle, FileSpreadsheet, FileText, Loader2, RefreshCw, Save, Send, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import type { PqrSummaryConclusionRecord } from '@/lib/pqr-summary-conclusion-records';
import {
  canApproveSummaryConclusion,
  canExportSummaryConclusion,
  canManageSummaryConclusion,
  summaryApprovalSchema,
  type SummaryApprovalFormData,
} from '@/lib/pqr-summary-conclusion-records';
import {
  approveSummaryConclusion,
  archiveSummaryConclusion,
  buildSummaryCharts,
  consolidatePqrReviewData,
  fetchPqrOptions,
  fetchSummaryConclusionRecord,
  generateSummaryConclusion,
  logSummaryConclusionView,
  logSummaryExportExcel,
  logSummaryExportPdf,
  logSummaryNarrativeEdit,
  rejectSummaryConclusion,
  submitSummaryForReview,
  updateSummaryConclusionFields,
} from '@/lib/pqr-summary-conclusion-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SummaryConclusionAccessGuard } from './summary-conclusion-access-guard';
import { ProcessStatusBadge, QualityStatusBadge, RiskBadge, SummaryStatusBadge } from './summary-conclusion-badges';
import { QualityScoreGauge } from './quality-score-gauge';
import { ApprovalTimeline } from './approval-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

const NARRATIVE_FIELDS: Array<{ key: keyof PqrSummaryConclusionRecord; label: string }> = [
  { key: 'executiveSummary', label: 'Executive Summary' },
  { key: 'qualityPerformanceSummary', label: 'Quality Performance Summary' },
  { key: 'manufacturingPerformanceSummary', label: 'Manufacturing Performance Summary' },
  { key: 'materialPerformanceSummary', label: 'Material Performance Summary' },
  { key: 'packagingPerformanceSummary', label: 'Packaging Performance Summary' },
  { key: 'equipmentPerformanceSummary', label: 'Equipment Performance Summary' },
  { key: 'utilityPerformanceSummary', label: 'Utility Performance Summary' },
  { key: 'environmentalPerformanceSummary', label: 'Environmental Performance Summary' },
  { key: 'stabilityPerformanceSummary', label: 'Stability Performance Summary' },
  { key: 'deviationSummary', label: 'Deviation Summary' },
  { key: 'oosSummary', label: 'OOS Summary' },
  { key: 'capaSummary', label: 'CAPA Summary' },
  { key: 'riskAssessmentSummary', label: 'Risk Assessment Summary' },
  { key: 'trendAnalysisSummary', label: 'Trend Analysis Summary' },
  { key: 'cpvSummary', label: 'CPV Summary' },
];

function SafeChart({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-52">{empty ? <EmptyState title="No data" message="No chart data." /> : children}</CardContent>
    </Card>
  );
}

export function SummaryConclusionPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canManage = canManageSummaryConclusion(role);
  const canApprove = canApproveSummaryConclusion(role);
  const canExport = canExportSummaryConclusion(role);

  const [pqrs, setPqrs] = useState<PqrOption[]>([]);
  const [selectedPqrId, setSelectedPqrId] = useState('');
  const [record, setRecord] = useState<PqrSummaryConclusionRecord | null>(null);
  const [charts, setCharts] = useState<ReturnType<typeof buildSummaryCharts> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComments, setRejectComments] = useState('');
  const [esignOpen, setEsignOpen] = useState(false);
  const [esignPassword, setEsignPassword] = useState('');
  const [esignReason, setEsignReason] = useState('');

  const [form, setForm] = useState<SummaryApprovalFormData>({
    executiveSummary: '',
    finalConclusion: '',
    recommendations: '',
    reviewedBy: '',
    approvedBy: '',
    reviewerComments: '',
    qaComments: '',
    headQaComments: '',
    finalApprovalComments: '',
  });

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'System',
    role,
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const selectedPqr = useMemo(() => pqrs.find((p) => p.id === selectedPqrId) || null, [pqrs, selectedPqrId]);
  const metrics = record?.metrics;
  const locked = record?.status === 'Approved' || record?.status === 'Archived';

  const loadPqrs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) { setError('Firebase is not configured.'); return; }
      const opts = await fetchPqrOptions();
      setPqrs(opts);
      if (opts.length && !selectedPqrId) setSelectedPqrId(opts[0].id);
    } catch { setError('Failed to load PQR records.'); }
    finally { setLoading(false); }
  }, [selectedPqrId]);

  const loadRecord = useCallback(async (pqr: PqrOption) => {
    setBusy(true);
    try {
      const [rec, data] = await Promise.all([
        fetchSummaryConclusionRecord(pqr.id),
        consolidatePqrReviewData(pqr),
      ]);
      setRecord(rec);
      if (rec) {
        setForm({
          executiveSummary: rec.executiveSummary,
          finalConclusion: rec.finalConclusion,
          recommendations: rec.recommendations,
          reviewedBy: rec.reviewedBy,
          approvedBy: rec.approvedBy,
          reviewerComments: rec.reviewerComments,
          qaComments: rec.qaComments,
          headQaComments: rec.headQaComments,
          finalApprovalComments: rec.finalApprovalComments,
        });
        setCharts(buildSummaryCharts(data, rec.metrics));
      } else {
        setCharts(null);
      }
    } catch { toast.error('Failed to load summary record'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void loadPqrs(); void logSummaryConclusionView(actor); }, [loadPqrs, actor]);
  useEffect(() => { if (selectedPqr) void loadRecord(selectedPqr); }, [selectedPqr, loadRecord]);

  const handleGenerate = async () => {
    if (!selectedPqr) return;
    setBusy(true);
    const { record: rec, error: err } = await generateSummaryConclusion(selectedPqr, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Summary & conclusion generated');
    if (rec) {
      setRecord(rec);
      setForm({
        executiveSummary: rec.executiveSummary,
        finalConclusion: rec.finalConclusion,
        recommendations: rec.recommendations,
        reviewedBy: rec.reviewedBy,
        approvedBy: rec.approvedBy,
        reviewerComments: rec.reviewerComments,
        qaComments: rec.qaComments,
        headQaComments: rec.headQaComments,
        finalApprovalComments: rec.finalApprovalComments,
      });
      const data = await consolidatePqrReviewData(selectedPqr);
      setCharts(buildSummaryCharts(data, rec.metrics));
    }
  };

  const handleSaveFields = async (fields: Partial<PqrSummaryConclusionRecord>) => {
    if (!record?.id || !selectedPqr) return;
    setBusy(true);
    const { error: err } = await updateSummaryConclusionFields(record.id, fields, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Saved');
    await loadRecord(selectedPqr);
  };

  const handleSubmitReview = async () => {
    if (!record?.id) return;
    const parsed = summaryApprovalSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0]?.message || 'Validation failed');
    setBusy(true);
    const { error: err } = await submitSummaryForReview(record.id, parsed.data, actor);
    setBusy(false);
    if (err) return toast.error(err);
    toast.success('Submitted for review');
    if (selectedPqr) await loadRecord(selectedPqr);
  };

  const handleApprove = async () => {
    if (!record?.id) return;
    const parsed = summaryApprovalSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0]?.message || 'Validation failed');
    if (!esignPassword || esignPassword.length < 4) return toast.error('Enter password for e-signature');
    if (!esignReason.trim()) return toast.error('Reason for signature is required');
    setBusy(true);
    const { error: err } = await approveSummaryConclusion(
      record.id,
      parsed.data,
      actor,
      { meaning: 'Approved By' },
    );
    setBusy(false);
    setEsignOpen(false);
    setEsignPassword('');
    setEsignReason('');
    if (err) return toast.error(err);
    toast.success('PQR summary approved');
    if (selectedPqr) await loadRecord(selectedPqr);
  };

  const handleReject = async (): Promise<void> => {
    if (!record?.id) return;
    setBusy(true);
    const { error: err } = await rejectSummaryConclusion(record.id, rejectComments, actor);
    setBusy(false);
    setRejectOpen(false);
    if (err) { toast.error(err); return; }
    toast.success('Summary rejected');
    if (selectedPqr) await loadRecord(selectedPqr);
  };

  const updateNarrative = (key: keyof PqrSummaryConclusionRecord, value: string) => {
    setRecord((prev) => prev ? { ...prev, [key]: value } : prev);
    if (key === 'executiveSummary') setForm((f) => ({ ...f, executiveSummary: value }));
    if (key === 'finalConclusion') setForm((f) => ({ ...f, finalConclusion: value }));
    if (key === 'recommendations') setForm((f) => ({ ...f, recommendations: value }));
    if (selectedPqr) void logSummaryNarrativeEdit(actor, selectedPqr.id);
  };

  if (loading) return <SummaryConclusionAccessGuard><div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div></SummaryConclusionAccessGuard>;
  if (error) return <SummaryConclusionAccessGuard><div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void loadPqrs()} /></div></SummaryConclusionAccessGuard>;

  return (
    <SummaryConclusionAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title="PQR Summary & Conclusion"
          description="Final Product Quality Review Assessment and Management Conclusion"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'Summary & Conclusion' },
          ]}
          actions={(
            <>
              {canExport && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { void logSummaryExportPdf(actor); toast.info('PDF export placeholder'); }}>
                    <FileText className="h-4 w-4 mr-1" />PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { void logSummaryExportExcel(actor); toast.info('Excel export placeholder'); }}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
                  </Button>
                </>
              )}
              {canManage && selectedPqr && (
                <Button size="sm" onClick={() => void handleGenerate()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Generate Summary
                </Button>
              )}
            </>
          )}
        />

        <Card><CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>PQR Number *</Label>
              <Select value={selectedPqrId} onValueChange={setSelectedPqrId}>
                <SelectTrigger><SelectValue placeholder="Select PQR..." /></SelectTrigger>
                <SelectContent>{pqrs.map((p) => <SelectItem key={p.id} value={p.id}>{p.pqrNumber} — {p.productName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedPqr && (
              <>
                <div><Label className="text-muted-foreground">Product</Label><p className="text-sm font-medium">{selectedPqr.productName}</p></div>
                <div><Label className="text-muted-foreground">Review Period</Label><p className="text-sm font-medium">{selectedPqr.reviewPeriodFrom} — {selectedPqr.reviewPeriodTo}</p></div>
              </>
            )}
          </div>
        </CardContent></Card>

        {!selectedPqr ? (
          <EmptyState title="Select a PQR" message="Choose a PQR to generate summary and conclusion." />
        ) : !record ? (
          <EmptyState title="No summary generated" message="Click Generate Summary to consolidate all PQR review sections." />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <SummaryStatusBadge status={record.status} />
              <QualityStatusBadge status={record.overallQualityStatus} />
              <ProcessStatusBadge status={record.overallProcessStatus} />
              <RiskBadge level={record.overallRiskLevel} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
              <Card><CardContent className="pt-6 flex justify-center">
                <QualityScoreGauge score={metrics?.qualityScore ?? 0} band={metrics?.qualityScoreBand} />
              </CardContent></Card>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard label="Total Batches" value={metrics?.totalBatchesManufactured ?? 0} />
                <KpiCard label="Released" value={metrics?.totalReleasedBatches ?? 0} tone="green" />
                <KpiCard label="Rejected" value={metrics?.totalRejectedBatches ?? 0} tone="red" />
                <KpiCard label="Avg Cpk" value={metrics?.averageCpk ?? 0} />
                <KpiCard label="Open CAPA" value={metrics?.openCapa ?? 0} tone="amber" />
                <KpiCard label="Open OOS" value={metrics?.openOos ?? 0} tone="red" />
                <KpiCard label="High Risks" value={metrics?.highRisks ?? 0} tone="amber" />
                <KpiCard label="Critical Risks" value={metrics?.criticalRisks ?? 0} tone="red" />
              </div>
            </div>

            <Tabs defaultValue="dashboard">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="dashboard">Executive Dashboard</TabsTrigger>
                <TabsTrigger value="narratives">Narrative Sections</TabsTrigger>
                <TabsTrigger value="conclusion">Conclusion & Recommendations</TabsTrigger>
                <TabsTrigger value="approval">Approval Workflow</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Batch Release %', `${metrics?.batchReleasePct ?? 0}%`],
                    ['Material Compliance', `${metrics?.materialCompliancePct ?? 0}%`],
                    ['Packaging Compliance', `${metrics?.packagingCompliancePct ?? 0}%`],
                    ['Equipment Compliance', `${metrics?.equipmentCompliancePct ?? 0}%`],
                    ['Stability Compliance', `${metrics?.stabilityCompliancePct ?? 0}%`],
                    ['Deviations', `${metrics?.totalDeviations ?? 0} (${metrics?.openDeviations ?? 0} open)`],
                    ['OOS', `${metrics?.totalOos ?? 0} (${metrics?.openOos ?? 0} open)`],
                    ['CAPA', `${metrics?.totalCapa ?? 0} (${metrics?.openCapa ?? 0} open)`],
                    ['Avg Ppk', `${metrics?.averagePpk ?? 0}`],
                  ].map(([k, v]) => (
                    <Card key={k}><CardHeader className="pb-2"><CardTitle className="text-sm">{k}</CardTitle></CardHeader>
                      <CardContent><p className="text-2xl font-semibold text-blue-700">{v}</p></CardContent></Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="narratives" className="mt-4 space-y-4">
                {NARRATIVE_FIELDS.map(({ key, label }) => (
                  <Card key={key}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        className="min-h-[80px]"
                        value={String(record[key] ?? '')}
                        readOnly={locked || !canManage}
                        onChange={(e) => updateNarrative(key, e.target.value)}
                        onBlur={() => { if (canManage && !locked) void handleSaveFields({ [key]: record[key] }); }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="conclusion" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Final Conclusion</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea className="min-h-[120px]" value={record.finalConclusion} readOnly={locked || !canManage}
                      onChange={(e) => updateNarrative('finalConclusion', e.target.value)}
                      onBlur={() => { if (canManage && !locked) void handleSaveFields({ finalConclusion: record.finalConclusion }); }} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Recommendations</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea className="min-h-[120px]" value={record.recommendations} readOnly={locked || !canManage}
                      onChange={(e) => updateNarrative('recommendations', e.target.value)}
                      onBlur={() => { if (canManage && !locked) void handleSaveFields({ recommendations: record.recommendations }); }} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approval" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Approval Details</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>Reviewer *</Label><Input value={form.reviewedBy} disabled={locked} onChange={(e) => setForm({ ...form, reviewedBy: e.target.value })} /></div>
                        <div><Label>Approver *</Label><Input value={form.approvedBy} disabled={locked} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} /></div>
                      </div>
                      <div><Label>Reviewer Comments</Label><Textarea value={form.reviewerComments} disabled={locked} onChange={(e) => setForm({ ...form, reviewerComments: e.target.value })} /></div>
                      <div><Label>QA Comments</Label><Textarea value={form.qaComments} disabled={locked} onChange={(e) => setForm({ ...form, qaComments: e.target.value })} /></div>
                      <div><Label>Head QA Comments</Label><Textarea value={form.headQaComments} disabled={locked} onChange={(e) => setForm({ ...form, headQaComments: e.target.value })} /></div>
                      <div><Label>Final Approval Comments</Label><Textarea value={form.finalApprovalComments} disabled={locked} onChange={(e) => setForm({ ...form, finalApprovalComments: e.target.value })} /></div>
                      {canManage && !locked && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => void handleSubmitReview()} disabled={busy}><Send className="h-4 w-4 mr-1" />Submit for Review</Button>
                          {canApprove && (
                            <>
                              <Button onClick={() => setEsignOpen(true)} disabled={busy}><CheckCircle className="h-4 w-4 mr-1" />Approve</Button>
                              <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
                            </>
                          )}
                          {record.status === 'Approved' && (
                            <Button variant="outline" onClick={() => record.id && void archiveSummaryConclusion(record.id, actor).then(() => selectedPqr && loadRecord(selectedPqr))}>
                              <Archive className="h-4 w-4 mr-1" />Archive
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Approval Timeline</CardTitle></CardHeader>
                    <CardContent>
                      <ApprovalTimeline status={record.status} approvalDate={record.approvalDate} reviewedBy={record.reviewedBy} approvedBy={record.approvedBy} />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="charts" className="mt-4">
                {charts ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <SafeChart title="Batch Release Trend" empty={!charts.batchReleaseTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.batchReleaseTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                          <Line type="monotone" dataKey="released" stroke="#059669" /><Line type="monotone" dataKey="rejected" stroke="#dc2626" /></LineChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="Deviation Trend" empty={!charts.deviationTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.deviationTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#2563eb" /></LineChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="OOS Trend" empty={!charts.oosTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.oosTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#dc2626" /></LineChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="CAPA Trend" empty={!charts.capaTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.capaTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#d97706" /></LineChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="Risk Distribution" empty={!charts.riskDistribution.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={charts.riskDistribution} dataKey="count" nameKey="level" outerRadius={70} label>
                          {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie><Tooltip /></PieChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="Cpk Trend" empty={!charts.cpkTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.cpkTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 2]} /><Tooltip /><Line type="monotone" dataKey="cpk" stroke="#2563eb" /></LineChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="Stability Trend" empty={!charts.stabilityTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={charts.stabilityTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                          <Line type="monotone" dataKey="compliant" stroke="#059669" /><Line type="monotone" dataKey="nonCompliant" stroke="#dc2626" /></LineChart>
                      </ResponsiveContainer>
                    </SafeChart>
                    <SafeChart title="Quality Score" empty={!charts.qualityScoreTrend.length}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.qualityScoreTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="score" fill="#2563eb" /></BarChart>
                      </ResponsiveContainer>
                    </SafeChart>
                  </div>
                ) : <EmptyState title="No charts" message="Generate summary to view charts." />}
              </TabsContent>
            </Tabs>
          </>
        )}

        <Dialog open={esignOpen} onOpenChange={setEsignOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Electronic Signature — Final Approval</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Password *</Label><Input type="password" value={esignPassword} onChange={(e) => setEsignPassword(e.target.value)} /></div>
              <div><Label>Reason for Signature *</Label><Textarea value={esignReason} onChange={(e) => setEsignReason(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEsignOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleApprove()} disabled={busy}><Save className="h-4 w-4 mr-1" />Sign & Approve</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={rejectOpen} onOpenChange={setRejectOpen} title="Reject Summary"
          description="Provide rejection comments." confirmLabel="Reject" destructive loading={busy}
          onConfirm={handleReject} />
      </div>
    </SummaryConclusionAccessGuard>
  );
}
