'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Download, Eye, Calculator, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import {
  summarizeProcessCapability, buildProcessCapabilityCharts,
  PARAMETER_TYPES, dataSourceForType,
  type ProcessCapabilityFormData,
  type ProcessCapabilityRecord,
} from '@/lib/cpv-process-capability';
import {
  fetchProcessCapabilityRecords, fetchCapabilitySourceData,
  fetchParametersForProduct, previewCapabilityCalculation,
  createProcessCapability, recalculateProcessCapability,
  logProcessCapabilityExport,
  type SourceDataPoint,
} from '@/lib/cpv-process-capability-service';
import { fetchActiveCpvProductsForBatch as fetchProducts } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CapabilityChart, CapabilityTrendChart } from './capability-chart';
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

export function ProcessCapabilityPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = cpvPermissions.canCreateProcessCapability(role);
  const canEdit = cpvPermissions.canEditProcessCapability(role);
  const canReview = cpvPermissions.canReviewProcessCapability(role);
  const canImportExport = cpvPermissions.canImportExportProcessCapability(role);
  const isReadOnly = cpvPermissions.isProcessCapabilityViewOnly(role) || cpvPermissions.isReadOnly(role);

  const [records, setRecords] = useState<ProcessCapabilityRecord[]>([]);
  const [products, setProducts] = useState<CpvProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState<Partial<ProcessCapabilityFormData>>({});
  const [parameters, setParameters] = useState<string[]>([]);
  const [sourcePreview, setSourcePreview] = useState<SourceDataPoint[]>([]);
  const [calcPreview, setCalcPreview] = useState<ReturnType<typeof previewCapabilityCalculation> | null>(null);

  const actor = useMemo(
    () => ({ id: user?.uid || 'system', name: profile?.full_name || 'System', role: role || '' }),
    [user?.uid, profile?.full_name, role],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, prods] = await Promise.all([fetchProcessCapabilityRecords(), fetchProducts()]);
      setRecords(rows);
      setProducts(prods);
    } catch {
      setError('Failed to load process capability records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== 'all' && r.parameterType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.capabilityStatus !== statusFilter) return false;
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false;
      const periodEnd = (r.reviewPeriodTo || r.reviewDate || r.createdAt).slice(0, 10);
      if (dateFrom && periodEnd < dateFrom) return false;
      if (dateTo && periodEnd > dateTo) return false;
      if (!q) return true;
      return r.productName.toLowerCase().includes(q) || r.parameterName.toLowerCase().includes(q);
    });
  }, [records, search, typeFilter, statusFilter, riskFilter, dateFrom, dateTo]);

  const summary = useMemo(() => summarizeProcessCapability(records), [records]);
  const charts = useMemo(() => buildProcessCapabilityCharts(filtered), [filtered]);

  const onProductChange = async (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      cpvProductId: productId,
      productName: p.productName,
      productCode: p.productCode,
    }));
    if (form.parameterType) {
      const params = await fetchParametersForProduct(form.parameterType, p.productName);
      setParameters(params);
    }
  };

  const onTypeChange = async (type: string) => {
    setForm((f) => ({
      ...f,
      parameterType: type as ProcessCapabilityFormData['parameterType'],
      dataSource: dataSourceForType(type as ProcessCapabilityFormData['parameterType']),
      parameterName: '',
      parameterCode: '',
    }));
    if (form.productName) {
      const params = await fetchParametersForProduct(type, form.productName);
      setParameters(params);
    }
  };

  const loadSourcePreview = async () => {
    if (!form.productName || !form.parameterName || !form.reviewPeriodFrom || !form.reviewPeriodTo || !form.dataSource) {
      toast.error('Complete product, parameter, and review period');
      return;
    }
    const data = await fetchCapabilitySourceData(
      form.dataSource,
      form.productName,
      form.parameterName,
      form.reviewPeriodFrom,
      form.reviewPeriodTo,
    );
    setSourcePreview(data);
    if (data.length < 5) {
      toast.warning(`Only ${data.length} data points found — at least 5 required for calculation.`);
    }
    if (data.length && form.lowerSpecificationLimit != null && form.upperSpecificationLimit != null) {
      const lsl = data[0].lsl ?? form.lowerSpecificationLimit;
      const usl = data[0].usl ?? form.upperSpecificationLimit;
      const target = data[0].target ?? form.targetValue;
      setForm((f) => ({ ...f, lowerSpecificationLimit: lsl, upperSpecificationLimit: usl, targetValue: target }));
      const calc = previewCapabilityCalculation({ ...form, lowerSpecificationLimit: lsl, upperSpecificationLimit: usl, targetValue: target } as ProcessCapabilityFormData, data);
      setCalcPreview(calc);
    }
    setWizardStep(5);
  };

  const runCalculation = () => {
    if (!form.lowerSpecificationLimit || !form.upperSpecificationLimit) {
      toast.error('LSL and USL required');
      return;
    }
    const calc = previewCapabilityCalculation(form as ProcessCapabilityFormData, sourcePreview);
    setCalcPreview(calc);
    setWizardStep(6);
  };

  const saveCalculation = async () => {
    if (!calcPreview || calcPreview.sampleCount < 5) {
      toast.error('At least 5 numeric values required');
      return;
    }
    setSubmitting(true);
    const { error: err } = await createProcessCapability(form as ProcessCapabilityFormData, sourcePreview, actor);
    setSubmitting(false);
    if (err) toast.error(err);
    else {
      toast.success('Capability calculation saved');
      setWizardOpen(false);
      await load();
    }
  };

  const exportList = () => {
    downloadCsv('process-capability.csv',
      ['ID', 'Product', 'Parameter', 'Type', 'Cpk', 'Ppk', 'Status', 'Risk'],
      filtered.map((r) => [
        r.capabilityId, r.productName, r.parameterName, r.parameterType,
        r.cpk, r.ppk, r.capabilityStatus, r.riskLevel,
      ]),
    );
    void logProcessCapabilityExport(actor, filtered.length);
    toast.success('Export downloaded');
  };

  const columns: ColumnDef<ProcessCapabilityRecord>[] = [
    { key: 'capabilityId', header: 'ID' },
    { key: 'productName', header: 'Product' },
    { key: 'parameterName', header: 'Parameter' },
    { key: 'parameterType', header: 'Type' },
    { key: 'cpk', header: 'Cpk' },
    { key: 'ppk', header: 'Ppk' },
    { key: 'capabilityStatus', header: 'Capability', render: (r) => <StatusBadge status={r.capabilityStatus} /> },
    { key: 'riskLevel', header: 'Risk', render: (r) => <RiskBadge level={r.riskLevel} /> },
    { key: 'status', header: 'Workflow' },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cpv/process-capability/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (!r.isLocked || canReview) && r.status !== 'Approved' && (
            <Button variant="ghost" size="icon" onClick={async () => {
              const qaOverride = r.isLocked && r.status === 'Approved' && canReview;
              const { error: err } = await recalculateProcessCapability(r.id, actor, r, qaOverride);
              if (err) toast.error(err);
              else { toast.success('Recalculated'); await load(); }
            }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {canEdit && canReview && r.isLocked && r.status === 'Approved' && (
            <Button variant="ghost" size="icon" title="QA Override Recalculate" onClick={async () => {
              const { error: err } = await recalculateProcessCapability(r.id, actor, r, true);
              if (err) toast.error(err);
              else { toast.success('Recalculated with QA override'); await load(); }
            }}>
              <RefreshCw className="h-4 w-4 text-amber-600" />
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
        title="Process Capability"
        description="Calculate Cp, Cpk, Pp and Ppk for CPV parameters"
        trail={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Process Capability' },
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
                setForm({ reviewPeriodFrom: '', reviewPeriodTo: '', parameterType: 'CPP', dataSource: 'CPP Results' });
                setSourcePreview([]);
                setCalcPreview(null);
                setWizardStep(1);
                setWizardOpen(true);
              }}>
                <Plus className="h-4 w-4" />New Calculation
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Reviews" value={summary.total} />
        <KpiCard label="Excellent" value={summary.excellent} tone="green" />
        <KpiCard label="Acceptable" value={summary.acceptable} tone="green" />
        <KpiCard label="Needs Improvement" value={summary.needsImprovement} tone="amber" />
        <KpiCard label="Not Capable" value={summary.notCapable} tone="red" />
        <KpiCard label="Insufficient Data" value={summary.insufficient} />
        <KpiCard label="High Risk" value={summary.highRisk} tone="amber" />
        <KpiCard label="Avg Cpk" value={summary.averageCpk} />
        <KpiCard label="Avg Ppk" value={summary.averagePpk} />
        <KpiCard label="CAPA Recommended" value={summary.capaRecommended} tone="amber" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle className="text-base">Capability Records</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {PARAMETER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Capability" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {['Excellent', 'Acceptable', 'Needs Improvement', 'Not Capable', 'Insufficient Data'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
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
            ? <ResponsiveDataTable columns={columns} data={filtered} pageSize={10} mobileTitleKey="parameterName" mobileSubtitleKey="productName" />
            : <EmptyState title="No capability records" message="Run a capability calculation to begin." />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Cpk by Parameter</CardTitle></CardHeader>
          <CardContent>
            <CapabilityChart
              data={charts.cpkByParameter.map((d) => ({ label: d.name, cp: d.cpk, cpk: d.cpk, ppk: d.ppk }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Average Cpk</CardTitle></CardHeader>
          <CardContent>
            <CapabilityTrendChart data={charts.monthlyCpk} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cp vs Cpk</CardTitle></CardHeader>
          <CardContent>
            <CapabilityChart data={charts.cpVsCpk.map((d) => ({ label: d.parameter, cp: d.cp, cpk: d.cpk }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Capability Status Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {charts.statusDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No status data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Parameter Capability Trend</CardTitle></CardHeader>
          <CardContent>
            <CapabilityTrendChart
              data={charts.parameterTrend.map((d) => ({ month: d.label, cpk: d.cpk }))}
              title="Recent Reviews"
            />
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
      </div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Capability Calculation — Step {wizardStep} of 7</DialogTitle>
          </DialogHeader>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <Label>Product *</Label>
              <Select value={form.cpvProductId || ''} onValueChange={onProductChange}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <Label>Parameter Type *</Label>
              <Select value={form.parameterType || 'CPP'} onValueChange={onTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARAMETER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <Label>Parameter *</Label>
              <Select
                value={form.parameterName || ''}
                onValueChange={(name) => setForm((f) => ({
                  ...f,
                  parameterName: name,
                  parameterCode: name.replace(/\s+/g, '_').toUpperCase(),
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select parameter" /></SelectTrigger>
                <SelectContent>
                  {parameters.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Review Period From *</Label>
                <Input type="date" value={form.reviewPeriodFrom || ''} onChange={(e) => setForm((f) => ({ ...f, reviewPeriodFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Review Period To *</Label>
                <Input type="date" value={form.reviewPeriodTo || ''} onChange={(e) => setForm((f) => ({ ...f, reviewPeriodTo: e.target.value }))} />
              </div>
              <div>
                <Label>LSL *</Label>
                <Input type="number" value={form.lowerSpecificationLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, lowerSpecificationLimit: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>USL *</Label>
                <Input type="number" value={form.upperSpecificationLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, upperSpecificationLimit: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          {wizardStep === 5 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{sourcePreview.length} source data points loaded</p>
              <div className="overflow-x-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourcePreview.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.batchNumber}</TableCell>
                        <TableCell>{row.value}</TableCell>
                        <TableCell>{row.date?.split('T')[0]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {wizardStep >= 6 && calcPreview && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard label="Cpk" value={calcPreview.cpk} tone={calcPreview.cpk >= 1.33 ? 'green' : 'amber'} />
                <KpiCard label="Cp" value={calcPreview.cp} />
                <KpiCard label="Ppk" value={calcPreview.ppk} />
                <KpiCard label="Mean" value={calcPreview.mean} />
                <KpiCard label="Std Dev" value={calcPreview.standardDeviation} />
                <KpiCard label="Samples" value={calcPreview.sampleCount} />
              </div>
              <div className="flex gap-2">
                <StatusBadge status={calcPreview.capabilityStatus} />
                <RiskBadge level={calcPreview.riskLevel} />
              </div>
              <Textarea placeholder="Conclusion" value={form.conclusion || ''} onChange={(e) => setForm((f) => ({ ...f, conclusion: e.target.value }))} />
              <Textarea placeholder="Recommendation" value={form.recommendation || ''} onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))} />
            </div>
          )}

          <DialogFooter className="gap-2">
            {wizardStep > 1 && <Button variant="outline" onClick={() => setWizardStep((s) => s - 1)}>Back</Button>}
            {wizardStep < 4 && <Button onClick={() => setWizardStep((s) => s + 1)}>Next</Button>}
            {wizardStep === 4 && <Button onClick={loadSourcePreview}><Calculator className="h-4 w-4 mr-1" />Load Data</Button>}
            {wizardStep === 5 && <Button onClick={runCalculation}>Calculate</Button>}
            {wizardStep >= 6 && <Button disabled={submitting} onClick={saveCalculation}>{submitting ? 'Saving…' : 'Save Calculation'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
