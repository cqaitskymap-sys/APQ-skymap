'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Pencil, CheckCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeYieldRecords, buildYieldChartSeries, YIELD_STAGES, YIELD_STATUSES,
  defaultLimitsForStage,
  type YieldMonitoringFormData, type YieldMonitoringRecord,
} from '@/lib/cpv-yield-monitoring';
import {
  fetchYieldRecords, fetchYieldBatchesForProduct,
  createYieldRecord, updateYieldRecord, approveYieldRecord, reviewYieldRecord,
  bulkCreateYieldRecords, logYieldExport, yieldStageTrendData, stageDefaults,
  buildYieldComputedFields,
} from '@/lib/cpv-yield-monitoring-service';
import { fetchActiveCpvProductsForBatch as fetchProducts } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { YieldTrendChart } from './yield-trend-chart';
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

function YieldPctBadge({ pct }: { pct: number }) {
  const cls = pct >= 96 ? 'bg-green-50 text-green-700 border-green-200'
    : pct >= 90 ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{pct}%</span>;
}

export function YieldMonitoringPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canCreateYield(role) && !cpvPermissions.isYieldViewOnly(role);
  const canReview = cpvPermissions.canReviewYield(role);
  const canImportExport = cpvPermissions.canImportExportYield(role);
  const canQaOverride = cpvPermissions.canReviewYield(role);
  const isReadOnly = cpvPermissions.isReadOnly(role) || cpvPermissions.isYieldViewOnly(role);

  const [records, setRecords] = useState<YieldMonitoringRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<YieldMonitoringRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [trendStage, setTrendStage] = useState<string>('Bulk Yield');

  const [formProductId, setFormProductId] = useState('');
  const [formBatches, setFormBatches] = useState<Awaited<ReturnType<typeof fetchYieldBatchesForProduct>>>([]);
  const [form, setForm] = useState<Partial<YieldMonitoringFormData>>({});

  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkRows, setBulkRows] = useState<Array<{
    stage: string; theoretical: string; actual: string; reject: string; rework: string; remarks: string;
  }>>([]);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods] = await Promise.all([fetchYieldRecords(), fetchProducts()]);
      setRecords(rows);
      setProducts(prods);
    } catch {
      setError('Failed to load yield records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (stageFilter !== 'all' && r.yieldStage !== stageFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.batchNumber.toLowerCase().includes(q)
        || r.yieldStage.toLowerCase().includes(q);
    });
  }, [records, search, stageFilter, statusFilter, riskFilter]);

  const summary = useMemo(() => summarizeYieldRecords(records), [records]);
  const charts = useMemo(() => buildYieldChartSeries(filtered), [filtered]);
  const trendData = useMemo(() => yieldStageTrendData(filtered, trendStage), [filtered, trendStage]);

  const formComputed = useMemo(() => {
    if (!form.theoreticalQuantity || !form.actualQuantity || form.lowerLimit === undefined || form.upperLimit === undefined || !form.targetYield) {
      return null;
    }
    return buildYieldComputedFields({
      theoreticalQuantity: Number(form.theoreticalQuantity),
      actualQuantity: Number(form.actualQuantity),
      lowerLimit: Number(form.lowerLimit),
      upperLimit: Number(form.upperLimit),
      targetYield: Number(form.targetYield),
      alertLimitLow: form.alertLimitLow,
      alertLimitHigh: form.alertLimitHigh,
      actionLimitLow: form.actionLimitLow,
      actionLimitHigh: form.actionLimitHigh,
    });
  }, [form]);

  const onFormProductChange = async (productId: string) => {
    setFormProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm((f) => ({ ...f, cpvProductId: productId, productName: p.productName, productCode: p.productCode }));
    setFormBatches(await fetchYieldBatchesForProduct(p.productName));
  };

  const onBatchChange = (batchNumber: string) => {
    const batch = formBatches.find((b) => b.batchNumber === batchNumber);
    setForm((f) => ({
      ...f,
      batchNumber,
      manufacturingDate: batch?.manufacturingDate || f.manufacturingDate,
      batchSize: batch?.batchSize != null ? String(batch.batchSize) : f.batchSize,
      batchSizeUnit: batch?.batchSizeUnit ? String(batch.batchSizeUnit) : f.batchSizeUnit,
    }));
  };

  const onStageChange = (stage: YieldMonitoringFormData['yieldStage']) => {
    const limits = defaultLimitsForStage(stage);
    setForm((f) => ({
      ...f,
      yieldStage: stage,
      lowerLimit: limits.lowerLimit,
      upperLimit: limits.upperLimit,
      targetYield: limits.targetYield,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    const limits = defaultLimitsForStage(YIELD_STAGES[0]);
    setForm({
      yieldStage: YIELD_STAGES[0],
      lowerLimit: limits.lowerLimit,
      upperLimit: limits.upperLimit,
      targetYield: limits.targetYield,
      unit: 'units',
      recordedBy: profile?.full_name || '',
      autoDeviationRequired: true,
      rejectQuantity: 0,
      reworkQuantity: 0,
    });
    setFormOpen(true);
  };

  const saveForm = async (qaOverride = false) => {
    if (!form.cpvProductId || !form.batchNumber || !form.yieldStage || !form.theoreticalQuantity || !form.actualQuantity) {
      toast.error('Complete required fields');
      return;
    }
    setSubmitting(true);
    const data = form as YieldMonitoringFormData;
    if (editing) {
      const { error: err } = await updateYieldRecord(editing.id, data, actor, editing, qaOverride || (editing.isLocked && canQaOverride));
      if (err) toast.error(err);
      else { toast.success('Record updated'); setFormOpen(false); await load(); }
    } else {
      const { error: err } = await createYieldRecord(data, actor, qaOverride);
      if (err) toast.error(err);
      else { toast.success('Record created'); setFormOpen(false); await load(); }
    }
    setSubmitting(false);
  };

  const openBulk = async () => {
    if (!products[0]) return;
    setBulkProductId(products[0].id);
    setFormBatches(await fetchYieldBatchesForProduct(products[0].productName));
    setBulkRows(YIELD_STAGES.map((stage) => ({
      stage, theoretical: '', actual: '', reject: '', rework: '', remarks: '',
    })));
    setBulkOpen(true);
  };

  const saveBulk = async () => {
    const p = products.find((x) => x.id === bulkProductId);
    const batch = formBatches.find((b) => b.id === bulkBatchId);
    if (!p || !batch) { toast.error('Select product and batch'); return; }
    const rows: YieldMonitoringFormData[] = bulkRows.filter((r) => r.theoretical && r.actual).map((row) => {
      const limits = stageDefaults(row.stage);
      return {
        cpvProductId: bulkProductId,
        productName: p.productName,
        productCode: p.productCode,
        batchNumber: batch.batchNumber,
        manufacturingDate: batch.manufacturingDate,
        batchSize: batch.batchSize != null ? String(batch.batchSize) : '',
        batchSizeUnit: batch.batchSizeUnit ? String(batch.batchSizeUnit) : '',
        yieldStage: row.stage as YieldMonitoringFormData['yieldStage'],
        theoreticalQuantity: Number(row.theoretical),
        actualQuantity: Number(row.actual),
        rejectQuantity: Number(row.reject) || 0,
        reworkQuantity: Number(row.rework) || 0,
        lowerLimit: limits.lowerLimit,
        upperLimit: limits.upperLimit,
        targetYield: limits.targetYield,
        unit: 'units',
        recordedBy: profile?.full_name || '',
        reviewedBy: '',
        reviewDate: '',
        remarks: row.remarks,
        autoDeviationRequired: true,
      };
    });
    setSubmitting(true);
    const { created, errors } = await bulkCreateYieldRecords(rows, actor, canQaOverride);
    setSubmitting(false);
    if (errors.length) toast.error(errors[0]);
    toast.success(`${created} yield records saved`);
    setBulkOpen(false);
    await load();
  };

  const columns: ColumnDef<YieldMonitoringRecord>[] = [
    { key: 'batchNumber', header: 'Batch' },
    { key: 'yieldStage', header: 'Stage' },
    { key: 'yieldPercentage', header: 'Yield %', render: (r) => <YieldPctBadge pct={r.yieldPercentage} /> },
    { key: 'variancePercentage', header: 'Variance' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
  ];

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="Yield Monitoring"
        description="Monitor bulk, filling, packing and overall yield for CPV batches"
        trail={[{ label: 'Continued Process Verification', href: '/cpv/dashboard' }, { label: 'Yield Monitoring' }]}
        actions={
          <>
            {canImportExport && <Button variant="outline" size="sm" onClick={() => toast.info('Excel import placeholder')}>Import Excel</Button>}
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                downloadCsv(`yield-monitoring-${Date.now()}.csv`, ['Batch', 'Stage', 'Yield %', 'Status', 'Risk'],
                  filtered.map((r) => [r.batchNumber, r.yieldStage, r.yieldPercentage, r.status, r.riskLevel]));
                await logYieldExport(actor, filtered.length);
                toast.success('Export CSV generated');
              }}><Download className="h-4 w-4" />Export</Button>
            )}
            {canCreate && !isReadOnly && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void openBulk()}><Layers className="h-4 w-4" />Bulk Entry</Button>
                <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />New Record</Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        <KpiCard label="Total Records" value={summary.total} tone="blue" />
        <KpiCard label="Compliant" value={summary.compliant} tone="green" />
        <KpiCard label="Low Yield" value={summary.lowYield} tone="red" />
        <KpiCard label="High Yield" value={summary.highYield} tone="amber" />
        <KpiCard label="Avg Bulk" value={`${summary.avgBulkYield}%`} tone="blue" />
        <KpiCard label="Avg Filling" value={`${summary.avgFillingYield}%`} tone="blue" />
        <KpiCard label="Avg Packing" value={`${summary.avgPackingYield}%`} tone="green" />
        <KpiCard label="Avg Overall" value={`${summary.avgOverallYield}%`} tone="green" />
        <KpiCard label="Deviation" value={summary.deviationTriggered} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bulk Yield Trend</CardTitle></CardHeader>
          <CardContent>{charts.bulkYieldTrend.length ? <YieldTrendChart data={charts.bulkYieldTrend} /> : <EmptyState title="No bulk yield data" />}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Filling Yield Trend</CardTitle></CardHeader>
          <CardContent>{charts.fillingYieldTrend.length ? <YieldTrendChart data={charts.fillingYieldTrend} /> : <EmptyState title="No filling yield data" />}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Packing Yield Trend</CardTitle></CardHeader>
          <CardContent>{charts.packingYieldTrend.length ? <YieldTrendChart data={charts.packingYieldTrend} /> : <EmptyState title="No packing yield data" />}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Overall Yield Trend</CardTitle></CardHeader>
          <CardContent>{charts.overallYieldTrend.length ? <YieldTrendChart data={charts.overallYieldTrend} /> : <EmptyState title="No overall yield data" />}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Batch Comparison</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.batchComparison.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.batchComparison}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="batch" tick={{ fontSize: 9 }} /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="overall" fill={CHART_COLORS[0]} name="Yield %" /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No batch comparison data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Variance Trend</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.varianceTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.varianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="variance" stroke={CHART_COLORS[2]} strokeWidth={2} /></LineChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No variance data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.riskDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={charts.riskDistribution} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={70} label>
                  {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No risk data" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Stage Trend</CardTitle>
          <Select value={trendStage} onValueChange={setTrendStage}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{YIELD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-[240px]">
          {trendData.length ? <YieldTrendChart data={trendData} /> : <EmptyState title="No trend data" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="lg:col-span-2" />
            <Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Stages</SelectItem>{YIELD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{YIELD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}><SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Risk</SelectItem>{['Low', 'Medium', 'High', 'Critical'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          {filtered.length === 0 ? <EmptyState title="No yield records" /> : (
            <ResponsiveDataTable
              columns={columns}
              data={filtered}
              pageSize={10}
              onRowClick={(r) => router.push(`/cpv/yield-monitoring/${r.id}`)}
              actions={(row) => (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => router.push(`/cpv/yield-monitoring/${row.id}`)}><Eye className="h-4 w-4" /></Button>
                  {canCreate && !isReadOnly && (!row.isLocked || canQaOverride) && (
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditing(row); setForm(row); setFormProductId(row.cpvProductId); void onFormProductChange(row.cpvProductId); setFormOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Draft' && (
                    <Button size="icon" variant="ghost" onClick={async () => { await reviewYieldRecord(row.id, actor, row); await load(); }}><CheckCircle className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Under Review' && (
                    <Button size="sm" variant="outline" onClick={async () => { await approveYieldRecord(row.id, actor, row); await load(); }}>Approve</Button>
                  )}
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit Yield Record' : 'New Yield Record'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-3">
            {editing?.isLocked && canQaOverride && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                Record locked. <Button variant="link" className="h-auto p-0" onClick={() => void saveForm(true)}>QA Override</Button>
              </div>
            )}
            {!editing && (
              <div><Label>CPV Product *</Label>
                <Select value={formProductId} onValueChange={(v) => void onFormProductChange(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Batch *</Label>
              <Select value={form.batchNumber || ''} onValueChange={onBatchChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.batchNumber}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Yield Stage *</Label>
              <Select value={form.yieldStage || YIELD_STAGES[0]} onValueChange={(v) => onStageChange(v as YieldMonitoringFormData['yieldStage'])} disabled={Boolean(editing)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{YIELD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Theoretical *</Label><Input className="mt-1" type="number" value={form.theoreticalQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, theoreticalQuantity: Number(e.target.value) }))} /></div>
              <div><Label>Actual *</Label><Input className="mt-1" type="number" value={form.actualQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, actualQuantity: Number(e.target.value) }))} /></div>
              <div><Label>Reject</Label><Input className="mt-1" type="number" value={form.rejectQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, rejectQuantity: Number(e.target.value) }))} /></div>
              <div><Label>Rework</Label><Input className="mt-1" type="number" value={form.reworkQuantity ?? ''} onChange={(e) => setForm((f) => ({ ...f, reworkQuantity: Number(e.target.value) }))} /></div>
              <div><Label>Lower Limit % *</Label><Input className="mt-1" type="number" value={form.lowerLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, lowerLimit: Number(e.target.value) }))} /></div>
              <div><Label>Upper Limit % *</Label><Input className="mt-1" type="number" value={form.upperLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, upperLimit: Number(e.target.value) }))} /></div>
              <div><Label>Target Yield % *</Label><Input className="mt-1" type="number" value={form.targetYield ?? ''} onChange={(e) => setForm((f) => ({ ...f, targetYield: Number(e.target.value) }))} /></div>
              <div><Label>Recorded By *</Label><Input className="mt-1" value={form.recordedBy || ''} onChange={(e) => setForm((f) => ({ ...f, recordedBy: e.target.value }))} /></div>
            </div>
            {formComputed && (
              <div className="rounded-md border bg-slate-50 p-3 text-sm grid grid-cols-2 gap-2">
                <div>Loss: {formComputed.lossQuantity}</div>
                <div>Yield: {formComputed.yieldPercentage}%</div>
                <div>Variance: {formComputed.variancePercentage}%</div>
                <div>Status: <StatusBadge status={formComputed.status} /></div>
              </div>
            )}
            <div><Label>Remarks</Label><Textarea className="mt-1" value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveForm()} disabled={submitting}>Save</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Yield Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <Select value={bulkProductId} onValueChange={async (v) => {
              setBulkProductId(v);
              const p = products.find((x) => x.id === v);
              if (p) setFormBatches(await fetchYieldBatchesForProduct(p.productName));
            }}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
              <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.batchNumber}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Stage</TableHead><TableHead>Limits</TableHead><TableHead>Theoretical</TableHead>
              <TableHead>Actual</TableHead><TableHead>Reject</TableHead><TableHead>Rework</TableHead><TableHead>Remarks</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bulkRows.map((row, i) => {
                const limits = stageDefaults(row.stage);
                const computed = row.theoretical && row.actual
                  ? buildYieldComputedFields({
                    theoreticalQuantity: Number(row.theoretical),
                    actualQuantity: Number(row.actual),
                    lowerLimit: limits.lowerLimit,
                    upperLimit: limits.upperLimit,
                    targetYield: limits.targetYield,
                  })
                  : null;
                return (
                  <TableRow key={row.stage}>
                    <TableCell>{row.stage}</TableCell>
                    <TableCell className="text-xs">{limits.lowerLimit}–{limits.upperLimit}%</TableCell>
                    <TableCell><Input value={row.theoretical} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, theoretical: e.target.value } : r))} /></TableCell>
                    <TableCell><Input value={row.actual} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, actual: e.target.value } : r))} /></TableCell>
                    <TableCell><Input value={row.reject} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, reject: e.target.value } : r))} /></TableCell>
                    <TableCell><Input value={row.rework} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, rework: e.target.value } : r))} /></TableCell>
                    <TableCell>
                      <Input value={row.remarks} onChange={(e) => setBulkRows((rows) => rows.map((r, j) => j === i ? { ...r, remarks: e.target.value } : r))} />
                      {computed && <span className="text-xs text-muted-foreground">{computed.yieldPercentage}% · {computed.status}</span>}
                    </TableCell>
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
