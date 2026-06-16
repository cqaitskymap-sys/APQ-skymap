'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive, ChevronRight, Download, Eye, FileText, PenLine, Plus, RefreshCw, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import type { AnnualCpvSnapshot } from '@/lib/cpv-annual-review';
import {
  buildCpvReviewCharts, generateCpvReviewNumber, processStatusColor,
  reviewStatusLabel, summarizeCpvReviews, riskLevelColor,
  type CpvAnnualReviewRecord,
} from '@/lib/cpv-annual-review-records';
import {
  approveCpvReview, archiveCpvReview, createCpvReview, fetchCpvReviewRecords,
  loadAnnualReviewSourceData, logCpvReviewExport, rejectCpvReview,
  submitCpvReviewForApproval, toAnnualCpvDocument, updateCpvReview,
} from '@/lib/cpv-annual-review-service';
import { fetchCpvProducts } from '@/lib/cpv-product-master-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { AnnualCpvPdfDocument } from '@/components/cpv/annual-cpv-pdf-document';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { ApprovalTimeline } from './approval-timeline';
import { ReportSectionEditor } from './report-section-editor';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ColumnDef } from '@/components/admin/admin-data-table';

const STEPS = [
  'Select Product',
  'Select Review Period',
  'Collect Data',
  'Preview Summary',
  'Generate Sections',
  'Charts',
  'Conclusion',
  'Submit',
  'Approval',
  'Archive',
];

function StatusBadge({ status }: { status: string }) {
  const cls = ['Approved', 'Archived'].includes(status) ? 'bg-green-50 text-green-700 border-green-200'
    : status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200'
      : status === 'Under Review' ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : level === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-green-50 text-green-700 border-green-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

function SignDialog({
  label, disabled, onSign,
}: {
  label: string;
  disabled?: boolean;
  onSign: (payload: { signatureText: string; meaning: string; reason: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  const [meaning, setMeaning] = useState('approve');
  const [reason, setReason] = useState('');
  const [signing, setSigning] = useState(false);

  const submit = async () => {
    if (!signatureText.trim() || !reason.trim()) return toast.error('Signature and reason required');
    setSigning(true);
    try {
      await onSign({ signatureText, meaning, reason });
      setOpen(false);
      toast.success(`${label} recorded`);
    } catch {
      toast.error('Signature failed');
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <PenLine className="mr-2 h-4 w-4" />{label}
      </Button>
      <DialogContent>
        <DialogHeader><DialogTitle>E-Signature — {label}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full Name *</Label><Input className="mt-1" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} /></div>
          <div>
            <Label>Meaning</Label>
            <Select value={meaning} onValueChange={setMeaning}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="review">Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reason *</Label><Textarea className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
          <Button onClick={submit} disabled={signing} className="w-full">{signing ? 'Signing…' : 'Apply E-Signature'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnnualReviewPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canCreateAnnualReview(role);
  const canEdit = cpvPermissions.canEditAnnualReview(role);
  const canApprove = cpvPermissions.canApproveAnnualReview(role);
  const canExport = cpvPermissions.canExportAnnualReview(role);

  const [records, setRecords] = useState<CpvAnnualReviewRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [snapshot, setSnapshot] = useState<AnnualCpvSnapshot | null>(null);
  const [activeReview, setActiveReview] = useState<CpvAnnualReviewRecord | null>(null);
  const [productId, setProductId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [periodTo, setPeriodTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: profile?.role || '' };
  const selectedProduct = products.find((p) => p.id === productId);
  const summary = useMemo(() => summarizeCpvReviews(records), [records]);
  const charts = useMemo(() => (snapshot ? buildCpvReviewCharts(snapshot as unknown as Record<string, unknown>) : null), [snapshot]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods] = await Promise.all([fetchCpvReviewRecords(), fetchCpvProducts()]);
      setRecords(rows);
      setProducts(prods.filter((p) => p.status === 'Active' || !p.status));
    } catch {
      setError('Failed to load CPV reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const collectData = async () => {
    if (!selectedProduct) return toast.error('Select a product');
    if (new Date(periodTo) < new Date(periodFrom)) return toast.error('Review end date must be after start date');
    setCollecting(true);
    setStep(2);
    try {
      const year = new Date(periodTo).getFullYear();
      const { snapshot: data } = await loadAnnualReviewSourceData(
        year,
        selectedProduct.productName,
        periodFrom,
        periodTo,
        selectedProduct.productCode,
      );
      if (data.metrics.totalBatchesReviewed < 1 && data.batches.total < 1) {
        toast.error('No batches found for the selected product and period.');
        setCollecting(false);
        return;
      }
      setSnapshot(data);
      setExecutiveSummary(data.executiveSummary);
      setConclusion(data.conclusion);
      setRecommendations(data.recommendations);
      setStep(3);
      toast.success('CPV data collected successfully');
    } catch {
      toast.error('Data collection failed');
    } finally {
      setCollecting(false);
    }
  };

  const generateReview = async () => {
    if (!snapshot || !selectedProduct) return;
    const { result, error: err } = await createCpvReview({
      productName: selectedProduct.productName,
      productCode: selectedProduct.productCode,
      genericName: selectedProduct.genericName || '',
      strength: selectedProduct.strength || '',
      dosageForm: selectedProduct.dosageForm || '',
      reviewPeriodFrom: periodFrom,
      reviewPeriodTo: periodTo,
      executiveSummary,
      conclusion,
      recommendations,
    }, { ...snapshot, executiveSummary, conclusion, recommendations }, actor, records.length);
    if (err || !result) return toast.error(err || 'Generation failed');
    setActiveReview(result);
    setStep(5);
    toast.success(`Review ${result.cpvReviewNumber} generated`);
    await load();
  };

  const columns: ColumnDef<CpvAnnualReviewRecord>[] = [
    { key: 'cpvReviewNumber', header: 'Review No.' },
    { key: 'productName', header: 'Product' },
    { key: 'reviewPeriodFrom', header: 'From' },
    { key: 'reviewPeriodTo', header: 'To' },
    { key: 'reviewStatus', header: 'Status', render: (r) => <StatusBadge status={reviewStatusLabel(String(r.reviewStatus))} /> },
    { key: 'overallRiskLevel', header: 'Risk', render: (r) => <RiskBadge level={String(r.overallRiskLevel)} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button variant="ghost" size="icon" onClick={() => router.push(`/cpv/annual-review/${r.id}`)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const exportRegister = () => {
    downloadCsv(
      'cpv-annual-reviews.csv',
      ['ReviewNumber', 'Product', 'From', 'To', 'Status', 'ProcessStatus', 'RiskLevel', 'AvgCpk'],
      records.map((r) => [
        r.cpvReviewNumber, r.productName, r.reviewPeriodFrom, r.reviewPeriodTo,
        r.reviewStatus, r.overallProcessStatus, r.overallRiskLevel, r.averageCpk,
      ]),
    );
    if (activeReview) void logCpvReviewExport(actor, 'Excel', activeReview.id, activeReview.cpvReviewNumber);
    toast.success('Register exported');
  };

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="Annual CPV Review"
        description="Generate annual Continued Process Verification review report"
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Annual CPV Review' },
        ]}
        actions={(
          <>
            {canExport && (
              <>
                <Button variant="outline" size="sm" onClick={exportRegister}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                <Button variant="outline" size="sm" onClick={() => { printPage(); if (activeReview) void logCpvReviewExport(actor, 'PDF', activeReview.id, activeReview.cpvReviewNumber); }}>
                  <FileText className="h-4 w-4 mr-1" />Export PDF
                </Button>
              </>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => { setWizardOpen(true); setStep(0); setSnapshot(null); setActiveReview(null); }}>
                <Plus className="h-4 w-4 mr-1" />Create Review
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Total Reviews" value={summary.total} tone="blue" />
        <KpiCard label="Draft" value={summary.draft} />
        <KpiCard label="Under Review" value={summary.underReview} tone="amber" />
        <KpiCard label="Approved" value={summary.approved} tone="green" />
        <KpiCard label="Rejected" value={summary.rejected} tone="red" />
        <KpiCard label="Due" value={summary.due} tone="amber" />
        <KpiCard label="High Risk" value={summary.highRisk} tone="red" />
        <KpiCard label="Health Score" value={`${summary.averageHealthScore}%`} tone="blue" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Annual CPV Review Register</CardTitle></CardHeader>
        <CardContent>
          {records.length ? (
            <ResponsiveDataTable columns={columns} data={records} searchKeys={['cpvReviewNumber', 'productName']} />
          ) : (
            <EmptyState title="No reviews yet" message="Create an annual CPV review to generate the official report." />
          )}
        </CardContent>
      </Card>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Annual CPV Review</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-1 text-xs">
            {STEPS.map((s, i) => (
              <span key={s} className={`flex items-center gap-1 rounded px-2 py-1 ${i === step ? 'bg-blue-100 text-blue-800 font-semibold' : i < step ? 'text-green-700' : 'text-muted-foreground'}`}>
                {i + 1}. {s}{i < STEPS.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <Label>Step 1 — Select Product *</Label>
              <Select value={productId} onValueChange={(v) => { setProductId(v); setStep(0); }}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => productId && setStep(1)} disabled={!productId}>Next</Button>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Review Period From *</Label><Input type="date" className="mt-1" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} /></div>
              <div><Label>Review Period To *</Label><Input type="date" className="mt-1" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></div>
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Preview number: {generateCpvReviewNumber(new Date(periodTo).getFullYear(), records.length)}
              </p>
              <div className="flex gap-2 sm:col-span-2">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={() => void collectData()} disabled={collecting}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${collecting ? 'animate-spin' : ''}`} />Collect Data
                </Button>
              </div>
            </div>
          )}

          {step >= 3 && snapshot && (
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList>
                <TabsTrigger value="summary">Preview</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="narrative">Conclusion</TabsTrigger>
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <KpiCard label="Batches" value={snapshot.metrics.totalBatchesReviewed} />
                  <KpiCard label="CPP Compliance" value={`${snapshot.metrics.cppCompliancePct}%`} tone={snapshot.metrics.cppCompliancePct >= 95 ? 'green' : 'amber'} />
                  <KpiCard label="CQA Compliance" value={`${snapshot.metrics.cqaCompliancePct}%`} tone={snapshot.metrics.cqaCompliancePct >= 95 ? 'green' : 'amber'} />
                  <KpiCard label="Avg Cpk" value={snapshot.metrics.averageCpk.toFixed(2)} tone={snapshot.metrics.averageCpk >= 1.33 ? 'green' : 'red'} />
                  <KpiCard label="Process Status" value={snapshot.overallProcessStatus} tone={processStatusColor(snapshot.overallProcessStatus)} />
                  <KpiCard label="Risk Level" value={snapshot.overallRiskLevel} tone={snapshot.overallRiskLevel === 'Low' ? 'green' : 'red'} />
                  <KpiCard label="Deviations" value={snapshot.deviations.total} />
                  <KpiCard label="Open Risks" value={snapshot.metrics.openRiskCount} />
                </div>
                <Textarea value={executiveSummary} onChange={(e) => setExecutiveSummary(e.target.value)} rows={4} placeholder="Executive summary" />
                {!activeReview && canCreate && (
                  <Button onClick={() => void generateReview()}>Generate Review Sections</Button>
                )}
              </TabsContent>

              <TabsContent value="sections" className="space-y-3">
                {(activeReview?.sections || []).slice(0, 8).map((section, i) => (
                  <ReportSectionEditor
                    key={section.sectionKey}
                    section={section}
                    disabled={!canEdit || activeReview?.reviewStatus === 'Approved'}
                    onChange={(content) => {
                      if (!activeReview) return;
                      const sections = [...(activeReview.sections || [])];
                      sections[i] = { ...sections[i], content };
                      setActiveReview({ ...activeReview, sections });
                    }}
                  />
                ))}
              </TabsContent>

              <TabsContent value="charts">
                {charts && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card><CardHeader><CardTitle className="text-sm">CPP Compliance</CardTitle></CardHeader>
                      <CardContent className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart><Pie data={charts.cppCompliance} dataKey="value" nameKey="name" outerRadius={70} label>
                            {charts.cppCompliance.map((_, i) => <Cell key={i} fill={['#059669', '#d97706', '#dc2626'][i] || '#2563eb'} />)}
                          </Pie><Tooltip /></PieChart>
                        </ResponsiveContainer>
                      </CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
                      <CardContent className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart><Pie data={charts.riskDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                            {charts.riskDistribution.map((e) => <Cell key={e.name} fill={riskLevelColor(e.name)} />)}
                          </Pie><Tooltip /></PieChart>
                        </ResponsiveContainer>
                      </CardContent></Card>
                    <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-sm">Average Cpk Trend</CardTitle></CardHeader>
                      <CardContent className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={charts.cpkTrend}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" /></BarChart>
                        </ResponsiveContainer>
                      </CardContent></Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="narrative" className="space-y-4">
                <div><Label>Conclusion *</Label><Textarea className="mt-1" rows={4} value={conclusion} onChange={(e) => setConclusion(e.target.value)} /></div>
                <div><Label>Recommendations</Label><Textarea className="mt-1" rows={4} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} /></div>
                {activeReview && canEdit && (
                  <Button variant="outline" onClick={async () => {
                    const { error: err } = await updateCpvReview(activeReview.id, { conclusion, recommendations, executiveSummary }, actor, activeReview);
                    if (err) return toast.error(err);
                    toast.success('Narrative saved');
                    await load();
                  }}>Save Narrative</Button>
                )}
              </TabsContent>

              <TabsContent value="workflow" className="space-y-4">
                {activeReview && (
                  <>
                    <ApprovalTimeline signatures={activeReview.signatures} />
                    <div className="flex flex-wrap gap-2">
                      {canEdit && activeReview.reviewStatus !== 'Under Review' && activeReview.reviewStatus !== 'Approved' && (
                        <Button size="sm" onClick={async () => {
                          const { error: err } = await submitCpvReviewForApproval(activeReview.id, actor, { ...activeReview, executiveSummary });
                          if (err) return toast.error(err);
                          toast.success('Submitted for review');
                          setWizardOpen(false);
                          await load();
                        }}><Send className="h-4 w-4 mr-1" />Submit for Review</Button>
                      )}
                      {canApprove && activeReview.reviewStatus === 'Under Review' && (
                        <>
                          <SignDialog label="Head QA Approve" onSign={async (p) => {
                            const { error: err } = await approveCpvReview(activeReview.id, actor, { ...activeReview, conclusion }, p);
                            if (err) throw new Error(err);
                            await load();
                          }} />
                          <Button size="sm" variant="destructive" onClick={async () => {
                            await rejectCpvReview(activeReview.id, actor, activeReview);
                            toast.success('Review rejected');
                            setWizardOpen(false);
                            await load();
                          }}>Reject</Button>
                        </>
                      )}
                      {canApprove && activeReview.reviewStatus === 'Approved' && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await archiveCpvReview(activeReview.id, actor, activeReview);
                          toast.success('Archived');
                          setWizardOpen(false);
                          await load();
                        }}><Archive className="h-4 w-4 mr-1" />Archive</Button>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}

          {activeReview?.id && (
            <div className="rounded-md border p-4 no-print">
              <p className="text-sm font-medium mb-2">Report Preview</p>
              <AnnualCpvPdfDocument document={toAnnualCpvDocument(activeReview)} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
