'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Pencil, CheckCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeCqaResults, buildCqaChartSeries, CQA_TEST_STAGES, CQA_RESULT_STATUSES,
  type CqaResultFormData, type CqaResultRecord,
} from '@/lib/cpv-cqa-monitoring';
import {
  fetchCqaResults, fetchCqaBatchesForProduct,
  fetchCqaParametersForProduct, createCqaResult, updateCqaResult,
  approveCqaResult, reviewCqaResult, bulkCreateCqaResults,
  logCqaExport, parameterTrendData,
} from '@/lib/cpv-cqa-monitoring-service';
import { fetchActiveCpvProductsForBatch as fetchProducts } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import type { Parameter } from '@/lib/admin/schemas';
import { normalizeParameter } from '@/lib/admin/parameter-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { ParameterTrendChart } from '@/components/cpv/cpp-monitoring/parameter-trend-chart';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ColumnDef } from '@/components/admin/admin-data-table';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : level === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

export function CqaMonitoringPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const isMicroOnly = cpvPermissions.isCqaMicrobiologyOnly(role);
  const canCreate = (cpvPermissions.canEnterCqa(role) || cpvPermissions.canEnterMicrobiologyCqa(role))
    && !cpvPermissions.isCqaViewOnly(role);
  const canReview = cpvPermissions.canReviewCqa(role);
  const canImportExport = cpvPermissions.canImportExportCqa(role);
  const canQaOverride = cpvPermissions.canReviewCqa(role);
  const isReadOnly = cpvPermissions.isReadOnly(role) || cpvPermissions.isCqaViewOnly(role);

  const [results, setResults] = useState<CqaResultRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<CqaResultRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [trendParam, setTrendParam] = useState('all');

  const [formProductId, setFormProductId] = useState('');
  const [formBatches, setFormBatches] = useState<Awaited<ReturnType<typeof fetchCqaBatchesForProduct>>>([]);
  const [formParams, setFormParams] = useState<Parameter[]>([]);
  const [form, setForm] = useState<Partial<CqaResultFormData>>({});

  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkStage, setBulkStage] = useState<string>(CQA_TEST_STAGES[0]);
  const [bulkRows, setBulkRows] = useState<Array<{ param: Parameter; observed: string; remarks: string }>>([]);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods] = await Promise.all([fetchCqaResults(), fetchProducts()]);
      setResults(rows);
      setProducts(prods);
    } catch {
      setError('Failed to load CQA results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return results.filter((r) => {
      if (productFilter !== 'all' && r.productName !== productFilter) return false;
      if (batchFilter !== 'all' && r.batchNumber !== batchFilter) return false;
      if (stageFilter !== 'all' && r.testStage !== stageFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.batchNumber.toLowerCase().includes(q) || r.parameterName.toLowerCase().includes(q);
    });
  }, [results, search, productFilter, batchFilter, stageFilter, statusFilter, riskFilter]);

  const summary = useMemo(() => summarizeCqaResults(results), [results]);
  const charts = useMemo(() => buildCqaChartSeries(filtered), [filtered]);
  const productNames = useMemo(() => Array.from(new Set(results.map((r) => r.productName))), [results]);
  const batchNumbers = useMemo(() => Array.from(new Set(results.map((r) => r.batchNumber))), [results]);
  const paramNames = useMemo(() => Array.from(new Set(results.map((r) => r.parameterName))), [results]);
  const trendData = useMemo(() => trendParam !== 'all' ? parameterTrendData(filtered, trendParam) : [], [filtered, trendParam]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      testDate: new Date().toISOString(),
      analyst: profile?.full_name || '',
      testStage: CQA_TEST_STAGES[0],
      resultType: 'Numeric',
      criticality: 'Major',
    });
    setFormOpen(true);
  };

  const onFormProductChange = async (productId: string) => {
    setFormProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      cpvProductId: productId,
      productName: p.productName,
      productCode: p.productCode,
      manufacturingDate: f.manufacturingDate || new Date().toISOString().split('T')[0],
    }));
    const [batches, params] = await Promise.all([
      fetchCqaBatchesForProduct(p.productName),
      fetchCqaParametersForProduct(p.productName, productId, isMicroOnly),
    ]);
    setFormBatches(batches);
    setFormParams(params);
  };

  const onFormBatchChange = async (batchNumber: string) => {
    const batch = formBatches.find((b) => b.batchNumber === batchNumber);
    setForm((f) => ({
      ...f,
      batchNumber,
      manufacturingDate: batch?.manufacturingDate || f.manufacturingDate,
    }));
  };

  const onFormParamChange = (paramId: string) => {
    const p = formParams.find((x) => x.id === paramId);
    if (!p) return;
    const n = normalizeParameter(p);
    setForm((f) => ({
      ...f,
      parameterId: paramId,
      parameterCode: n.parameterCode,
      parameterName: n.parameterName,
      parameterCategory: n.parameterCategory,
      specificationNumber: n.specificationNo || '',
      stpNumber: n.testMethodStp || '',
      lowerLimit: Number(n.lsl || n.lowerLimit) || 0,
      upperLimit: Number(n.usl || n.upperLimit) || 0,
      targetValue: Number(n.target || n.targetValue) || 0,
      unit: n.unit,
      resultType: (n.resultType as CqaResultFormData['resultType']) || 'Numeric',
      criticality: (n.criticality as CqaResultFormData['criticality']) || 'Major',
      alertLimitLow: n.alertLimitLow ? Number(n.alertLimitLow) : undefined,
      alertLimitHigh: n.alertLimitHigh ? Number(n.alertLimitHigh) : undefined,
      actionLimitLow: n.actionLimitLow ? Number(n.actionLimitLow) : undefined,
      actionLimitHigh: n.actionLimitHigh ? Number(n.actionLimitHigh) : undefined,
    }));
  };

  const saveForm = async () => {
    if (!form.cpvProductId || !form.batchNumber || !form.parameterCode || !form.observedResult) {
      toast.error('Complete required fields');
      return;
    }
    setSubmitting(true);
    const data = form as CqaResultFormData;
    if (editing) {
      const qaOverride = editing.isLocked && editing.reviewStatus === 'Approved' && canQaOverride;
      const { error: err } = await updateCqaResult(editing.id, data, actor, editing, qaOverride);
      if (err) toast.error(err);
      else { toast.success('CQA result updated'); setFormOpen(false); await load(); }
    } else {
      const { error: err } = await createCqaResult(data, actor);
      if (err) toast.error(err);
      else { toast.success('CQA result created'); setFormOpen(false); await load(); }
    }
    setSubmitting(false);
  };

  const openBulk = async (productId: string) => {
    setBulkProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const params = await fetchCqaParametersForProduct(p.productName, productId, isMicroOnly);
    setBulkRows(params.map((param) => ({ param, observed: '', remarks: '' })));
    const batches = await fetchCqaBatchesForProduct(p.productName);
    setFormBatches(batches);
    setBulkOpen(true);
  };

  const saveBulk = async () => {
    const p = products.find((x) => x.id === bulkProductId);
    if (!p || !bulkBatchId) { toast.error('Select product and batch'); return; }
    const batch = formBatches.find((b) => b.id === bulkBatchId);
    if (!batch) { toast.error('Invalid batch'); return; }
    const rows: CqaResultFormData[] = bulkRows.filter((r) => r.observed).map((row) => {
      const n = normalizeParameter(row.param);
      const isQual = (n.resultType === 'Pass/Fail' || n.resultType === 'Complies/Does Not Comply');
      return {
        cpvProductId: bulkProductId,
        productName: p.productName,
        productCode: p.productCode,
        batchNumber: batch.batchNumber,
        manufacturingDate: batch.manufacturingDate,
        testStage: bulkStage,
        parameterId: row.param.id || '',
        parameterCode: n.parameterCode,
        parameterName: n.parameterName,
        parameterCategory: n.parameterCategory,
        specificationNumber: n.specificationNo || '',
        stpNumber: n.testMethodStp || '',
        observedResult: isQual ? row.observed : Number(row.observed),
        targetValue: Number(n.target || n.targetValue) || 0,
        lowerLimit: Number(n.lsl) || 0,
        upperLimit: Number(n.usl) || 0,
        unit: n.unit,
        resultType: (n.resultType as CqaResultFormData['resultType']) || 'Numeric',
        criticality: (n.criticality as CqaResultFormData['criticality']) || 'Major',
        testDate: new Date().toISOString(),
        analyst: profile?.full_name || '',
        reviewedBy: '',
        reviewDate: '',
        remarks: row.remarks,
      };
    });
    setSubmitting(true);
    const { created, errors } = await bulkCreateCqaResults(rows, actor);
    setSubmitting(false);
    if (errors.length) toast.error(errors[0]);
    toast.success(`${created} CQA results saved`);
    setBulkOpen(false);
    await load();
  };

  const columns: ColumnDef<CqaResultRecord>[] = [
    { key: 'batchNumber', header: 'Batch' },
    { key: 'parameterName', header: 'Parameter' },
    { key: 'testStage', header: 'Test Stage' },
    { key: 'observedResult', header: 'Result' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
    { key: 'reviewStatus', header: 'Review' },
  ];

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="CQA Monitoring"
        description="Monitor Critical Quality Attributes batch-wise for Continued Process Verification"
        trail={[{ label: 'Continued Process Verification', href: '/cpv/dashboard' }, { label: 'CQA Monitoring' }]}
        actions={
          <>
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info('Excel import placeholder — upload template coming soon')}>
                Import Excel
              </Button>
            )}
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                const headers = ['Batch', 'Parameter', 'Result', 'Status', 'Risk'];
                const rows = filtered.map((r) => [r.batchNumber, r.parameterName, r.observedResult, r.status, r.riskLevel]);
                downloadCsv(`cqa-results-${Date.now()}.csv`, headers, rows);
                await logCqaExport(actor, filtered.length);
                toast.success('Export placeholder CSV generated');
              }}>
                <Download className="h-4 w-4" />Export
              </Button>
            )}
            {canCreate && !isReadOnly && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => products[0] && openBulk(products[0].id)}>
                  <Layers className="h-4 w-4" />Bulk Entry
                </Button>
                <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />New CQA Result</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        <KpiCard label="Total Results" value={summary.total} tone="blue" />
        <KpiCard label="Compliant" value={summary.compliant} tone="green" />
        <KpiCard label="Alert" value={summary.alert} tone="amber" />
        <KpiCard label="Action" value={summary.action} tone="amber" />
        <KpiCard label="OOS" value={summary.oos} tone="red" />
        <KpiCard label="High Risk" value={summary.highRisk} tone="red" />
        <KpiCard label="Critical Risk" value={summary.criticalRisk} tone="red" />
        <KpiCard label="OOS Triggered" value={summary.oosTriggered} tone="amber" />
        <KpiCard label="CAPA Suggested" value={summary.capaSuggested} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">CQA Compliance Trend</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {charts.complianceTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.complianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip />
                  <Line type="monotone" dataKey="rate" name="Compliance %" stroke={CHART_COLORS[0]} strokeWidth={2} /></LineChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No trend data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {charts.riskDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={charts.riskDistribution} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={80} label>
                  {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No risk data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Test Stage OOS</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {charts.stageOos.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.stageOos}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stage" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill={CHART_COLORS[2]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No OOS data" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Parameter Trend</CardTitle>
            <Select value={trendParam} onValueChange={setTrendParam}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Parameter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Select parameter</SelectItem>
                {paramNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent><ParameterTrendChart data={trendData} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Batch-wise CQA Health</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {charts.batchHealth.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.batchHealth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="batch" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
                <Bar dataKey="health" name="Health %" fill={CHART_COLORS[1]} /></BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No batch health data" />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Assay Trend</CardTitle></CardHeader>
          <CardContent><ParameterTrendChart data={charts.assayTrend} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">pH Trend</CardTitle></CardHeader>
          <CardContent><ParameterTrendChart data={charts.phTrend} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Extractable Volume</CardTitle></CardHeader>
          <CardContent><ParameterTrendChart data={charts.extractableVolumeTrend} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Particulate Matter</CardTitle></CardHeader>
          <CardContent><ParameterTrendChart data={charts.particulateMatterTrend} /></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-6">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="lg:col-span-2" />
            <Select value={productFilter} onValueChange={setProductFilter}><SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Products</SelectItem>{productNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
            <Select value={batchFilter} onValueChange={setBatchFilter}><SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Batches</SelectItem>{batchNumbers.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{CQA_RESULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Stages</SelectItem>{CQA_TEST_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}><SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Risk</SelectItem>{['Low', 'Medium', 'High', 'Critical'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          </div>
          {filtered.length === 0 ? <EmptyState title="No CQA results" /> : (
            <ResponsiveDataTable
              columns={columns}
              data={filtered}
              pageSize={10}
              onRowClick={(r) => router.push(`/cpv/cqa/${r.id}`)}
              actions={(row) => (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => router.push(`/cpv/cqa/${row.id}`)}><Eye className="h-4 w-4" /></Button>
                  {canCreate && !isReadOnly && (!row.isLocked || canQaOverride) && (
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditing(row);
                      setForm(row);
                      setFormProductId(row.cpvProductId);
                      void onFormProductChange(row.cpvProductId);
                      setFormOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Draft' && (
                    <Button size="icon" variant="ghost" onClick={async () => { await reviewCqaResult(row.id, actor, row); await load(); }}><CheckCircle className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Under Review' && (
                    <Button size="sm" variant="outline" onClick={async () => { await approveCqaResult(row.id, actor, row); await load(); }}>Approve</Button>
                  )}
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit CQA Result' : 'New CQA Result'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-3">
            {!editing && (
              <div><Label>CPV Product *</Label>
                <Select value={formProductId} onValueChange={(v) => void onFormProductChange(v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Batch *</Label>
              <Select value={form.batchNumber || ''} onValueChange={(v) => void onFormBatchChange(v)} disabled={Boolean(editing?.isLocked)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Batch" /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.batchNumber}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Test Stage *</Label>
              <Select value={form.testStage || ''} onValueChange={(v) => setForm((f) => ({ ...f, testStage: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CQA_TEST_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Parameter *</Label>
              <Select value={form.parameterId || ''} onValueChange={onFormParamChange} disabled={Boolean(editing)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Parameter" /></SelectTrigger>
                <SelectContent>{formParams.map((p) => <SelectItem key={p.id} value={p.id || ''}>{p.parameterName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Spec No</Label><Input className="mt-1" value={form.specificationNumber || ''} readOnly /></div>
              <div><Label>STP No</Label><Input className="mt-1" value={form.stpNumber || ''} readOnly /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.resultType === 'Pass/Fail' || form.resultType === 'Complies/Does Not Comply' ? (
                <div><Label>Observed Result *</Label>
                  <Select value={String(form.observedResult ?? '')} onValueChange={(v) => setForm((f) => ({ ...f, observedResult: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {form.resultType === 'Pass/Fail' ? (
                        <><SelectItem value="Pass">Pass</SelectItem><SelectItem value="Fail">Fail</SelectItem></>
                      ) : (
                        <><SelectItem value="Complies">Complies</SelectItem><SelectItem value="Does Not Comply">Does Not Comply</SelectItem></>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div><Label>Observed Result *</Label><Input className="mt-1" value={String(form.observedResult ?? '')} onChange={(e) => setForm((f) => ({ ...f, observedResult: e.target.value }))} /></div>
              )}
              <div><Label>Unit</Label><Input className="mt-1" value={form.unit || ''} readOnly /></div>
              <div><Label>LSL</Label><Input className="mt-1" type="number" value={form.lowerLimit ?? ''} readOnly /></div>
              <div><Label>USL</Label><Input className="mt-1" type="number" value={form.upperLimit ?? ''} readOnly /></div>
            </div>
            <div><Label>Test Date *</Label><Input className="mt-1" type="datetime-local" value={form.testDate?.slice(0, 16) || ''} onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))} /></div>
            <div><Label>Analyst *</Label><Input className="mt-1" value={form.analyst || ''} onChange={(e) => setForm((f) => ({ ...f, analyst: e.target.value }))} /></div>
            <div><Label>Remarks</Label><Textarea className="mt-1" value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveForm()} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk CQA Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3 py-2">
            <div><Label>Product</Label>
              <Select value={bulkProductId} onValueChange={async (v) => {
                setBulkProductId(v);
                const p = products.find((x) => x.id === v);
                if (p) {
                  const batches = await fetchCqaBatchesForProduct(p.productName);
                  setFormBatches(batches);
                  const params = await fetchCqaParametersForProduct(p.productName, v, isMicroOnly);
                  setBulkRows(params.map((param) => ({ param, observed: '', remarks: '' })));
                }
              }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Batch</Label>
              <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Test Stage</Label>
              <Select value={bulkStage} onValueChange={setBulkStage}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CQA_TEST_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Parameter</TableHead><TableHead>Spec/STP</TableHead><TableHead>Target</TableHead>
              <TableHead>LCL/UCL</TableHead><TableHead>Result</TableHead><TableHead>Remarks</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bulkRows.map((row, i) => {
                const n = normalizeParameter(row.param);
                const isQual = n.resultType === 'Pass/Fail' || n.resultType === 'Complies/Does Not Comply';
                return (
                  <TableRow key={row.param.id || i}>
                    <TableCell>{n.parameterName}</TableCell>
                    <TableCell className="text-xs">{n.specificationNo}/{n.testMethodStp}</TableCell>
                    <TableCell>{n.target || n.targetValue}</TableCell>
                    <TableCell>{n.lsl}/{n.usl}</TableCell>
                    <TableCell>
                      {isQual ? (
                        <Select value={row.observed} onValueChange={(v) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, observed: v } : r))}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {n.resultType === 'Pass/Fail' ? (
                              <><SelectItem value="Pass">Pass</SelectItem><SelectItem value="Fail">Fail</SelectItem></>
                            ) : (
                              <><SelectItem value="Complies">Complies</SelectItem><SelectItem value="Does Not Comply">Does Not Comply</SelectItem></>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={row.observed} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, observed: e.target.value } : r))} />
                      )}
                    </TableCell>
                    <TableCell><Input value={row.remarks} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, remarks: e.target.value } : r))} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveBulk()} disabled={submitting}>Save All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
