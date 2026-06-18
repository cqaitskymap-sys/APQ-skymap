'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Save, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  RECALL_TREND_FILTER_OPTIONS,
  RECALL_CLOSURE_TARGET_DAYS,
  recallTrendFilterSchema,
  type RecallTrendAnalysisResult,
} from '@/lib/recall-trend-records';
import {
  approveRecallTrend,
  exportRecallTrendReportPlaceholder,
  fetchRecallTrendMarketOptions,
  fetchRecallTrendProductOptions,
  generateRecallTrend,
  listSavedRecallTrends,
  logRecallTrendExport,
  logRecallTrendFilterApplied,
  logRecallTrendRecommendationGenerated,
  saveRecallTrend,
} from '@/lib/recall-trend-service';
import {
  canApproveRecallTrend,
  canExportRecallTrend,
  canGenerateRecallTrend,
  canGenerateRecallTrendRegulatory,
  isRecallTrendReadOnly,
} from '@/lib/recall-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { RecallTrendAccessGuard } from './recall-trend-access-guard';
import { RecallTrendRiskBadge, RecallTrendStatusBadge } from './recall-trend-badges';
import { RecallTrendCharts } from './recall-trend-charts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RecallTrendRecord } from '@/lib/recall-types';

const defaultFrom = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
};
const defaultTo = () => new Date().toISOString().split('T')[0];

export function RecallTrendAnalysisPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canGenerate = canGenerateRecallTrend(role) || canGenerateRecallTrendRegulatory(role);
  const canApprove = canApproveRecallTrend(role);
  const canExport = canExportRecallTrend(role);
  const readOnly = isRecallTrendReadOnly(role);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTrends, setSavedTrends] = useState<RecallTrendRecord[]>([]);
  const [products, setProducts] = useState<string[]>(['All']);
  const [markets, setMarkets] = useState<string[]>(['All']);
  const [analysis, setAnalysis] = useState<RecallTrendAnalysisResult | null>(null);

  const [reviewFrom, setReviewFrom] = useState(defaultFrom);
  const [reviewTo, setReviewTo] = useState(defaultTo);
  const [product, setProduct] = useState('All');
  const [marketRegion, setMarketRegion] = useState('All');
  const [recallType, setRecallType] = useState('All');
  const [recallClassification, setRecallClassification] = useState('All');
  const [recallSource, setRecallSource] = useState('All');
  const [conclusion, setConclusion] = useState('');
  const [recommendation, setRecommendation] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: role || '',
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trends, prods, mkts] = await Promise.all([
        listSavedRecallTrends(),
        fetchRecallTrendProductOptions(),
        fetchRecallTrendMarketOptions(),
      ]);
      setSavedTrends(trends);
      setProducts(prods);
      setMarkets(mkts);
    } catch {
      setError('Failed to load trend workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMeta(); }, [loadMeta]);

  const filterPayload = useMemo(() => ({
    review_period_from: reviewFrom,
    review_period_to: reviewTo,
    product,
    market_region: marketRegion,
    recall_type: recallType,
    recall_classification: recallClassification,
    recall_source: recallSource,
  }), [reviewFrom, reviewTo, product, marketRegion, recallType, recallClassification, recallSource]);

  const runGenerate = async () => {
    const parsed = recallTrendFilterSchema.safeParse(filterPayload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid filters');
      return;
    }
    if (!canGenerate) {
      toast.error('You do not have permission to generate trends');
      return;
    }
    setGenerating(true);
    try {
      const result = await generateRecallTrend(parsed.data);
      setAnalysis(result);
      setConclusion(result.conclusion_draft);
      setRecommendation(result.recommendation_draft);
      await logRecallTrendFilterApplied(actor, parsed.data);
      if (result.filtered_count === 0) {
        toast.message('No recall records match filters — empty state shown');
      } else {
        toast.success(`Trend generated from ${result.filtered_count} recall record(s)`);
      }
    } catch {
      toast.error('Failed to generate trend');
    } finally {
      setGenerating(false);
    }
  };

  const runSave = async () => {
    if (!analysis || analysis.filtered_count === 0) {
      toast.error('Generate a trend with data before saving');
      return;
    }
    if (!conclusion.trim() || !recommendation.trim()) {
      toast.error('Conclusion and recommendation are required');
      return;
    }
    setSaving(true);
    const result = await saveRecallTrend(
      filterPayload,
      { ...filterPayload, conclusion, recommendation },
      actor,
    );
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Trend record saved');
      await loadMeta();
    }
  };

  const runRegenerateRecommendation = async () => {
    if (!analysis) return;
    setRecommendation(analysis.recommendation_draft);
    await logRecallTrendRecommendationGenerated(actor, analysis.recommendation_draft);
    toast.success('Recommendation regenerated from trend rules');
  };

  const runExport = async () => {
    if (!canExport) return toast.error('Export not permitted');
    await logRecallTrendExport(actor, analysis ? 'workspace' : 'empty');
    if (analysis && analysis.filtered_count > 0) {
      exportRecallTrendReportPlaceholder(analysis, filterPayload);
      toast.success('Trend report exported (CSV placeholder)');
    } else {
      toast.message('Export trend report — placeholder (generate a trend first)');
    }
  };

  const savedColumns = [
    { key: 'trend_id', header: 'Trend ID', render: (r: RecallTrendRecord) => <span className="font-mono text-blue-600">{r.trend_id}</span> },
    { key: 'period', header: 'Period', render: (r: RecallTrendRecord) => `${r.review_period_from} → ${r.review_period_to}` },
    { key: 'total', header: 'Total Recalls', render: (r: RecallTrendRecord) => r.total_recalls },
    { key: 'status', header: 'Trend Status', render: (r: RecallTrendRecord) => <RecallTrendStatusBadge status={r.trend_status} /> },
    { key: 'risk', header: 'Risk', render: (r: RecallTrendRecord) => <RecallTrendRiskBadge level={r.risk_level} /> },
    { key: 'generated', header: 'Generated', render: (r: RecallTrendRecord) => r.generated_date },
    { key: 'approve', header: '', render: (r: RecallTrendRecord) => (
      canApprove && !r.approved_by && r.id ? (
        <Button size="sm" variant="outline" onClick={async () => {
          const res = await approveRecallTrend(r.id!, actor);
          if (res.error) toast.error(res.error);
          else { toast.success('Trend approved'); await loadMeta(); }
        }}>Approve</Button>
      ) : r.approved_by_name ? <span className="text-xs text-green-700">Approved</span> : null
    ) },
  ];

  return (
    <RecallTrendAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Recall Trend Analysis"
          description="Analyze recall trends by product, batch, market, type, classification, source, recovery, CAPA linkage and regulatory notification status"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/recall' },
            { label: 'Product Recall', href: '/qms/recall' },
            { label: 'Trend Analysis' },
          ]}
          actions={(
            <>
              <Button variant="outline" size="sm" onClick={() => void loadMeta()} disabled={loading}>
                <RefreshCw className="mr-1 h-4 w-4" />Refresh
              </Button>
              {canExport && (
                <Button variant="outline" size="sm" onClick={runExport}>
                  <Download className="mr-1 h-4 w-4" />Export
                </Button>
              )}
            </>
          )}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={loadMeta} />
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Filter Panel</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label>Review From *</Label><Input type="date" value={reviewFrom} onChange={(e) => setReviewFrom(e.target.value)} disabled={readOnly} /></div>
                <div><Label>Review To *</Label><Input type="date" value={reviewTo} onChange={(e) => setReviewTo(e.target.value)} disabled={readOnly} /></div>
                <div><Label>Product</Label>
                  <Select value={product} onValueChange={setProduct} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Market / Region</Label>
                  <Select value={marketRegion} onValueChange={setMarketRegion} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Recall Type</Label>
                  <Select value={recallType} onValueChange={setRecallType} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECALL_TREND_FILTER_OPTIONS.types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Recall Classification</Label>
                  <Select value={recallClassification} onValueChange={setRecallClassification} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECALL_TREND_FILTER_OPTIONS.classifications.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Recall Source</Label>
                  <Select value={recallSource} onValueChange={setRecallSource} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECALL_TREND_FILTER_OPTIONS.sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {canGenerate && !readOnly && (
                  <div className="flex items-end">
                    <Button onClick={runGenerate} disabled={generating} className="w-full">
                      {generating ? 'Generating…' : 'Generate Recall Trend'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {analysis && analysis.filtered_count === 0 && (
              <EmptyState title="No recall data for selected filters" message="Adjust review period or filters and regenerate. The workspace will not crash on empty data." />
            )}

            {analysis && analysis.filtered_count > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <KpiCard label="Total Recalls" value={analysis.metrics.total} icon={CheckCircle2} />
                <KpiCard label="Open Recalls" value={analysis.metrics.open} icon={AlertTriangle} accent="border-l-amber-500" />
                <KpiCard label="Closed Recalls" value={analysis.metrics.closed} icon={CheckCircle2} accent="border-l-green-600" />
                <KpiCard label="Class I" value={analysis.metrics.classI} accent="border-l-red-600" />
                <KpiCard label="Avg Recovery %" value={`${analysis.metrics.avgRecoveryPercent}%`} accent="border-l-green-600" />
                <KpiCard label="CAPA Linked" value={analysis.metrics.capaLinkedCount} accent="border-l-violet-600" />
                <KpiCard label="Regulatory Ntf." value={analysis.metrics.regulatoryNotificationCount} accent="border-l-indigo-600" />
                <KpiCard label={`Closure (${RECALL_CLOSURE_TARGET_DAYS}d)`} value={analysis.metrics.avgClosureDays <= RECALL_CLOSURE_TARGET_DAYS ? 'OK' : 'Over'} accent="border-l-purple-600" />
              </div>
            )}

            {analysis && (
              <div className="flex flex-wrap items-center gap-2">
                <RecallTrendStatusBadge status={analysis.trend_status} />
                <RecallTrendRiskBadge level={analysis.risk_level} />
                <span className="text-sm text-muted-foreground">{analysis.filtered_count} record(s) analyzed</span>
              </div>
            )}

            {analysis?.alerts.length ? (
              <Alert variant="destructive">
                <AlertTitle>Trend Alerts</AlertTitle>
                <AlertDescription><ul className="list-disc pl-4">{analysis.alerts.map((a) => <li key={a}>{a}</li>)}</ul></AlertDescription>
              </Alert>
            ) : null}

            <Tabs defaultValue="charts">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="narrative">Conclusion & Recommendation</TabsTrigger>
                <TabsTrigger value="saved">Saved Trends ({savedTrends.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="charts" className="mt-4">
                {analysis ? <RecallTrendCharts analysis={analysis} /> : (
                  <EmptyState title="No trend generated" message="Apply filters and click Generate Recall Trend to analyze data." />
                )}
              </TabsContent>

              <TabsContent value="narrative" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Narrative Conclusion Editor</CardTitle>
                    {analysis && canGenerate && !readOnly && (
                      <Button variant="outline" size="sm" onClick={runRegenerateRecommendation} className="gap-1">
                        <Sparkles className="h-4 w-4" />Regenerate Recommendation
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div><Label>Conclusion</Label><Textarea rows={4} value={conclusion} onChange={(e) => setConclusion(e.target.value)} disabled={readOnly} /></div>
                    <div><Label>Recommendation</Label><Textarea rows={4} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} disabled={readOnly} /></div>
                    {canGenerate && !readOnly && analysis && analysis.filtered_count > 0 && (
                      <Button onClick={runSave} disabled={saving} className="gap-1">
                        <Save className="h-4 w-4" />Save Trend Record
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="saved" className="mt-4">
                {savedTrends.length ? (
                  <ResponsiveDataTable columns={savedColumns} data={savedTrends} mobileTitleKey="trend_id" mobileSubtitleKey="trend_status" pageSize={10} />
                ) : (
                  <EmptyState title="No saved trends" message="Save a generated trend to persist analysis for PQR and management review." />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RecallTrendAccessGuard>
  );
}
