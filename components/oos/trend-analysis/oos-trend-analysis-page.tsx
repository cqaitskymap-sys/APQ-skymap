'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, RefreshCw, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CLOSURE_TARGET_DAYS,
  OOS_TREND_ROOT_CAUSES,
  canApproveOosTrend,
  canExportOosTrend,
  canGenerateOosTrend,
  isOosTrendReadOnly,
  oosTrendFilterSchema,
  type OosTrendAnalysisResult,
} from '@/lib/oos-trend-records';
import {
  approveOosTrend,
  fetchOosTrendDepartmentOptions,
  fetchOosTrendParameterOptions,
  fetchOosTrendProductOptions,
  fetchOosTrendTestOptions,
  generateOosTrend,
  listSavedOosTrends,
  logOosTrendExport,
  logOosTrendFilterApplied,
  logOosTrendRecommendationGenerated,
  saveOosTrend,
} from '@/lib/oos-trend-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { OosTrendAccessGuard } from './oos-trend-access-guard';
import { OosTrendRiskBadge, OosTrendStatusBadge } from './oos-trend-badges';
import { OosTrendCharts } from './oos-trend-charts';
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
import type { OosTrendRecord } from '@/lib/oos-types';

const defaultFrom = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
};
const defaultTo = () => new Date().toISOString().split('T')[0];

export function OosTrendAnalysisPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canGenerate = canGenerateOosTrend(role);
  const canApprove = canApproveOosTrend(role);
  const canExport = canExportOosTrend(role);
  const readOnly = isOosTrendReadOnly(role);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTrends, setSavedTrends] = useState<OosTrendRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [products, setProducts] = useState<string[]>(['All']);
  const [tests, setTests] = useState<string[]>(['All']);
  const [parameters, setParameters] = useState<string[]>(['All']);
  const [analysis, setAnalysis] = useState<OosTrendAnalysisResult | null>(null);

  const [reviewFrom, setReviewFrom] = useState(defaultFrom);
  const [reviewTo, setReviewTo] = useState(defaultTo);
  const [department, setDepartment] = useState('All');
  const [product, setProduct] = useState('All');
  const [testName, setTestName] = useState('All');
  const [parameterName, setParameterName] = useState('All');
  const [rootCause, setRootCause] = useState('All');
  const [conclusion, setConclusion] = useState('');
  const [recommendation, setRecommendation] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
  }), [user?.uid, profile?.full_name, role]);

  const filters = useMemo(() => ({
    review_period_from: reviewFrom,
    review_period_to: reviewTo,
    department,
    product,
    test_name: testName,
    parameter_name: parameterName,
    root_cause_category: rootCause,
  }), [reviewFrom, reviewTo, department, product, testName, parameterName, rootCause]);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trends, depts, prods, testOpts, paramOpts] = await Promise.all([
        listSavedOosTrends(),
        fetchOosTrendDepartmentOptions(),
        fetchOosTrendProductOptions(),
        fetchOosTrendTestOptions(),
        fetchOosTrendParameterOptions(),
      ]);
      setSavedTrends(trends);
      setDepartments(depts);
      setProducts(prods);
      setTests(testOpts);
      setParameters(paramOpts);
    } catch {
      setError('Failed to load trend workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMeta(); }, [loadMeta]);

  const runGenerate = async () => {
    const parsed = oosTrendFilterSchema.safeParse(filters);
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
      const result = await generateOosTrend(parsed.data);
      setAnalysis(result);
      setConclusion(result.conclusion_draft);
      setRecommendation(result.recommendation_draft);
      await logOosTrendFilterApplied(actor, parsed.data);
      if (result.filtered_count === 0) {
        toast.message('No OOS records match filters — review empty state');
      } else {
        toast.success(`Trend generated from ${result.filtered_count} OOS record(s)`);
      }
    } catch {
      toast.error('Failed to generate trend');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!analysis || analysis.filtered_count === 0) {
      toast.error('Generate a trend with at least one OOS record before saving');
      return;
    }
    if (!conclusion.trim() || !recommendation.trim()) {
      toast.error('Conclusion and recommendation are required');
      return;
    }
    setSaving(true);
    const { id, error: err } = await saveOosTrend(filters, {
      ...filters,
      department,
      product,
      test_name: testName,
      parameter_name: parameterName,
      root_cause_category: rootCause,
      conclusion,
      recommendation,
    }, actor);
    setSaving(false);
    if (err) toast.error(err);
    else {
      toast.success('Trend record saved for PQR and management dashboard');
      await logOosTrendRecommendationGenerated(actor, id || 'new', recommendation);
      await loadMeta();
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export');
      return;
    }
    await logOosTrendExport(actor, analysis ? 'preview' : 'workspace', 'pdf-placeholder');
    toast.success('Export trend report — placeholder (audit logged)');
  };

  const handleApprove = useCallback(async (id: string) => {
    if (!canApprove) {
      toast.error('Only Head QA can approve trends');
      return;
    }
    const { error: err } = await approveOosTrend(id, actor);
    if (err) toast.error(err);
    else {
      toast.success('Trend approved');
      await loadMeta();
    }
  }, [canApprove, actor, loadMeta]);

  const metrics = analysis?.metrics;
  const savedColumns = useMemo(() => [
    { key: 'trend_id', header: 'Trend ID', render: (r: OosTrendRecord) => <span className="font-mono text-blue-600">{r.trend_id}</span> },
    { key: 'period', header: 'Review Period', render: (r: OosTrendRecord) => `${r.review_period_from} → ${r.review_period_to}` },
    { key: 'total', header: 'Total OOS', render: (r: OosTrendRecord) => r.total_oos },
    { key: 'trend_status', header: 'Status', render: (r: OosTrendRecord) => <OosTrendStatusBadge status={r.trend_status} /> },
    { key: 'risk', header: 'Risk', render: (r: OosTrendRecord) => <OosTrendRiskBadge level={r.risk_level} /> },
    { key: 'generated', header: 'Generated', render: (r: OosTrendRecord) => r.generated_date },
    { key: 'approved', header: 'Approved', render: (r: OosTrendRecord) => r.approved_by_name || '—' },
    {
      key: 'actions',
      header: 'Action',
      render: (r: OosTrendRecord) => (
        !r.approved_by && canApprove ? (
          <Button variant="outline" size="sm" onClick={() => void handleApprove(r.id)}>
            <CheckCircle className="mr-1 h-3 w-3" /> Approve
          </Button>
        ) : null
      ),
    },
  ], [canApprove, handleApprove]);

  return (
    <OosTrendAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Trend Analysis"
          description="Analyze OOS trends by product, batch, test, parameter, department, root cause, phase outcome, CAPA linkage and closure performance"
          trail={[
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'Trend Analysis' },
          ]}
          actions={(
            canExport ? (
              <Button variant="outline" size="sm" onClick={() => void handleExport()}>
                <Download className="mr-1 h-4 w-4" /> Export Report
              </Button>
            ) : null
          )}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <Tabs defaultValue="workspace">
            <TabsList>
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
                    <Label>Department</Label>
                    <Select value={department} onValueChange={setDepartment} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                    <Label>Test Name</Label>
                    <Select value={testName} onValueChange={setTestName} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tests.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Parameter Name</Label>
                    <Select value={parameterName} onValueChange={setParameterName} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {parameters.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Root Cause Category</Label>
                    <Select value={rootCause} onValueChange={setRootCause} disabled={readOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OOS_TREND_ROOT_CAUSES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end sm:col-span-2 lg:col-span-4">
                    {canGenerate && (
                      <Button onClick={() => void runGenerate()} disabled={generating || readOnly}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        Generate OOS Trend
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {!analysis ? (
                <EmptyState
                  title="No trend generated"
                  message="Set review period and filters, then click Generate OOS Trend to analyze OOS data."
                />
              ) : analysis.filtered_count === 0 ? (
                <EmptyState
                  title="Insufficient data"
                  message="No OOS records match the selected review period and filters. Adjust filters and try again."
                />
              ) : (
                <>
                  {analysis.alerts.length > 0 && (
                    <div className="space-y-2">
                      {analysis.alerts.map((alert) => (
                        <Alert key={alert} variant={/critical|risk alert/i.test(alert) ? 'destructive' : 'default'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Auto Rule Alert</AlertTitle>
                          <AlertDescription>{alert}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <OosTrendStatusBadge status={analysis.trend_status} />
                    <OosTrendRiskBadge level={analysis.risk_level} />
                    <span className="text-sm text-muted-foreground">
                      Target closure: {CLOSURE_TARGET_DAYS} days
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                    <KpiCard label="Total OOS" value={metrics?.total ?? 0} />
                    <KpiCard label="Open OOS" value={metrics?.open ?? 0} tone="amber" />
                    <KpiCard label="Closed OOS" value={metrics?.closed ?? 0} tone="green" />
                    <KpiCard label="Phase-I OOS" value={metrics?.phase1 ?? 0} />
                    <KpiCard label="Phase-II OOS" value={metrics?.phase2 ?? 0} />
                    <KpiCard label="Repeat OOS" value={metrics?.repeatOos ?? 0} tone="amber" />
                    <KpiCard label="CAPA Linked" value={metrics?.capaLinked ?? 0} tone="blue" />
                    <KpiCard label="Avg Closure Days" value={metrics?.avgClosureDays ?? 0} />
                  </div>

                  <OosTrendCharts analysis={analysis} />

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
                          disabled={readOnly}
                          placeholder="Summarize OOS trend findings for PQR and management dashboard..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Recommendation</Label>
                        <Textarea
                          rows={4}
                          value={recommendation}
                          onChange={(e) => setRecommendation(e.target.value)}
                          disabled={readOnly}
                          placeholder="Document CAPA suggestions, repeat OOS alerts, and monitoring plans..."
                        />
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
    </OosTrendAccessGuard>
  );
}
