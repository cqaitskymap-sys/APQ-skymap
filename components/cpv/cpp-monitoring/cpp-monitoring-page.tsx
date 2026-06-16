'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Pencil, CheckCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeCppResults, buildChartSeries, CPP_PROCESS_STAGES, CPP_RESULT_STATUSES,
  type CppResultFormData, type CppResultRecord,
} from '@/lib/cpv-cpp-monitoring';
import {
  fetchCppResults, fetchCppBatchesForProduct,
  fetchCppParametersForProduct, createCppResult, updateCppResult,
  approveCppResult, reviewCppResult, bulkCreateCppResults, autofillFromBatch,
  logCppExport, parameterTrendData,
} from '@/lib/cpv-cpp-monitoring-service';
import { fetchActiveCpvProductsForBatch as fetchProducts } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import type { Parameter } from '@/lib/admin/schemas';
import { normalizeParameter } from '@/lib/admin/parameter-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { ParameterTrendChart } from './parameter-trend-chart';
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

export function CppMonitoringPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canEnterCpp(role) && !cpvPermissions.isCppViewOnly(role);
  const canReview = cpvPermissions.canReviewCpp(role);
  const canImportExport = cpvPermissions.canImportExportCpp(role);
  const canQaOverride = cpvPermissions.canReviewCpp(role);
  const isReadOnly = cpvPermissions.isReadOnly(role) || cpvPermissions.isCppViewOnly(role);

  const [results, setResults] = useState<CppResultRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<CppResultRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [trendParam, setTrendParam] = useState('all');

  const [formProductId, setFormProductId] = useState('');
  const [formBatches, setFormBatches] = useState<Awaited<ReturnType<typeof fetchCppBatchesForProduct>>>([]);
  const [formParams, setFormParams] = useState<Parameter[]>([]);
  const [form, setForm] = useState<Partial<CppResultFormData>>({});

  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkStage, setBulkStage] = useState<string>(CPP_PROCESS_STAGES[0]);
  const [bulkRows, setBulkRows] = useState<Array<{ param: Parameter; observed: string; remarks: string }>>([]);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods] = await Promise.all([fetchCppResults(), fetchProducts()]);
      setResults(rows);
      setProducts(prods);
    } catch {
      setError('Failed to load CPP results.');
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
      if (stageFilter !== 'all' && r.processStage !== stageFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.batchNumber.toLowerCase().includes(q) || r.parameterName.toLowerCase().includes(q);
    });
  }, [results, search, productFilter, batchFilter, stageFilter, statusFilter, riskFilter]);

  const summary = useMemo(() => summarizeCppResults(results), [results]);
  const charts = useMemo(() => buildChartSeries(filtered), [filtered]);
  const productNames = useMemo(() => Array.from(new Set(results.map((r) => r.productName))), [results]);
  const batchNumbers = useMemo(() => Array.from(new Set(results.map((r) => r.batchNumber))), [results]);
  const paramNames = useMemo(() => Array.from(new Set(results.map((r) => r.parameterName))), [results]);
  const trendData = useMemo(() => trendParam !== 'all' ? parameterTrendData(filtered, trendParam) : [], [filtered, trendParam]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      observationDateTime: new Date().toISOString(),
      recordedBy: profile?.full_name || '',
      processStage: CPP_PROCESS_STAGES[0],
      resultType: 'Numeric',
      criticality: 'Major',
      frequency: 'Per Batch',
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
      genericName: p.genericName,
      strength: p.strength,
      dosageForm: p.dosageForm,
    }));
    const [batches, params] = await Promise.all([
      fetchCppBatchesForProduct(p.productName),
      fetchCppParametersForProduct(p.productName, productId),
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
      lowerLimit: Number(n.lsl || n.lowerLimit) || 0,
      upperLimit: Number(n.usl || n.upperLimit) || 0,
      targetValue: Number(n.target || n.targetValue) || 0,
      unit: n.unit,
      resultType: (n.resultType as CppResultFormData['resultType']) || 'Numeric',
      criticality: (n.criticality as CppResultFormData['criticality']) || 'Major',
      alertLimitLow: n.alertLimitLow ? Number(n.alertLimitLow) : undefined,
      alertLimitHigh: n.alertLimitHigh ? Number(n.alertLimitHigh) : undefined,
      actionLimitLow: n.actionLimitLow ? Number(n.actionLimitLow) : undefined,
      actionLimitHigh: n.actionLimitHigh ? Number(n.actionLimitHigh) : undefined,
      frequency: n.frequency,
      processStage: n.processStage || f.processStage || CPP_PROCESS_STAGES[0],
    }));
  };

  const saveForm = async () => {
    if (!form.cpvProductId || !form.batchNumber || !form.parameterCode || !form.observedValue) {
      toast.error('Complete required fields');
      return;
    }
    setSubmitting(true);
    const data = form as CppResultFormData;
    if (editing) {
      const qaOverride = editing.isLocked && editing.reviewStatus === 'Approved' && canQaOverride;
      const { error: err } = await updateCppResult(editing.id, data, actor, editing, qaOverride);
      if (err) toast.error(err);
      else { toast.success('CPP result updated'); setFormOpen(false); await load(); }
    } else {
      const { error: err } = await createCppResult(data, actor);
      if (err) toast.error(err);
      else { toast.success('CPP result created'); setFormOpen(false); await load(); }
    }
    setSubmitting(false);
  };

  const openBulk = async (productId: string) => {
    setBulkProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const params = await fetchCppParametersForProduct(p.productName, productId);
    setBulkRows(params.map((param) => ({ param, observed: '', remarks: '' })));
    setBulkOpen(true);
  };

  const saveBulk = async () => {
    const p = products.find((x) => x.id === bulkProductId);
    if (!p || !bulkBatchId) { toast.error('Select product and batch'); return; }
    const batch = formBatches.find((b) => b.id === bulkBatchId) || (await fetchCppBatchesForProduct(p.productName)).find((b) => b.id === bulkBatchId);
    if (!batch) { toast.error('Invalid batch'); return; }
    const rows: CppResultFormData[] = bulkRows.filter((r) => r.observed).map((row) => {
      const n = normalizeParameter(row.param);
      return {
        cpvProductId: bulkProductId,
        productName: p.productName,
        productCode: p.productCode,
        batchNumber: batch.batchNumber,
        manufacturingDate: batch.manufacturingDate,
        processStage: bulkStage,
        parameterId: row.param.id || '',
        parameterCode: n.parameterCode,
        parameterName: n.parameterName,
        parameterCategory: n.parameterCategory,
        observedValue: Number(row.observed),
        targetValue: Number(n.target || n.targetValue) || 0,
        lowerLimit: Number(n.lsl) || 0,
        upperLimit: Number(n.usl) || 0,
        unit: n.unit,
        resultType: (n.resultType as CppResultFormData['resultType']) || 'Numeric',
        frequency: n.frequency,
        criticality: (n.criticality as CppResultFormData['criticality']) || 'Major',
        observationDateTime: new Date().toISOString(),
        recordedBy: profile?.full_name || '',
        reviewedBy: '',
        reviewDate: '',
        remarks: row.remarks,
      };
    });
    setSubmitting(true);
    const { created, errors } = await bulkCreateCppResults(rows, actor);
    setSubmitting(false);
    if (errors.length) toast.error(errors[0]);
    toast.success(`${created} CPP results saved`);
    setBulkOpen(false);
    await load();
  };

  const columns: ColumnDef<CppResultRecord>[] = [
    { key: 'batchNumber', header: 'Batch' },
    { key: 'parameterName', header: 'Parameter' },
    { key: 'processStage', header: 'Stage' },
    { key: 'observedValue', header: 'Observed' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
    { key: 'reviewStatus', header: 'Review' },
  ];

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="CPP Monitoring"
        description="Monitor Critical Process Parameters batch-wise for Continued Process Verification"
        trail={[{ label: 'Continued Process Verification', href: '/cpv/dashboard' }, { label: 'CPP Monitoring' }]}
        actions={
          <>
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info('Excel import placeholder — upload template coming soon')}>
                Import Excel
              </Button>
            )}
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                const headers = ['Batch', 'Parameter', 'Observed', 'Status', 'Risk'];
                const rows = filtered.map((r) => [r.batchNumber, r.parameterName, r.observedValue, r.status, r.riskLevel]);
                downloadCsv(`cpp-results-${Date.now()}.csv`, headers, rows);
                await logCppExport(actor, filtered.length);
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
                <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />New CPP Result</Button>
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
        <KpiCard label="OOT/OOL" value={summary.ootOol} tone="red" />
        <KpiCard label="High Risk" value={summary.highRisk} tone="red" />
        <KpiCard label="Critical Risk" value={summary.criticalRisk} tone="red" />
        <KpiCard label="Deviation Triggered" value={summary.deviationTriggered} tone="amber" />
        <KpiCard label="CAPA Suggested" value={summary.capaSuggested} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">CPP Compliance Trend</CardTitle></CardHeader>
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Stage Non-Compliance</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {charts.stageNonCompliance.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.stageNonCompliance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stage" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill={CHART_COLORS[2]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No data" />}
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
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-6">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="lg:col-span-2" />
            <Select value={productFilter} onValueChange={setProductFilter}><SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Products</SelectItem>{productNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
            <Select value={batchFilter} onValueChange={setBatchFilter}><SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Batches</SelectItem>{batchNumbers.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{CPP_RESULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Stages</SelectItem>{CPP_PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          {filtered.length === 0 ? <EmptyState title="No CPP results" /> : (
            <ResponsiveDataTable
              columns={columns}
              data={filtered}
              pageSize={10}
              onRowClick={(r) => router.push(`/cpv/cpp/${r.id}`)}
              actions={(row) => (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => router.push(`/cpv/cpp/${row.id}`)}><Eye className="h-4 w-4" /></Button>
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
                    <Button size="icon" variant="ghost" onClick={async () => { await reviewCppResult(row.id, actor, row); await load(); }}><CheckCircle className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Under Review' && (
                    <Button size="sm" variant="outline" onClick={async () => { await approveCppResult(row.id, actor, row); await load(); }}>Approve</Button>
                  )}
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit CPP Result' : 'New CPP Result'}</SheetTitle></SheetHeader>
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
            <div><Label>Process Stage *</Label>
              <Select value={form.processStage || ''} onValueChange={(v) => setForm((f) => ({ ...f, processStage: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CPP_PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Parameter *</Label>
              <Select value={form.parameterId || ''} onValueChange={onFormParamChange} disabled={Boolean(editing)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Parameter" /></SelectTrigger>
                <SelectContent>{formParams.map((p) => <SelectItem key={p.id} value={p.id || ''}>{p.parameterName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Observed Value *</Label><Input className="mt-1" value={String(form.observedValue ?? '')} onChange={(e) => setForm((f) => ({ ...f, observedValue: e.target.value }))} /></div>
              <div><Label>Unit</Label><Input className="mt-1" value={form.unit || ''} readOnly /></div>
              <div><Label>LSL</Label><Input className="mt-1" type="number" value={form.lowerLimit ?? ''} readOnly /></div>
              <div><Label>USL</Label><Input className="mt-1" type="number" value={form.upperLimit ?? ''} readOnly /></div>
            </div>
            <div><Label>Observation Date Time *</Label><Input className="mt-1" type="datetime-local" value={form.observationDateTime?.slice(0, 16) || ''} onChange={(e) => setForm((f) => ({ ...f, observationDateTime: e.target.value }))} /></div>
            <div><Label>Remarks</Label><Textarea className="mt-1" value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveForm()} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk CPP Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3 py-2">
            <div><Label>Product</Label>
              <Select value={bulkProductId} onValueChange={async (v) => {
                setBulkProductId(v);
                const p = products.find((x) => x.id === v);
                if (p) {
                  const batches = await fetchCppBatchesForProduct(p.productName);
                  setFormBatches(batches);
                  const params = await fetchCppParametersForProduct(p.productName, v);
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
            <div><Label>Process Stage</Label>
              <Select value={bulkStage} onValueChange={setBulkStage}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CPP_PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Parameter</TableHead><TableHead>Target</TableHead><TableHead>LCL/UCL</TableHead><TableHead>Observed</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
            <TableBody>
              {bulkRows.map((row, i) => {
                const n = normalizeParameter(row.param);
                return (
                  <TableRow key={row.param.id || i}>
                    <TableCell>{n.parameterName}</TableCell>
                    <TableCell>{n.target || n.targetValue}</TableCell>
                    <TableCell>{n.lsl}/{n.usl}</TableCell>
                    <TableCell><Input value={row.observed} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, observed: e.target.value } : r))} /></TableCell>
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
