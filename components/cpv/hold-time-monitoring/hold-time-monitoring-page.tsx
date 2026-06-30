'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Pencil, Layers } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeHoldTimeRecords, buildHoldTimeChartSeries,
  HOLD_STAGES, HOLD_TIME_STATUSES, BULK_HOLD_STAGES, HOLD_TIME_UNITS,
  type HoldTimeMonitoringFormData, type HoldTimeMonitoringRecord,
} from '@/lib/cpv-hold-time-monitoring';
import {
  fetchHoldTimeRecords, fetchHoldTimeBatchesForProduct, fetchHoldTimeMaster,
  createHoldTimeRecord, updateHoldTimeRecord, approveHoldTimeRecord, reviewHoldTimeRecord,
  bulkCreateHoldTimeRecords, logHoldTimeExport, buildHoldTimeComputedFields,
} from '@/lib/cpv-hold-time-monitoring-service';
import { fetchActiveCpvProductsForBatch as fetchProducts } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
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

export function HoldTimeMonitoringPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canCreateHoldTime(role) && !cpvPermissions.isHoldTimeViewOnly(role);
  const canEdit = cpvPermissions.canEditHoldTime(role);
  const canReview = cpvPermissions.canReviewHoldTime(role);
  const canImportExport = cpvPermissions.canImportExportHoldTime(role);
  const isReadOnly = cpvPermissions.isHoldTimeViewOnly(role) || cpvPermissions.isReadOnly(role);

  const [records, setRecords] = useState<HoldTimeMonitoringRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<HoldTimeMonitoringRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [trendStage, setTrendStage] = useState<string>(HOLD_STAGES[0]);

  const [formProductId, setFormProductId] = useState('');
  const [formBatches, setFormBatches] = useState<Awaited<ReturnType<typeof fetchHoldTimeBatchesForProduct>>>([]);
  const [form, setForm] = useState<Partial<HoldTimeMonitoringFormData>>({});
  const [computedPreview, setComputedPreview] = useState<{ actual: number; diff: number; status: string } | null>(null);

  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkRows, setBulkRows] = useState<Array<{
    stage: string; start: string; end: string; allowed: number; unit: string;
  }>>([]);

  const actor = useMemo(
    () => ({ id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' }),
    [user?.uid, profile?.full_name, role],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods] = await Promise.all([fetchHoldTimeRecords(), fetchProducts()]);
      setRecords(rows);
      setProducts(prods);
    } catch {
      setError('Failed to load hold time records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (stageFilter !== 'all' && r.holdStage !== stageFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      const recordDate = (r.startDateTime || r.createdAt).slice(0, 10);
      if (dateFrom && recordDate < dateFrom) return false;
      if (dateTo && recordDate > dateTo) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.batchNumber.toLowerCase().includes(q) || r.holdStage.toLowerCase().includes(q);
    });
  }, [records, search, stageFilter, statusFilter, riskFilter, dateFrom, dateTo]);

  const summary = useMemo(() => summarizeHoldTimeRecords(records), [records]);
  const charts = useMemo(() => buildHoldTimeChartSeries(filtered), [filtered]);
  const trendData = useMemo(() => {
    return filtered
      .filter((r) => r.holdStage === trendStage)
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
      .map((r) => ({
        label: r.batchNumber,
        observed: r.actualHoldTime,
        target: r.allowedHoldTime,
        lsl: 0,
        usl: r.allowedHoldTime,
      }));
  }, [filtered, trendStage]);

  const updateComputedPreview = (partial: Partial<HoldTimeMonitoringFormData>) => {
    if (!partial.startDateTime || !partial.endDateTime || !partial.allowedHoldTime || !partial.holdTimeUnit) {
      setComputedPreview(null);
      return;
    }
    const computed = buildHoldTimeComputedFields(partial as HoldTimeMonitoringFormData);
    setComputedPreview({ actual: computed.actualHoldTime, diff: computed.difference, status: computed.status });
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
    }));
    const batches = await fetchHoldTimeBatchesForProduct(p.productName, productId);
    setFormBatches(batches);
  };

  const onFormBatchChange = (batchNumber: string) => {
    const batch = formBatches.find((b) => b.batchNumber === batchNumber);
    setForm((f) => ({
      ...f,
      batchNumber,
      manufacturingDate: batch?.manufacturingDate || f.manufacturingDate || '',
    }));
  };

  const onHoldStageChange = async (holdStage: string) => {
    const master = await fetchHoldTimeMaster(holdStage);
    setForm((f) => {
      const next = {
        ...f,
        holdStage: holdStage,
        processStage: holdStage,
        allowedHoldTime: master.allowed,
        holdTimeUnit: master.unit as HoldTimeMonitoringFormData['holdTimeUnit'],
      };
      updateComputedPreview(next);
      return next;
    });
  };

  const saveForm = async () => {
    if (!form.cpvProductId || !form.batchNumber || !form.holdStage || !form.startDateTime || !form.endDateTime) {
      toast.error('Complete required fields');
      return;
    }
    setSubmitting(true);
    const data = form as HoldTimeMonitoringFormData;
    if (editing) {
      const qaOverride = editing.isLocked && editing.reviewStatus === 'Approved' && canReview;
      const { error: err } = await updateHoldTimeRecord(editing.id, data, actor, editing, qaOverride);
      if (err) toast.error(err);
      else { toast.success('Hold time record updated'); setFormOpen(false); await load(); }
    } else {
      const { error: err } = await createHoldTimeRecord(data, actor);
      if (err) toast.error(err);
      else { toast.success('Hold time record created'); setFormOpen(false); await load(); }
    }
    setSubmitting(false);
  };

  const loadBulkRowsForProduct = async (productId: string) => {
    setBulkProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const batches = await fetchHoldTimeBatchesForProduct(p.productName, productId);
    setFormBatches(batches);
    const rows = await Promise.all(BULK_HOLD_STAGES.map(async (stage) => {
      const master = await fetchHoldTimeMaster(stage);
      return { stage, start: '', end: '', allowed: master.allowed, unit: master.unit };
    }));
    setBulkRows(rows);
  };

  const openBulk = () => {
    setBulkProductId('');
    setBulkBatchId('');
    setBulkRows([]);
    setBulkOpen(true);
  };

  const saveBulk = async () => {
    const p = products.find((x) => x.id === bulkProductId);
    const batch = formBatches.find((b) => b.id === bulkBatchId);
    if (!p || !batch) { toast.error('Select product and batch'); return; }
    const rows: HoldTimeMonitoringFormData[] = bulkRows.filter((r) => r.start && r.end).map((row) => ({
      cpvProductId: bulkProductId,
      productName: p.productName,
      productCode: p.productCode,
      batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate,
      processStage: row.stage,
      holdStage: row.stage,
      startDateTime: row.start,
      endDateTime: row.end,
      allowedHoldTime: row.allowed,
      holdTimeUnit: row.unit as HoldTimeMonitoringFormData['holdTimeUnit'],
      reasonForHold: '',
      extensionApproved: false,
      extensionReason: '',
      approvedBy: '',
      reviewDate: '',
      remarks: '',
      autoDeviationRequired: true,
    }));
    if (!rows.length) { toast.error('Enter start/end times for at least one stage'); return; }
    setSubmitting(true);
    const { created, errors } = await bulkCreateHoldTimeRecords(rows, actor);
    setSubmitting(false);
    if (errors.length) toast.error(errors[0]);
    toast.success(`${created} hold time records saved`);
    setBulkOpen(false);
    await load();
  };

  const exportList = () => {
    downloadCsv('hold-time-records.csv',
      ['ID', 'Product', 'Batch', 'Stage', 'Actual', 'Allowed', 'Unit', 'Status', 'Risk'],
      filtered.map((r) => [
        r.holdTimeId, r.productName, r.batchNumber, r.holdStage,
        r.actualHoldTime, r.allowedHoldTime, r.holdTimeUnit, r.status, r.riskLevel,
      ]),
    );
    void logHoldTimeExport(actor, filtered.length);
    toast.success('Export downloaded');
  };

  const columns: ColumnDef<HoldTimeMonitoringRecord>[] = [
    { key: 'batchNumber', header: 'Batch' },
    { key: 'holdStage', header: 'Hold Stage' },
    { key: 'actualHoldTime', header: 'Actual' },
    { key: 'allowedHoldTime', header: 'Allowed' },
    { key: 'holdTimeUnit', header: 'Unit' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cpv/hold-time-monitoring/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {!isReadOnly && (canCreate || canEdit) && (!r.isLocked || canReview) && (
            <Button variant="ghost" size="icon" onClick={() => {
              setEditing(r);
              setForm(r);
              setFormProductId(r.cpvProductId);
              void onFormProductChange(r.cpvProductId);
              setComputedPreview({
                actual: r.actualHoldTime,
                diff: r.difference,
                status: r.status,
              });
              setFormOpen(true);
            }}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="Hold Time Monitoring"
        description="Monitor process hold times and prevent quality impact"
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Hold Time Monitoring' },
        ]}
        actions={
          <>
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={exportList}>
                <Download className="h-4 w-4" />Export
              </Button>
            )}
            {canCreate && (
              <Button size="sm" className="gap-2" onClick={() => {
                setEditing(null);
                setForm({
                  holdTimeUnit: 'Hours',
                  holdStage: HOLD_STAGES[0],
                  processStage: HOLD_STAGES[0],
                  autoDeviationRequired: true,
                });
                setComputedPreview(null);
                setFormOpen(true);
              }}>
                <Plus className="h-4 w-4" />New Record
              </Button>
            )}
            {canCreate && (
              <Button size="sm" variant="outline" className="gap-2" onClick={openBulk}>
                <Layers className="h-4 w-4" />Bulk Entry
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Records" value={summary.total} />
        <KpiCard label="Compliant" value={summary.compliant} tone="green" />
        <KpiCard label="Alert" value={summary.alert} tone="amber" />
        <KpiCard label="Action" value={summary.action} tone="amber" />
        <KpiCard label="Exceeded" value={summary.exceeded} tone={summary.exceeded > 0 ? 'red' : 'blue'} />
        <KpiCard label="High Risk" value={summary.highRisk} tone="amber" />
        <KpiCard label="Deviation Triggered" value={summary.deviationTriggered} />
        <KpiCard label="CAPA Suggested" value={summary.capaSuggested} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle className="text-base">Hold Time Records</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {HOLD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {HOLD_TIME_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk</SelectItem>
                  {['Low', 'Medium', 'High', 'Critical'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length
            ? <ResponsiveDataTable columns={columns} data={filtered} pageSize={10} mobileTitleKey="batchNumber" mobileSubtitleKey="holdStage" />
            : <EmptyState title="No hold time records" message="Create a record to start monitoring hold times." />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Stage-wise Hold Time</CardTitle>
            <Select value={trendStage} onValueChange={setTrendStage}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOLD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <ParameterTrendChart data={trendData} title={trendStage} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance Trend</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {charts.complianceTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.complianceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" stroke="#2563eb" name="Compliance %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No trend data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Exceeded Hold Time Trend</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {charts.exceededTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.exceededTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#dc2626" name="Exceeded" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No exceeded data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Risk Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {charts.riskDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.riskDistribution} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={90} label>
                    {charts.riskDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No risk data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Stage-wise Average Hold Time</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {charts.stageTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.stageTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="actual" fill="#2563eb" name="Avg Actual" />
                  <Bar dataKey="allowed" fill="#059669" name="Avg Allowed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No stage data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Hold Time Analysis</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {charts.monthlyAnalysis.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.monthlyAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="compliance" stroke="#2563eb" name="Compliance %" />
                  <Line yAxisId="right" type="monotone" dataKey="exceeded" stroke="#dc2626" name="Exceeded" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No monthly data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit Hold Time' : 'Create Hold Time Record'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Product *</Label>
              <Select value={formProductId} onValueChange={onFormProductChange}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Batch *</Label>
              <Select value={form.batchNumber || ''} onValueChange={onFormBatchChange}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {formBatches.map((b) => <SelectItem key={b.id} value={b.batchNumber}>{b.batchNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hold Stage *</Label>
              <Select value={form.holdStage || HOLD_STAGES[0]} onValueChange={onHoldStageChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOLD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date Time *</Label>
                <Input
                  type="datetime-local"
                  value={form.startDateTime?.slice(0, 16) || ''}
                  onChange={(e) => {
                    const startDateTime = e.target.value;
                    const next = { ...form, startDateTime };
                    setForm(next);
                    updateComputedPreview(next as HoldTimeMonitoringFormData);
                  }}
                />
              </div>
              <div>
                <Label>End Date Time *</Label>
                <Input
                  type="datetime-local"
                  value={form.endDateTime?.slice(0, 16) || ''}
                  onChange={(e) => {
                    const endDateTime = e.target.value;
                    const next = { ...form, endDateTime };
                    setForm(next);
                    updateComputedPreview(next as HoldTimeMonitoringFormData);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Allowed Hold Time *</Label>
                <Input
                  type="number"
                  value={form.allowedHoldTime ?? ''}
                  onChange={(e) => {
                    const next = { ...form, allowedHoldTime: Number(e.target.value) };
                    setForm(next);
                    updateComputedPreview(next as HoldTimeMonitoringFormData);
                  }}
                />
              </div>
              <div>
                <Label>Unit *</Label>
                <Select
                  value={form.holdTimeUnit || 'Hours'}
                  onValueChange={(v) => {
                    const next = { ...form, holdTimeUnit: v as HoldTimeMonitoringFormData['holdTimeUnit'] };
                    setForm(next);
                    updateComputedPreview(next as HoldTimeMonitoringFormData);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOLD_TIME_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {computedPreview && (
              <div className="rounded-md border bg-slate-50 p-3 text-sm space-y-1">
                <p>Actual: {computedPreview.actual}</p>
                <p>Difference: {computedPreview.diff}</p>
                <div>Status: <StatusBadge status={computedPreview.status} /></div>
              </div>
            )}
            <div>
              <Label>Reason for Hold</Label>
              <Textarea value={form.reasonForHold || ''} onChange={(e) => setForm((f) => ({ ...f, reasonForHold: e.target.value }))} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <Button className="w-full" disabled={submitting} onClick={saveForm}>
              {submitting ? 'Saving…' : 'Save Record'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Hold Time Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div>
              <Label>Product</Label>
              <Select value={bulkProductId} onValueChange={(id) => void loadBulkRowsForProduct(id)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Batch</Label>
              <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {formBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.batchNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Allowed</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkRows.map((row, idx) => (
                  <TableRow key={row.stage}>
                    <TableCell>{row.stage}</TableCell>
                    <TableCell>{row.allowed} {row.unit}</TableCell>
                    <TableCell>
                      <Input type="datetime-local" className="h-8" value={row.start.slice(0, 16)} onChange={(e) => {
                        const next = [...bulkRows];
                        next[idx] = { ...row, start: e.target.value };
                        setBulkRows(next);
                      }} />
                    </TableCell>
                    <TableCell>
                      <Input type="datetime-local" className="h-8" value={row.end.slice(0, 16)} onChange={(e) => {
                        const next = [...bulkRows];
                        next[idx] = { ...row, end: e.target.value };
                        setBulkRows(next);
                      }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button disabled={submitting} onClick={saveBulk}>{submitting ? 'Saving…' : 'Save All'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
