'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, FileSpreadsheet, Link2, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CPV_COLLECTIONS, CQA_PARAMETERS, CQA_PARAMETER_SPECS, CqaInput, CqaRecord,
  classifyCqaStatus, cqaSchema, cpvPermissions, displayCpvStatus, isQualitativeCqaParameter,
} from '@/lib/cpv';
import { buildMonthlyCqaReport, cqaMonthlyTrendData, cqaParameterTrendData } from '@/lib/cpv-cqa-report';
import { createCqa, listCpvRecords, loadCppBatches } from '@/lib/cpv-service';
import { resolveCqaParameterSpec } from '@/lib/cpv-config-service';
import { useCpvConfig } from '@/hooks/use-cpv-config';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const colors = { blue: '#2563eb', green: '#059669', amber: '#d97706', red: '#dc2626', violet: '#7c3aed' };

function Field({ form, name, label, type = 'text', readOnly }: {
  form: ReturnType<typeof useForm<CqaInput>>;
  name: keyof CqaInput;
  label: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input
            {...field}
            type={type}
            readOnly={readOnly}
            step={type === 'number' ? 'any' : undefined}
            value={field.value ?? ''}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function AutoStatusPreview({ status }: { status: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/30 p-3">
      <p className="text-xs text-muted-foreground">Auto Compliance</p>
      <div className="mt-2"><StatusBadge status={displayCpvStatus(status)} /></div>
      <p className="mt-1 text-[10px] text-muted-foreground">OOT / OOS detected automatically</p>
    </div>
  );
}

function BatchSelect({ batches, value, onChange, onBatchPick }: {
  batches: Array<{ id: string; batch_number: string; product_name: string }>;
  value: string;
  onChange: (v: string) => void;
  onBatchPick: (batch: { batch_number: string; product_name: string } | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>Batch *</Label>
      <Select value={value || 'manual'} onValueChange={(v) => {
        if (v === 'manual') { onChange(''); onBatchPick(null); return; }
        const batch = batches.find((b) => b.batch_number === v);
        onChange(v);
        onBatchPick(batch || null);
      }}>
        <SelectTrigger><SelectValue placeholder="Select or type batch" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">Enter manually below</SelectItem>
          {batches.map((b) => (
            <SelectItem key={b.id} value={b.batch_number}>{b.batch_number} — {b.product_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input placeholder="Batch number" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}

function TrendChart({ title, data, limits }: {
  title: string;
  data: Array<{ label: string; observed: number; target: number; lsl: number; usl: number }>;
  limits?: { lower: number; upper: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[360px]">
        {!data.length ? <DataState loading={false} empty emptyText="Record CQA results to generate trend graphs." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              {limits && (
                <>
                  <ReferenceLine y={limits.lower} stroke={colors.red} strokeDasharray="5 5" label="LSL" />
                  <ReferenceLine y={limits.upper} stroke={colors.red} strokeDasharray="5 5" label="USL" />
                </>
              )}
              <Line type="monotone" dataKey="observed" name="Observed" stroke={colors.blue} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="target" name="Target" stroke={colors.green} strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function exportCsv(records: CqaRecord[], filename: string) {
  if (!records.length) return toast.error('No data to export');
  const headers = ['Product', 'Batch', 'Parameter', 'Test Date', 'Observed', 'Target', 'LSL', 'USL', 'Unit', 'Status', 'PQR Linked'];
  downloadCsv(filename, headers, records.map((r) => [
    r.productName, r.batchNo, r.testParameter, r.testDate || '',
    r.observedValue, r.target, r.lsl, r.usl, r.unit,
    displayCpvStatus(r.status), r.pqrId || r.pqr_id ? 'Yes' : 'No',
  ]));
}

export function CqaWorkspace() {
  const { user, profile } = useAuth();
  const canEnter = cpvPermissions.canEnterCqa(profile?.role);
  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CqaRecord[]>([]);
  const [batches, setBatches] = useState<Array<{ id: string; batch_number: string; product_name: string }>>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [paramFilter, setParamFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  const defaultParameter = CQA_PARAMETERS[0];
  const defaultSpec = CQA_PARAMETER_SPECS[defaultParameter];

  const form = useForm<CqaInput>({
    resolver: zodResolver(cqaSchema),
    defaultValues: {
      productName: '',
      batchNo: '',
      testDate: new Date().toISOString().split('T')[0],
      testParameter: defaultParameter,
      observedValue: defaultSpec.target,
      target: defaultSpec.target,
      lsl: defaultSpec.lsl,
      usl: defaultSpec.usl,
      unit: defaultSpec.unit,
      recordedBy: profile?.full_name || '',
      reviewedBy: '',
    },
  });

  const load = async () => {
    setLoading(true);
    const [cqaData, batchData] = await Promise.all([
      listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
      loadCppBatches(),
    ]);
    setRecords(cqaData);
    setBatches(batchData);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const { config } = useCpvConfig();

  const applyParameterSpecs = useCallback((paramName: string) => {
    const productName = form.getValues('productName');
    const resolved = resolveCqaParameterSpec(config, paramName, productName || undefined);
    const spec = resolved ?? CQA_PARAMETER_SPECS[paramName as typeof CQA_PARAMETERS[number]];
    if (!spec) return;
    form.setValue('target', spec.target);
    form.setValue('lsl', spec.lsl);
    form.setValue('usl', spec.usl);
    form.setValue('unit', spec.unit);
    if ('type' in spec && spec.type === 'qualitative') {
      form.setValue('observedValue', 1);
    }
  }, [form, config]);

  useEffect(() => {
    const sub = form.watch((_, { name }) => {
      if (name === 'testParameter' || name === 'productName') {
        applyParameterSpecs(form.getValues('testParameter'));
      }
    });
    return () => sub.unsubscribe();
  }, [form, applyParameterSpecs]);

  const watched = form.watch();
  const previewStatus = classifyCqaStatus(
    watched.testParameter,
    Number(watched.observedValue),
    Number(watched.target),
    Number(watched.lsl),
    Number(watched.usl),
  );
  const isQualitative = isQualitativeCqaParameter(watched.testParameter);

  const submit = form.handleSubmit(async (values) => {
    try {
      await createCqa(values, actor);
      toast.success('CQA result saved — auto-linked to batch and PQR data');
      setEntryOpen(false);
      form.reset({
        ...form.formState.defaultValues,
        testDate: new Date().toISOString().split('T')[0],
        recordedBy: profile?.full_name || '',
      } as CqaInput);
      applyParameterSpecs(defaultParameter);
      await load();
    } catch {
      toast.error('CQA record could not be saved');
    }
  });

  const onBatchPick = (batch: { batch_number: string; product_name: string } | null) => {
    if (batch) {
      form.setValue('batchNo', batch.batch_number);
      if (batch.product_name) form.setValue('productName', batch.product_name);
    }
  };

  const products = Array.from(new Set(records.map((r) => r.productName).filter(Boolean)));

  const filteredRecords = useMemo(() => records.filter((r) => {
    if (productFilter !== 'all' && r.productName !== productFilter) return false;
    if (paramFilter !== 'all' && r.testParameter !== paramFilter) return false;
    return true;
  }), [records, productFilter, paramFilter]);

  const stats = useMemo(() => ({
    total: filteredRecords.length,
    pass: filteredRecords.filter((r) => displayCpvStatus(r.status) === 'Pass').length,
    oot: filteredRecords.filter((r) => r.status === 'OOT').length,
    oos: filteredRecords.filter((r) => r.status === 'OOS').length,
    pqrLinked: filteredRecords.filter((r) => r.pqrId || r.pqr_id || r.batchLinked).length,
  }), [filteredRecords]);

  const trendData = useMemo(
    () => cqaParameterTrendData(
      records.filter((r) => productFilter === 'all' || r.productName === productFilter),
      paramFilter === 'all' ? CQA_PARAMETERS[0] : paramFilter,
    ),
    [records, paramFilter, productFilter],
  );

  const trendLimits = trendData[0] ? { lower: trendData[0].lsl, upper: trendData[0].usl } : undefined;

  const monthlyReport = useMemo(
    () => buildMonthlyCqaReport(records, reportYear, reportMonth),
    [records, reportYear, reportMonth],
  );

  const monthlyCompliance = useMemo(
    () => cqaMonthlyTrendData(records, reportYear),
    [records, reportYear],
  );

  const formatObserved = (r: CqaRecord) => {
    if (isQualitativeCqaParameter(r.testParameter)) {
      return r.observedValue >= 1 ? 'Pass' : 'Fail';
    }
    return `${r.observedValue} ${r.unit}`.trim();
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="CQA Monitoring"
        description="Critical Quality Attributes — unified monitoring for Assay, pH, physical, sterility, endotoxin, particulate, and preservative tests with auto compliance, OOT/OOS detection, trend graphs, and PQR linkage."
      />

      {!canEnter && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Your role has read-only access. QC and QA roles can record CQA results.
        </p>
      )}

      <Tabs defaultValue="monitoring" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-3">
          <TabsTrigger value="monitoring">CQA Monitoring</TabsTrigger>
          <TabsTrigger value="trends">Trend Graphs</TabsTrigger>
          <TabsTrigger value="report">CQA Report</TabsTrigger>
        </TabsList>

        {/* ── Monitoring ── */}
        <TabsContent value="monitoring" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Parameters: {CQA_PARAMETERS.join(' · ')}
            </p>
            <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record CQA Result</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader><DialogTitle>CQA Monitoring Entry</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <BatchSelect
                        batches={batches}
                        value={form.watch('batchNo')}
                        onChange={(v) => form.setValue('batchNo', v)}
                        onBatchPick={onBatchPick}
                      />
                      <Field form={form} name="productName" label="Product" />
                      <Field form={form} name="testDate" label="Test Date" type="date" />
                      <FormField control={form.control} name="testParameter" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parameter *</FormLabel>
                          <Select value={field.value} onValueChange={(v) => { field.onChange(v); applyParameterSpecs(v); }}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {CQA_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {isQualitative ? (
                        <FormField control={form.control} name="observedValue" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observed (Pass/Fail) *</FormLabel>
                            <Select
                              value={String(field.value >= 1 ? 1 : 0)}
                              onValueChange={(v) => field.onChange(Number(v))}
                            >
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="1">Pass</SelectItem>
                                <SelectItem value="0">Fail</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      ) : (
                        <Field form={form} name="observedValue" label="Observed" type="number" />
                      )}
                      <Field form={form} name="target" label="Target" type="number" readOnly={isQualitative} />
                      <Field form={form} name="lsl" label="LSL" type="number" readOnly={isQualitative} />
                      <Field form={form} name="usl" label="USL" type="number" readOnly={isQualitative} />
                      <Field form={form} name="unit" label="Unit" readOnly={isQualitative} />
                      <Field form={form} name="recordedBy" label="Recorded By" />
                      <Field form={form} name="reviewedBy" label="Reviewed By" />
                      <AutoStatusPreview status={previewStatus} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button>
                      <Button type="submit">Save CQA Result</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap gap-3 no-print">
            <div className="w-48">
              <Label>Filter Product</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-56">
              <Label>Filter Parameter</Label>
              <Select value={paramFilter} onValueChange={setParamFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parameters</SelectItem>
                  {CQA_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Total Records" value={stats.total} />
            <KpiCard label="Pass" value={stats.pass} tone="green" />
            <KpiCard label="OOT" value={stats.oot} tone="amber" />
            <KpiCard label="OOS" value={stats.oos} tone="red" />
            <KpiCard label="PQR Linked" value={stats.pqrLinked} tone="blue" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>CQA Register</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCsv(filteredRecords, 'cqa-register.csv')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <DataState loading={loading} empty={!filteredRecords.length} />
              {!loading && filteredRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product / Batch</TableHead>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Test Date</TableHead>
                        <TableHead>Observed</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>LSL – USL</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>PQR Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium">{r.productName}</p>
                            <p className="text-xs font-mono text-muted-foreground">{r.batchNo}</p>
                          </TableCell>
                          <TableCell>{r.testParameter}</TableCell>
                          <TableCell className="text-sm">{r.testDate || '—'}</TableCell>
                          <TableCell className="font-mono">{formatObserved(r)}</TableCell>
                          <TableCell>{isQualitativeCqaParameter(r.testParameter) ? 'Pass' : r.target}</TableCell>
                          <TableCell className="text-sm">
                            {isQualitativeCqaParameter(r.testParameter) ? 'Pass/Fail' : `${r.lsl} – ${r.usl} ${r.unit}`}
                          </TableCell>
                          <TableCell><StatusBadge status={displayCpvStatus(r.status)} /></TableCell>
                          <TableCell>
                            {(r.pqrId || r.pqr_id || r.batchLinked) ? (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Link2 className="h-3 w-3" />
                                {r.pqrId || r.pqr_id ? 'PQR Linked' : 'Batch Linked'}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trends ── */}
        <TabsContent value="trends" className="space-y-5">
          <div className="flex flex-wrap gap-3 no-print">
            <div className="w-56">
              <Label>Trend Parameter</Label>
              <Select value={paramFilter === 'all' ? CQA_PARAMETERS[0] : paramFilter} onValueChange={setParamFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CQA_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Product</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TrendChart
            title={`CQA Trend: ${paramFilter === 'all' ? CQA_PARAMETERS[0] : paramFilter}`}
            data={trendData}
            limits={isQualitativeCqaParameter(paramFilter === 'all' ? CQA_PARAMETERS[0] : paramFilter) ? undefined : trendLimits}
          />

          <Card>
            <CardHeader><CardTitle>Monthly Compliance Trend ({reportYear})</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCompliance} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="complianceRate" name="Compliance %" fill={colors.green} radius={[4, 4, 0, 0]}>
                    {monthlyCompliance.map((entry) => (
                      <Cell key={entry.month} fill={entry.complianceRate >= 95 ? colors.green : entry.complianceRate >= 80 ? colors.amber : colors.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Report ── */}
        <TabsContent value="report" className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 no-print">
            <div>
              <Label>Report Year</Label>
              <Select value={reportYear} onValueChange={setReportYear}>
                <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((offset) => {
                    const y = String(new Date().getFullYear() - offset);
                    return <SelectItem key={y} value={y}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Report Month</Label>
              <Select value={reportMonth} onValueChange={setReportMonth}>
                <SelectTrigger className="mt-1 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return (
                      <SelectItem key={m} value={m}>
                        {new Date(Number(reportYear), i).toLocaleDateString('en-US', { month: 'long' })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => printPage()}>
              <Printer className="mr-2 h-4 w-4" />Print Report
            </Button>
            <Button variant="outline" onClick={() => exportCsv(monthlyReport.records, `cqa-report-${reportYear}-${reportMonth}.csv`)}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </div>

          <div id="cqa-report" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>CQA Monitoring Report</CardTitle>
                <CardDescription>
                  {new Date(Number(reportYear), Number(reportMonth) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  {' · '}Generated {new Date(monthlyReport.generatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
                  <KpiCard label="Total Tests" value={monthlyReport.total} />
                  <KpiCard label="Pass" value={monthlyReport.pass} tone="green" />
                  <KpiCard label="OOT" value={monthlyReport.oot} tone="amber" />
                  <KpiCard label="OOS" value={monthlyReport.oos} tone="red" />
                  <KpiCard label="Compliance Rate" value={`${monthlyReport.complianceRate}%`} tone={monthlyReport.complianceRate >= 95 ? 'green' : 'amber'} />
                </div>

                <p className="mb-4 text-sm text-muted-foreground">
                  This report feeds directly into Product Quality Review (PQR) snapshots via the cpv_cqa collection.
                  OOT/OOS results automatically trigger deviation and OOS investigations.
                </p>

                {monthlyReport.byParameter.length > 0 && (
                  <div className="mb-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parameter</TableHead>
                          <TableHead>Tests</TableHead>
                          <TableHead>Pass</TableHead>
                          <TableHead>OOT</TableHead>
                          <TableHead>OOS</TableHead>
                          <TableHead>Compliance %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyReport.byParameter.map((p) => (
                          <TableRow key={p.name}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>{p.total}</TableCell>
                            <TableCell>{p.pass}</TableCell>
                            <TableCell>{p.oot}</TableCell>
                            <TableCell>{p.oos}</TableCell>
                            <TableCell>{p.complianceRate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {monthlyReport.records.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Parameter</TableHead>
                          <TableHead>Observed</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>LSL – USL</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyReport.records.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.productName}</TableCell>
                            <TableCell className="font-mono text-sm">{r.batchNo}</TableCell>
                            <TableCell>{r.testParameter}</TableCell>
                            <TableCell>{formatObserved(r)}</TableCell>
                            <TableCell>{isQualitativeCqaParameter(r.testParameter) ? 'Pass' : r.target}</TableCell>
                            <TableCell>{isQualitativeCqaParameter(r.testParameter) ? 'Pass/Fail' : `${r.lsl} – ${r.usl}`}</TableCell>
                            <TableCell><StatusBadge status={displayCpvStatus(r.status)} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <DataState loading={false} empty emptyText="No CQA records for the selected period." />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
