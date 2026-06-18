'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, RefreshCw, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  COMPLAINT_CLOSURE_TARGET_DAYS,
  COMPLAINT_TREND_FILTER_OPTIONS,
  canApproveComplaintTrend,
  canExportComplaintTrend,
  canGenerateComplaintTrend,
  complaintTrendFilterSchema,
  isComplaintTrendReadOnly,
  type ComplaintTrendAnalysisResult,
} from '@/lib/complaint-trend-records';
import {
  approveComplaintTrend,
  fetchComplaintTrendMarketOptions,
  fetchComplaintTrendProductOptions,
  fetchComplaintTrendRootCauseOptions,
  generateComplaintTrend,
  listSavedComplaintTrends,
  logComplaintTrendExport,
  logComplaintTrendFilterApplied,
  logComplaintTrendRecommendationGenerated,
  saveComplaintTrend,
} from '@/lib/complaint-trend-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { ComplaintTrendAccessGuard } from './complaint-trend-access-guard';
import { ComplaintTrendRiskBadge, ComplaintTrendStatusBadge } from './complaint-trend-badges';
import { ComplaintTrendCharts } from './complaint-trend-charts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ComplaintTrendRecord } from '@/lib/complaint-types';

const defaultFrom = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
};
const defaultTo = () => new Date().toISOString().split('T')[0];

export function ComplaintTrendAnalysisPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canGenerate = canGenerateComplaintTrend(role);
  const canApprove = canApproveComplaintTrend(role);
  const canExport = canExportComplaintTrend(role);
  const readOnly = isComplaintTrendReadOnly(role);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTrends, setSavedTrends] = useState<ComplaintTrendRecord[]>([]);
  const [products, setProducts] = useState<string[]>(['All']);
  const [markets, setMarkets] = useState<string[]>(['All']);
  const [rootCauses, setRootCauses] = useState<string[]>(['All']);
  const [analysis, setAnalysis] = useState<ComplaintTrendAnalysisResult | null>(null);

  const [reviewFrom, setReviewFrom] = useState(defaultFrom);
  const [reviewTo, setReviewTo] = useState(defaultTo);
  const [product, setProduct] = useState('All');
  const [marketRegion, setMarketRegion] = useState('All');
  const [category, setCategory] = useState('All');
  const [criticality, setCriticality] = useState('All');
  const [rootCause, setRootCause] = useState('All');
  const [conclusion, setConclusion] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [pqrSummary, setPqrSummary] = useState('');
  const [managementSummary, setManagementSummary] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
  }), [user?.uid, profile?.full_name, role]);

  const filters = useMemo(() => ({
    review_period_from: reviewFrom,
    review_period_to: reviewTo,
    product,
    market_region: marketRegion,
    complaint_category: category,
    criticality,
    root_cause_category: rootCause,
  }), [reviewFrom, reviewTo, product, marketRegion, category, criticality, rootCause]);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trends, prods, mkts, causes] = await Promise.all([
        listSavedComplaintTrends(),
        fetchComplaintTrendProductOptions(),
        fetchComplaintTrendMarketOptions(),
        fetchComplaintTrendRootCauseOptions(),
      ]);
      setSavedTrends(trends);
      setProducts(prods);
      setMarkets(mkts);
      setRootCauses(causes);
    } catch {
      setError('Failed to load trend workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMeta(); }, [loadMeta]);

  const runGenerate = async () => {
    const parsed = complaintTrendFilterSchema.safeParse({
      review_period_from: reviewFrom,
      review_period_to: reviewTo,
      product,
      market_region: marketRegion,
      complaint_category: category,
      criticality,
      root_cause_category: rootCause,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid filters');
      return;
    }
    if (readOnly) {
      toast.error('You do not have permission to generate trends');
      return;
    }
    setGenerating(true);
    try {
      const result = await generateComplaintTrend(parsed.data);
      setAnalysis(result);
      setConclusion(result.conclusion_draft);
      setRecommendation(result.recommendation_draft);
      setPqrSummary(result.pqr_summary_draft);
      setManagementSummary(result.management_summary_draft);
      await logComplaintTrendFilterApplied(actor, parsed.data);
      if (result.filtered_count === 0) {
        toast.message('No complaints match filters — review empty state');
      } else {
        toast.success(`Trend generated from ${result.filtered_count} complaint(s)`);
      }
    } catch {
      toast.error('Failed to generate trend');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!analysis || analysis.filtered_count === 0) {
      toast.error('Generate a trend with at least one complaint before saving');
      return;
    }
    if (!conclusion.trim() || !recommendation.trim()) {
      toast.error('Conclusion and recommendation are required');
      return;
    }
    setSaving(true);
    const { id, error: err } = await saveComplaintTrend(filters, {
      ...filters,
      product,
      market_region: marketRegion,
      complaint_category: category,
      criticality,
      root_cause_category: rootCause,
      conclusion,
      recommendation,
      pqr_summary: pqrSummary,
      management_summary: managementSummary,
    }, actor);
    setSaving(false);
    if (err) toast.error(err);
    else {
      toast.success('Trend record saved for PQR and management dashboard');
      await logComplaintTrendRecommendationGenerated(actor, id || 'new', recommendation);
      await loadMeta();
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export');
      return;
    }
    await logComplaintTrendExport(actor, analysis ? 'preview' : 'workspace', 'pdf-placeholder');
    toast.success('Export trend report — placeholder (audit logged)');
  };

  const handleApprove = useCallback(async (id: string) => {
    if (!canApprove) {
      toast.error('Only Head QA can approve trends');
      return;
    }
    const { error: err } = await approveComplaintTrend(id, actor);
    if (err) toast.error(err);
    else {
      toast.success('Trend approved');
      await loadMeta();
    }
  }, [canApprove, actor, loadMeta]);

  const metrics = analysis?.metrics;
  const savedColumns = useMemo(() => [
    { key: 'trend_id', header: 'Trend ID', render: (r: ComplaintTrendRecord) => <span className="font-mono text-blue-600">{r.trend_id}</span> },
    { key: 'period', header: 'Review Period', render: (r: ComplaintTrendRecord) => `${r.review_period_from} → ${r.review_period_to}` },
    { key: 'total', header: 'Total', render: (r: ComplaintTrendRecord) => r.total_complaints },
    { key: 'trend_status', header: 'Status', render: (r: ComplaintTrendRecord) => <ComplaintTrendStatusBadge status={r.trend_status} /> },
    { key: 'risk', header: 'Risk', render: (r: ComplaintTrendRecord) => <ComplaintTrendRiskBadge level={r.risk_level} /> },
    { key: 'generated', header: 'Generated', render: (r: ComplaintTrendRecord) => r.generated_date },
    { key: 'approved', header: 'Approved', render: (r: ComplaintTrendRecord) => r.approved_by_name || '—' },
    {
      key: 'actions',
      header: 'Action',
      render: (r: ComplaintTrendRecord) => (
        !r.approved_by && canApprove ? (
          <Button variant="outline" size="sm" onClick={() => void handleApprove(r.id)}>
            <CheckCircle className="mr-1 h-3 w-3" /> Approve
          </Button>
        ) : null
      ),
    },
  ], [canApprove, handleApprove]);

  return (
    <ComplaintTrendAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Complaint Trend Analysis"
          description="Analyze complaint trends by product, batch, market, customer, category, criticality, root cause, CAPA linkage, recall evaluation, and closure performance"
          trail={[
            { label: 'QMS', href: '/qms/complaints' },
            { label: 'Complaint Management', href: '/qms/complaints' },
            { label: 'Trend Analysis' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              {canExport && (
                <Button variant="outline" size="sm" onClick={() => void handleExport()}>
                  <Download className="mr-1 h-4 w-4" /> Export Report
                </Button>
              )}
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <Tabs defaultValue="workspace">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="workspace">Trend Workspace</TabsTrigger>
              <TabsTrigger value="saved">Saved Trends ({savedTrends.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="workspace" className="mt-4 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Filter Panel</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Review Period From *</Label>
                    <Input type="date" value={reviewFrom} onChange={(e) => setReviewFrom(e.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-1">
                    <Label>Review Period To *</Label>
                    <Input type="date" value={reviewTo} onChange={(e) => setReviewTo(e.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select value={product} onValueChange={setProduct} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Market Region</Label>
                    <Select value={marketRegion} onValueChange={setMarketRegion} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Complaint Category</Label>
                    <Select value={category} onValueChange={setCategory} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMPLAINT_TREND_FILTER_OPTIONS.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Criticality</Label>
                    <Select value={criticality} onValueChange={setCriticality} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMPLAINT_TREND_FILTER_OPTIONS.criticalities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Root Cause Category</Label>
                    <Select value={rootCause} onValueChange={setRootCause} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {rootCauses.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end sm:col-span-2 lg:col-span-4">
                    {!readOnly && (
                      <Button onClick={() => void runGenerate()} disabled={generating}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        Generate Complaint Trend
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {!analysis ? (
                <EmptyState
                  title="No trend generated"
                  message="Set review period and filters, then click Generate Complaint Trend to analyze complaint data."
                />
              ) : analysis.filtered_count === 0 ? (
                <EmptyState
                  title="Insufficient data"
                  message="No complaints match the selected review period and filters. Adjust filters and try again."
                />
              ) : (
                <>
                  {analysis.alerts.length > 0 && (
                    <div className="space-y-2">
                      {analysis.alerts.map((alert) => (
                        <Alert key={alert} variant={/critical|product risk|repeat complaint/i.test(alert) ? 'destructive' : 'default'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Auto Rule Alert</AlertTitle>
                          <AlertDescription>{alert}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <ComplaintTrendStatusBadge status={analysis.trend_status} />
                    <ComplaintTrendRiskBadge level={analysis.risk_level} />
                    <span className="text-sm text-muted-foreground">
                      Target closure: {COMPLAINT_CLOSURE_TARGET_DAYS} days
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                    <KpiCard label="Total Complaints" value={metrics?.total ?? 0} />
                    <KpiCard label="Open" value={metrics?.open ?? 0} tone="amber" />
                    <KpiCard label="Closed" value={metrics?.closed ?? 0} tone="green" />
                    <KpiCard label="Repeat" value={metrics?.repeatComplaints ?? 0} tone="amber" />
                    <KpiCard label="Critical" value={metrics?.critical ?? 0} tone="red" />
                    <KpiCard label="CAPA Linked" value={metrics?.capaLinked ?? 0} tone="blue" />
                    <KpiCard label="Recall Eval." value={metrics?.recallEvaluationRequired ?? 0} tone="red" />
                    <KpiCard label="Avg Closure Days" value={metrics?.avgClosureDays ?? 0} />
                  </div>

                  <ComplaintTrendCharts charts={analysis.charts} />

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Narrative Conclusion & Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <Label>Conclusion</Label>
                        <Textarea
                          rows={4}
                          value={conclusion}
                          onChange={(e) => setConclusion(e.target.value)}
                          disabled={readOnly || !canGenerate}
                          placeholder="Summarize complaint trend findings for QA review..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Recommendation</Label>
                        <Textarea
                          rows={4}
                          value={recommendation}
                          onChange={(e) => setRecommendation(e.target.value)}
                          disabled={readOnly || !canGenerate}
                          placeholder="Document CAPA suggestions, recall evaluation, and monitoring plans..."
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>PQR Summary</Label>
                          <Textarea rows={3} value={pqrSummary} onChange={(e) => setPqrSummary(e.target.value)} disabled={readOnly || !canGenerate} />
                        </div>
                        <div className="space-y-1">
                          <Label>Management Dashboard Summary</Label>
                          <Textarea rows={3} value={managementSummary} onChange={(e) => setManagementSummary(e.target.value)} disabled={readOnly || !canGenerate} />
                        </div>
                      </div>
                      {canGenerate && !readOnly && (
                        <Button onClick={() => void handleSave()} disabled={saving}>
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? 'Saving...' : 'Save Trend Record'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="saved" className="mt-4">
              {savedTrends.length ? (
                <ResponsiveDataTable
                  columns={savedColumns}
                  data={savedTrends}
                  mobileTitleKey="trend_id"
                  mobileSubtitleKey="generated_date"
                  pageSize={10}
                />
              ) : (
                <EmptyState title="No saved trends" message="Generate and save a trend analysis to build historical records for PQR and management dashboard." />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ComplaintTrendAccessGuard>
  );
}
