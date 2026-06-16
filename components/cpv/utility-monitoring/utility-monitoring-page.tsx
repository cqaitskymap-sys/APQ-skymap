'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Pencil, CheckCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeUtilityRecords, buildUtilityChartSeries, UTILITY_TYPES, UTILITY_STATUSES,
  evaluateUtilityStatus, type UtilityMonitoringFormData, type UtilityMonitoringRecord,
} from '@/lib/cpv-utility-monitoring';
import {
  fetchUtilityRecords, fetchUtilityBatchesForProduct, fetchUtilityParameters, fetchUtilitySystems,
  createUtilityRecord, updateUtilityRecord, approveUtilityRecord, reviewUtilityRecord,
  bulkCreateUtilityRecords, logUtilityExport, utilityParameterTrendData,
} from '@/lib/cpv-utility-monitoring-service';
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

function UtilityTypeBadge({ type }: { type: string }) {
  return <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{type}</span>;
}

export function UtilityMonitoringPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canCreateUtility(role) && !cpvPermissions.isUtilityViewOnly(role);
  const canReview = cpvPermissions.canReviewUtility(role);
  const canImportExport = cpvPermissions.canImportExportUtility(role);
  const canQaOverride = cpvPermissions.canReviewUtility(role);
  const isReadOnly = cpvPermissions.isReadOnly(role) || cpvPermissions.isUtilityViewOnly(role);

  const [records, setRecords] = useState<UtilityMonitoringRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [systems, setSystems] = useState<Awaited<ReturnType<typeof fetchUtilitySystems>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<UtilityMonitoringRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [trendParam, setTrendParam] = useState('WFI Conductivity');

  const [formProductId, setFormProductId] = useState('');
  const [formBatches, setFormBatches] = useState<Awaited<ReturnType<typeof fetchUtilityBatchesForProduct>>>([]);
  const [formParams, setFormParams] = useState<Parameter[]>([]);
  const [form, setForm] = useState<Partial<UtilityMonitoringFormData>>({});

  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkUtilityType, setBulkUtilityType] = useState<string>(UTILITY_TYPES[0]);
  const [bulkSystemId, setBulkSystemId] = useState('');
  const [bulkSamplingPoint, setBulkSamplingPoint] = useState('');
  const [bulkRows, setBulkRows] = useState<Array<{ param: Parameter; observed: string; remarks: string }>>([]);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' };
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultTime = now.toTimeString().slice(0, 5);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods, sys] = await Promise.all([
        fetchUtilityRecords(), fetchProducts(), fetchUtilitySystems(),
      ]);
      setRecords(rows);
      setProducts(prods);
      setSystems(sys);
    } catch {
      setError('Failed to load utility records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== 'all' && r.utilityType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.batchNumber.toLowerCase().includes(q)
        || r.utilitySystemName.toLowerCase().includes(q) || r.samplingPoint.toLowerCase().includes(q)
        || r.parameterName.toLowerCase().includes(q);
    });
  }, [records, search, typeFilter, statusFilter, riskFilter]);

  const summary = useMemo(() => summarizeUtilityRecords(records), [records]);
  const charts = useMemo(() => buildUtilityChartSeries(filtered), [filtered]);
  const trendData = useMemo(() => utilityParameterTrendData(filtered, trendParam), [filtered, trendParam]);

  const formStatus = useMemo(() => {
    if (!form.observedValue || !form.lowerLimit || !form.upperLimit) return '';
    return evaluateUtilityStatus(
      form.observedValue,
      Number(form.lowerLimit),
      Number(form.upperLimit),
      form.resultType || 'Numeric',
      form.alertLimitLow,
      form.alertLimitHigh,
      form.actionLimitLow,
      form.actionLimitHigh,
    );
  }, [form]);

  const onFormProductChange = async (productId: string) => {
    setFormProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm((f) => ({ ...f, cpvProductId: productId, productName: p.productName, productCode: p.productCode }));
    const [batches, params] = await Promise.all([
      fetchUtilityBatchesForProduct(p.productName),
      fetchUtilityParameters(form.utilityType),
    ]);
    setFormBatches(batches);
    setFormParams(params);
  };

  const onUtilityTypeChange = async (utilityType: UtilityMonitoringFormData['utilityType']) => {
    setForm((f) => ({ ...f, utilityType }));
    const params = await fetchUtilityParameters(utilityType);
    setFormParams(params);
  };

  const onSystemChange = (systemId: string) => {
    const sys = systems.find((s) => s.id === systemId);
    if (!sys) return;
    setForm((f) => ({
      ...f,
      utilitySystemName: sys.name,
      utilitySystemCode: sys.code,
      utilityType: sys.utilityType as UtilityMonitoringFormData['utilityType'],
      areaRoomNo: sys.areaRoomNo,
      department: sys.department,
      samplingPoint: sys.samplingPoints[0] || '',
    }));
    void onUtilityTypeChange(sys.utilityType as UtilityMonitoringFormData['utilityType']);
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
      lowerLimit: Number(n.lsl || n.lowerLimit) || 0,
      upperLimit: Number(n.usl || n.upperLimit) || 0,
      targetValue: Number(n.target || n.targetValue) || 0,
      unit: n.unit,
      resultType: (n.resultType as UtilityMonitoringFormData['resultType']) || 'Numeric',
      utilityCriticality: n.criticality || 'Major',
      autoDeviationRequired: Boolean(n.autoDeviationRequired),
      alertLimitLow: n.alertLimitLow ? Number(n.alertLimitLow) : undefined,
      alertLimitHigh: n.alertLimitHigh ? Number(n.alertLimitHigh) : undefined,
      actionLimitLow: n.actionLimitLow ? Number(n.actionLimitLow) : undefined,
      actionLimitHigh: n.actionLimitHigh ? Number(n.actionLimitHigh) : undefined,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      monitoringDate: defaultDate,
      monitoringTime: defaultTime,
      recordedBy: profile?.full_name || '',
      utilityType: UTILITY_TYPES[0],
      resultType: 'Numeric',
      autoDeviationRequired: true,
    });
    setFormOpen(true);
  };

  const saveForm = async (qaOverride = false) => {
    if (!form.cpvProductId || !form.batchNumber || !form.parameterCode || !form.observedValue || !form.samplingPoint) {
      toast.error('Complete required fields');
      return;
    }
    setSubmitting(true);
    const data = form as UtilityMonitoringFormData;
    if (editing) {
      const { error: err } = await updateUtilityRecord(editing.id, data, actor, editing, qaOverride || (editing.isLocked && canQaOverride));
      if (err) toast.error(err);
      else { toast.success('Record updated'); setFormOpen(false); await load(); }
    } else {
      const { error: err } = await createUtilityRecord(data, actor);
      if (err) toast.error(err);
      else { toast.success('Record created'); setFormOpen(false); await load(); }
    }
    setSubmitting(false);
  };

  const openBulk = async () => {
    if (!products[0]) return;
    setBulkProductId(products[0].id);
    const p = products[0];
    setFormBatches(await fetchUtilityBatchesForProduct(p.productName));
    const params = await fetchUtilityParameters(bulkUtilityType);
    setBulkRows(params.slice(0, 8).map((param) => ({ param, observed: '', remarks: '' })));
    if (systems[0]) {
      setBulkSystemId(systems[0].id);
      setBulkSamplingPoint(systems[0].samplingPoints[0] || '');
    }
    setBulkOpen(true);
  };

  const saveBulk = async () => {
    const p = products.find((x) => x.id === bulkProductId);
    const batch = formBatches.find((b) => b.id === bulkBatchId);
    const sys = systems.find((s) => s.id === bulkSystemId);
    if (!p || !batch || !sys) { toast.error('Select product, batch and utility system'); return; }
    const rows: UtilityMonitoringFormData[] = bulkRows.filter((r) => r.observed).map((row) => {
      const n = normalizeParameter(row.param);
      return {
        cpvProductId: bulkProductId,
        productName: p.productName,
        productCode: p.productCode,
        batchNumber: batch.batchNumber,
        utilityType: bulkUtilityType as UtilityMonitoringFormData['utilityType'],
        utilitySystemName: sys.name,
        utilitySystemCode: sys.code,
        samplingPoint: bulkSamplingPoint,
        areaRoomNo: sys.areaRoomNo,
        department: sys.department,
        parameterId: row.param.id || '',
        parameterCode: n.parameterCode,
        parameterName: n.parameterName,
        observedValue: Number(row.observed),
        targetValue: Number(n.target || n.targetValue) || 0,
        lowerLimit: Number(n.lsl) || 0,
        upperLimit: Number(n.usl) || 0,
        unit: n.unit,
        resultType: (n.resultType as UtilityMonitoringFormData['resultType']) || 'Numeric',
        monitoringDate: defaultDate,
        monitoringTime: defaultTime,
        recordedBy: profile?.full_name || '',
        reviewedBy: '',
        reviewDate: '',
        remarks: row.remarks,
        utilityCriticality: n.criticality || 'Major',
        autoDeviationRequired: Boolean(n.autoDeviationRequired),
      };
    });
    setSubmitting(true);
    const { created, errors } = await bulkCreateUtilityRecords(rows, actor);
    setSubmitting(false);
    if (errors.length) toast.error(errors[0]);
    toast.success(`${created} utility records saved`);
    setBulkOpen(false);
    await load();
  };

  const columns: ColumnDef<UtilityMonitoringRecord>[] = [
    { key: 'batchNumber', header: 'Batch' },
    { key: 'utilityType', header: 'Utility', render: (r) => <UtilityTypeBadge type={r.utilityType} /> },
    { key: 'parameterName', header: 'Parameter' },
    { key: 'samplingPoint', header: 'Point' },
    { key: 'observedValue', header: 'Value' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
  ];

  if (loading) return <div className="p-4 sm:p-6"><LoadingSkeleton rows={2} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={load} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title="Utility Monitoring"
        description="Monitor critical utilities such as WFI, purified water, compressed air, nitrogen, clean steam and HVAC for CPV"
        trail={[{ label: 'Continued Process Verification', href: '/cpv/dashboard' }, { label: 'Utility Monitoring' }]}
        actions={
          <>
            {canImportExport && <Button variant="outline" size="sm" onClick={() => toast.info('Excel import placeholder')}>Import Excel</Button>}
            {canImportExport && (
              <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
                downloadCsv(`utility-monitoring-${Date.now()}.csv`, ['Batch', 'Utility', 'Parameter', 'Status', 'Risk'],
                  filtered.map((r) => [r.batchNumber, r.utilityType, r.parameterName, r.status, r.riskLevel]));
                await logUtilityExport(actor, filtered.length);
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
        <KpiCard label="Alert" value={summary.alert} tone="amber" />
        <KpiCard label="Action" value={summary.action} tone="amber" />
        <KpiCard label="Excursion" value={summary.excursion} tone="red" />
        <KpiCard label="Critical Excursions" value={summary.criticalExcursions} tone="red" />
        <KpiCard label="Deviation" value={summary.deviationTriggered} tone="amber" />
        <KpiCard label="WFI Alerts" value={summary.wfiAlerts} tone="blue" />
        <KpiCard label="HVAC Alerts" value={summary.hvacAlerts} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Compliance Trend</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.complianceTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.complianceTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip />
                  <Line type="monotone" dataKey="rate" stroke={CHART_COLORS[0]} strokeWidth={2} /></LineChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No compliance data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Utility Type Excursions</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.utilityTypeExcursionTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.utilityTypeExcursionTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="type" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill={CHART_COLORS[1]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No excursion data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Sampling Point Trend</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.samplingPointTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.samplingPointTrend} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="point" type="category" width={90} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="count" fill={CHART_COLORS[2]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No sampling point data" />}
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">WFI Conductivity</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.wfiConductivityTrend.length ? <ParameterTrendChart data={charts.wfiConductivityTrend} /> : <EmptyState title="No WFI conductivity data" />}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Compressed Air Pressure</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {charts.compressedAirPressureTrend.length ? <ParameterTrendChart data={charts.compressedAirPressureTrend} /> : <EmptyState title="No compressed air data" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Parameter Trend</CardTitle>
          <Select value={trendParam} onValueChange={setTrendParam}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['WFI Conductivity', 'WFI TOC', 'Compressed Air Pressure', 'HVAC Temperature', 'Differential Pressure'].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-[240px]">
          {trendData.length ? <ParameterTrendChart data={trendData} /> : <EmptyState title="No trend data for selected parameter" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="lg:col-span-2" />
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue placeholder="Utility Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem>{UTILITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{UTILITY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}><SelectTrigger><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Risk</SelectItem>{['Low', 'Medium', 'High', 'Critical'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          {filtered.length === 0 ? <EmptyState title="No utility records" /> : (
            <ResponsiveDataTable
              columns={columns}
              data={filtered}
              pageSize={10}
              onRowClick={(r) => router.push(`/cpv/utility-monitoring/${r.id}`)}
              actions={(row) => (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => router.push(`/cpv/utility-monitoring/${row.id}`)}><Eye className="h-4 w-4" /></Button>
                  {canCreate && !isReadOnly && (!row.isLocked || canQaOverride) && (
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditing(row); setForm(row); setFormProductId(row.cpvProductId); void onFormProductChange(row.cpvProductId); setFormOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Draft' && (
                    <Button size="icon" variant="ghost" onClick={async () => { await reviewUtilityRecord(row.id, actor, row); await load(); }}><CheckCircle className="h-4 w-4" /></Button>
                  )}
                  {canReview && row.reviewStatus === 'Under Review' && (
                    <Button size="sm" variant="outline" onClick={async () => { await approveUtilityRecord(row.id, actor, row); await load(); }}>Approve</Button>
                  )}
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit Utility Record' : 'New Utility Record'}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-3">
            {editing?.isLocked && canQaOverride && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                Record is locked. <Button variant="link" className="h-auto p-0" onClick={() => void saveForm(true)}>QA Override</Button>
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
              <Select value={form.batchNumber || ''} onValueChange={(v) => setForm((f) => ({ ...f, batchNumber: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.batchNumber}>{b.batchNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Utility Type *</Label>
              <Select value={form.utilityType || UTILITY_TYPES[0]} onValueChange={(v) => void onUtilityTypeChange(v as UtilityMonitoringFormData['utilityType'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{UTILITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Utility System *</Label>
              <Select value={systems.find((s) => s.name === form.utilitySystemName)?.id || ''} onValueChange={onSystemChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sampling Point *</Label>
              <Select value={form.samplingPoint || ''} onValueChange={(v) => setForm((f) => ({ ...f, samplingPoint: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(systems.find((s) => s.name === form.utilitySystemName)?.samplingPoints || [form.samplingPoint || 'Main']).map((sp) => (
                    <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parameter *</Label>
              <Select value={form.parameterId || ''} onValueChange={onFormParamChange} disabled={Boolean(editing)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{formParams.map((p) => <SelectItem key={p.id} value={p.id || ''}>{p.parameterName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Observed *</Label><Input className="mt-1" value={String(form.observedValue ?? '')} onChange={(e) => setForm((f) => ({ ...f, observedValue: e.target.value }))} /></div>
              <div><Label>Unit *</Label><Input className="mt-1" value={form.unit || ''} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} /></div>
              <div><Label>Lower Limit</Label><Input className="mt-1" type="number" value={form.lowerLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, lowerLimit: Number(e.target.value) }))} /></div>
              <div><Label>Upper Limit</Label><Input className="mt-1" type="number" value={form.upperLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, upperLimit: Number(e.target.value) }))} /></div>
              <div><Label>Date *</Label><Input className="mt-1" type="date" value={form.monitoringDate || ''} onChange={(e) => setForm((f) => ({ ...f, monitoringDate: e.target.value }))} /></div>
              <div><Label>Time *</Label><Input className="mt-1" type="time" value={form.monitoringTime || ''} onChange={(e) => setForm((f) => ({ ...f, monitoringTime: e.target.value }))} /></div>
              <div><Label>Recorded By *</Label><Input className="mt-1" value={form.recordedBy || ''} onChange={(e) => setForm((f) => ({ ...f, recordedBy: e.target.value }))} /></div>
              <div><Label>Status (auto)</Label><div className="mt-2">{formStatus ? <StatusBadge status={formStatus} /> : '—'}</div></div>
            </div>
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
          <DialogHeader><DialogTitle>Bulk Utility Entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <Select value={bulkProductId} onValueChange={async (v) => {
              setBulkProductId(v);
              const p = products.find((x) => x.id === v);
              if (p) setFormBatches(await fetchUtilityBatchesForProduct(p.productName));
            }}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
              <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent>{formBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.batchNumber}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={bulkUtilityType} onValueChange={async (v) => {
              setBulkUtilityType(v);
              const params = await fetchUtilityParameters(v);
              setBulkRows(params.slice(0, 8).map((param) => ({ param, observed: '', remarks: '' })));
            }}>
              <SelectTrigger><SelectValue placeholder="Utility Type" /></SelectTrigger>
              <SelectContent>{UTILITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={bulkSystemId} onValueChange={(v) => {
              setBulkSystemId(v);
              const sys = systems.find((s) => s.id === v);
              if (sys) setBulkSamplingPoint(sys.samplingPoints[0] || '');
            }}>
              <SelectTrigger><SelectValue placeholder="Utility System" /></SelectTrigger>
              <SelectContent>{systems.filter((s) => s.utilityType === bulkUtilityType || bulkUtilityType === 'Other').map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}</SelectContent>
            </Select>
            <Select value={bulkSamplingPoint} onValueChange={setBulkSamplingPoint}>
              <SelectTrigger><SelectValue placeholder="Sampling Point" /></SelectTrigger>
              <SelectContent>
                {(systems.find((s) => s.id === bulkSystemId)?.samplingPoints || []).map((sp) => (
                  <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Parameter</TableHead><TableHead>Limits</TableHead><TableHead>Unit</TableHead><TableHead>Observed</TableHead><TableHead>Remarks</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bulkRows.map((row, i) => {
                const n = normalizeParameter(row.param);
                return (
                  <TableRow key={row.param.id || i}>
                    <TableCell>{n.parameterName}</TableCell>
                    <TableCell className="text-xs">{n.lsl} – {n.usl}</TableCell>
                    <TableCell>{n.unit}</TableCell>
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
