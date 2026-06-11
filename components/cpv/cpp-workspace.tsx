'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar, Cell,
} from 'recharts';
import { Download, FileSpreadsheet, Link2, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CPV_COLLECTIONS, CppInput, CppRecord, PROCESS_PARAMETERS, UTILITY_LIMITS,
  UTILITY_PARAMETERS, UtilityInput, UtilityRecord, YieldInput, YieldRecord,
  YIELD_PARAMETERS, classifySpecification, classifyUtility, cppSchema,
  cpvPermissions, displayCpvStatus, PARAMETER_SPECS, utilitySchema, yieldSchema,
} from '@/lib/cpv';
import { createCpp, createUtility, createYield, listCpvRecords, loadCppBatches } from '@/lib/cpv-service';
import { resolveCppParameterSpec } from '@/lib/cpv-config-service';
import { useCpvConfig } from '@/hooks/use-cpv-config';
import { buildMonthlyCppReport, monthlyTrendData } from '@/lib/cpv-cpp-report';
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

function Field({ form, name, label, type = 'text', readOnly }: { form: ReturnType<typeof useForm<any>>; name: string; label: string; type?: string; readOnly?: boolean }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input {...field} type={type} readOnly={readOnly} step={type === 'number' ? 'any' : undefined} value={field.value ?? ''} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function AutoStatusPreview({ status }: { status: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/30 p-3">
      <p className="text-xs text-muted-foreground">Auto Status</p>
      <div className="mt-2"><StatusBadge status={displayCpvStatus(status)} /></div>
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
      <Label>Batch No *</Label>
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

function TrendChart({ title, data, lines, limits }: {
  title: string;
  data: Record<string, unknown>[];
  lines: Array<{ key: string; label: string; color: string }>;
  limits?: { lower: number; upper: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[340px]">
        {!data.length ? <DataState loading={false} empty emptyText="Record data to generate this trend graph." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis domain={['auto', 'auto']} /><Tooltip /><Legend />
              {limits && <><ReferenceLine y={limits.lower} stroke={colors.red} strokeDasharray="5 5" label="LSL" /><ReferenceLine y={limits.upper} stroke={colors.red} strokeDasharray="5 5" label="USL" /></>}
              {lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function exportExcel(rows: Array<Record<string, string | number>>, filename: string) {
  if (!rows.length) return toast.error('No data to export');
  const headers = Object.keys(rows[0]);
  downloadCsv(filename.replace('.xls', '.csv'), headers, rows.map((r) => headers.map((h) => r[h])));
}

export function CppWorkspace() {
  const { user, profile } = useAuth();
  const canEnter = cpvPermissions.canEnterCpp(profile?.role);
  const [loading, setLoading] = useState(true);
  const [yields, setYields] = useState<YieldRecord[]>([]);
  const [processRecords, setProcessRecords] = useState<CppRecord[]>([]);
  const [utilities, setUtilities] = useState<UtilityRecord[]>([]);
  const [batches, setBatches] = useState<Array<{ id: string; batch_number: string; product_name: string }>>([]);
  const [yieldOpen, setYieldOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [product, setProduct] = useState('all');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [processParamFilter, setProcessParamFilter] = useState('all');
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };

  const yieldForm = useForm<YieldInput>({
    resolver: zodResolver(yieldSchema),
    defaultValues: { productName: '', batchNo: '', manufacturingDate: new Date().toISOString().split('T')[0], bulkYield: 0, fillingYield: 0, packingYield: 0, lowerLimit: 95, upperLimit: 100, observedValue: 0, recordedBy: profile?.full_name || '' },
  });
  const processForm = useForm<CppInput>({
    resolver: zodResolver(cppSchema),
    defaultValues: { productName: '', batchNo: '', manufacturingDate: new Date().toISOString().split('T')[0], processStage: 'Manufacturing', parameterName: 'Fill Volume', observedValue: 0, targetValue: 0, lsl: 0, usl: 0, unit: '', recordedBy: profile?.full_name || '', reviewedBy: '' },
  });
  const utilityForm = useForm<UtilityInput>({
    resolver: zodResolver(utilitySchema),
    defaultValues: { productName: '', batchNo: '', manufacturingDate: new Date().toISOString().split('T')[0], hvacTemperature: 22, relativeHumidity: 50, differentialPressure: 15, compressedAirPressure: 6, wfiConductivity: 1, loopTemperature: 80, recordedBy: profile?.full_name || '' },
  });

  const load = async () => {
    setLoading(true);
    const [yieldData, cppData, utilityData, batchData] = await Promise.all([
      listCpvRecords<YieldRecord>(CPV_COLLECTIONS.yield),
      listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
      listCpvRecords<UtilityRecord>(CPV_COLLECTIONS.utility),
      loadCppBatches(),
    ]);
    setYields(yieldData);
    setProcessRecords(cppData);
    setUtilities(utilityData);
    setBatches(batchData);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const { config } = useCpvConfig();

  const applyParameterSpecs = useCallback((paramName: string) => {
    const productName = processForm.getValues('productName');
    const spec = resolveCppParameterSpec(config, paramName, productName || undefined)
      ?? PARAMETER_SPECS[paramName];
    if (spec) {
      processForm.setValue('targetValue', spec.target);
      processForm.setValue('lsl', spec.lsl);
      processForm.setValue('usl', spec.usl);
      processForm.setValue('unit', spec.unit);
    }
  }, [processForm, config]);

  useEffect(() => {
    const sub = processForm.watch((_, { name }) => {
      if (name === 'parameterName' || name === 'productName') {
        applyParameterSpecs(processForm.getValues('parameterName'));
      }
    });
    return () => sub.unsubscribe();
  }, [processForm, applyParameterSpecs]);

  const submitYield = yieldForm.handleSubmit(async (values) => {
    try {
      await createYield(values, actor);
      toast.success('Yield record saved — linked to batch data');
      setYieldOpen(false);
      yieldForm.reset({ ...yieldForm.formState.defaultValues, recordedBy: profile?.full_name || '' } as YieldInput);
      await load();
    } catch { toast.error('Could not save yield record'); }
  });

  const submitProcess = processForm.handleSubmit(async (values) => {
    try {
      await createCpp(values, actor);
      toast.success('Process parameter saved');
      setProcessOpen(false);
      processForm.reset({ ...processForm.formState.defaultValues, recordedBy: profile?.full_name || '' } as CppInput);
      await load();
    } catch { toast.error('Could not save process parameter'); }
  });

  const submitUtility = utilityForm.handleSubmit(async (values) => {
    try {
      await createUtility(values, actor);
      toast.success('Utility parameters saved');
      setUtilityOpen(false);
      utilityForm.reset({ ...utilityForm.formState.defaultValues, recordedBy: profile?.full_name || '' } as UtilityInput);
      await load();
    } catch { toast.error('Could not save utility record'); }
  });

  const yieldPreview = classifySpecification(Number(yieldForm.watch('observedValue')), (Number(yieldForm.watch('lowerLimit')) + Number(yieldForm.watch('upperLimit'))) / 2, Number(yieldForm.watch('lowerLimit')), Number(yieldForm.watch('upperLimit')));
  const processPreview = classifySpecification(Number(processForm.watch('observedValue')), Number(processForm.watch('targetValue')), Number(processForm.watch('lsl')), Number(processForm.watch('usl')));
  const utilityPreview = classifyUtility(utilityForm.watch());

  const yieldTrend = [...yields].reverse().slice(-20).map((r) => ({
    label: r.batchNo, bulk: r.bulkYield, filling: r.fillingYield, packing: r.packingYield, observed: r.observedValue,
  }));

  const processTrend = useMemo(() => {
    const filtered = processRecords
      .filter((r) => processParamFilter === 'all' || r.parameterName === processParamFilter)
      .slice(0, 30)
      .reverse();
    return filtered.map((r) => ({
      label: r.batchNo,
      observed: r.observedValue,
      target: r.targetValue,
      lsl: r.lsl,
      usl: r.usl,
    }));
  }, [processRecords, processParamFilter]);

  const utilityTrend = [...utilities].reverse().slice(-20).map((r) => ({
    label: r.batchNo,
    roomTemp: r.hvacTemperature,
    humidity: r.relativeHumidity,
    pressure: r.differentialPressure,
  }));

  const products = Array.from(new Set([...yields.map((r) => r.productName), ...processRecords.map((r) => r.productName), ...utilities.map((r) => r.productName)]));

  const trendRows = useMemo(() => {
    const keyFor = (dateText: string) => {
      const date = new Date(dateText);
      if (period === 'year') return String(date.getFullYear());
      if (period === 'quarter') return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    };
    const groups = new Map<string, { yields: number[]; fill: number[]; temp: number[] }>();
    const group = (key: string) => {
      if (!groups.has(key)) groups.set(key, { yields: [], fill: [], temp: [] });
      return groups.get(key)!;
    };
    yields.filter((r) => product === 'all' || r.productName === product).forEach((r) => group(keyFor(r.manufacturingDate)).yields.push(r.observedValue));
    processRecords.filter((r) => product === 'all' || r.productName === product).forEach((r) => {
      const target = group(keyFor(r.manufacturingDate));
      if (r.parameterName === 'Fill Volume') target.fill.push(r.observedValue);
      if (r.parameterName.includes('Temperature')) target.temp.push(r.observedValue);
    });
    const avg = (values: number[]) => values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2)) : null;
    return Array.from(groups.entries()).map(([label, v]) => ({ label, Yield: avg(v.yields), 'Fill Volume': avg(v.fill), Temperature: avg(v.temp) }));
  }, [period, processRecords, product, yields]);

  const monthlyReport = useMemo(
    () => buildMonthlyCppReport(yields, processRecords, utilities, reportYear, reportMonth),
    [yields, processRecords, utilities, reportYear, reportMonth],
  );

  const monthlyCompliance = useMemo(() => {
    const all = [...processRecords, ...yields.map((y) => ({ ...y, status: y.status, manufacturingDate: y.manufacturingDate, createdAt: y.createdAt }))];
    return monthlyTrendData(all, reportYear);
  }, [processRecords, yields, reportYear]);

  const onBatchPick = (form: ReturnType<typeof useForm<any>>, batch: { batch_number: string; product_name: string } | null) => {
    if (batch) {
      form.setValue('batchNo', batch.batch_number);
      if (batch.product_name) form.setValue('productName', batch.product_name);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading title="CPP Monitoring" description="Critical Process Parameters — yield, process, utility monitoring with auto Pass/OOT/OOS classification, trend analysis, and batch linkage." />

      <Tabs defaultValue="yield" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-4">
          <TabsTrigger value="yield">Yield Monitoring</TabsTrigger>
          <TabsTrigger value="process">Process Parameters</TabsTrigger>
          <TabsTrigger value="utility">Utility Parameters</TabsTrigger>
          <TabsTrigger value="trend">Batch Trend</TabsTrigger>
        </TabsList>

        {/* ── Yield Monitoring ── */}
        <TabsContent value="yield" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Parameters: {YIELD_PARAMETERS.join(' · ')}</p>
            <Dialog open={yieldOpen} onOpenChange={setYieldOpen}>
              <DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record Yield</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader><DialogTitle>Yield Monitoring Entry</DialogTitle></DialogHeader>
                <Form {...yieldForm}>
                  <form onSubmit={submitYield} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <BatchSelect batches={batches} value={yieldForm.watch('batchNo')} onChange={(v) => yieldForm.setValue('batchNo', v)} onBatchPick={(b) => onBatchPick(yieldForm, b)} />
                      <Field form={yieldForm} name="productName" label="Product" />
                      <Field form={yieldForm} name="manufacturingDate" label="Date" type="date" />
                      <Field form={yieldForm} name="bulkYield" label="Bulk Yield %" type="number" />
                      <Field form={yieldForm} name="fillingYield" label="Filling Yield %" type="number" />
                      <Field form={yieldForm} name="packingYield" label="Packing Yield %" type="number" />
                      <Field form={yieldForm} name="observedValue" label="Observed Value (Overall) %" type="number" />
                      <Field form={yieldForm} name="lowerLimit" label="LSL" type="number" />
                      <Field form={yieldForm} name="upperLimit" label="USL" type="number" />
                      <Field form={yieldForm} name="recordedBy" label="Recorded By" />
                      <AutoStatusPreview status={yieldPreview} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setYieldOpen(false)}>Cancel</Button>
                      <Button type="submit">Save Yield</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Batches Monitored" value={yields.length} />
            <KpiCard label="Pass" value={yields.filter((r) => displayCpvStatus(r.status) === 'Pass').length} tone="green" />
            <KpiCard label="OOT" value={yields.filter((r) => r.status === 'OOT').length} tone="amber" />
            <KpiCard label="OOS" value={yields.filter((r) => r.status === 'OOS').length} tone="red" />
          </div>

          <TrendChart title="Batch Yield Trend" data={yieldTrend} lines={[
            { key: 'bulk', label: 'Bulk Yield %', color: colors.blue },
            { key: 'filling', label: 'Filling Yield %', color: colors.green },
            { key: 'packing', label: 'Packing Yield %', color: colors.violet },
          ]} limits={yields[0] ? { lower: yields[0].lowerLimit, upper: yields[0].upperLimit } : undefined} />

          <Card>
            <CardHeader><CardTitle>Yield Register</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataState loading={loading} empty={!yields.length} />
              {!loading && yields.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Product / Batch</TableHead><TableHead>Date</TableHead>
                      <TableHead>Bulk</TableHead><TableHead>Filling</TableHead><TableHead>Packing</TableHead>
                      <TableHead>Observed</TableHead><TableHead>Status</TableHead><TableHead>Batch Link</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{yields.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><p className="font-medium">{r.productName}</p><p className="text-xs text-muted-foreground font-mono">{r.batchNo}</p></TableCell>
                        <TableCell className="text-sm">{r.manufacturingDate}</TableCell>
                        <TableCell>{r.bulkYield}%</TableCell><TableCell>{r.fillingYield}%</TableCell><TableCell>{r.packingYield}%</TableCell>
                        <TableCell className="font-mono">{r.observedValue}%</TableCell>
                        <TableCell><StatusBadge status={displayCpvStatus(r.status)} /></TableCell>
                        <TableCell>{(r as YieldRecord & { batchLinked?: boolean }).batchLinked ? <Badge variant="outline" className="gap-1 text-xs"><Link2 className="h-3 w-3" />Linked</Badge> : '—'}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Process Parameters ── */}
        <TabsContent value="process" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{PROCESS_PARAMETERS.join(' · ')}</p>
            <Dialog open={processOpen} onOpenChange={setProcessOpen}>
              <DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record Parameter</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader><DialogTitle>Process Parameter Entry</DialogTitle></DialogHeader>
                <Form {...processForm}>
                  <form onSubmit={submitProcess} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <BatchSelect batches={batches} value={processForm.watch('batchNo')} onChange={(v) => processForm.setValue('batchNo', v)} onBatchPick={(b) => onBatchPick(processForm, b)} />
                      <Field form={processForm} name="productName" label="Product" />
                      <Field form={processForm} name="manufacturingDate" label="Date" type="date" />
                      <FormField control={processForm.control} name="parameterName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parameter Name *</FormLabel>
                          <Select value={field.value} onValueChange={(v) => { field.onChange(v); applyParameterSpecs(v); }}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{PROCESS_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <Field form={processForm} name="observedValue" label="Observed Value" type="number" />
                      <Field form={processForm} name="targetValue" label="Target Value" type="number" />
                      <Field form={processForm} name="lsl" label="LSL" type="number" />
                      <Field form={processForm} name="usl" label="USL" type="number" />
                      <Field form={processForm} name="unit" label="Unit" />
                      <Field form={processForm} name="recordedBy" label="Recorded By" />
                      <AutoStatusPreview status={processPreview} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setProcessOpen(false)}>Cancel</Button>
                      <Button type="submit">Save Parameter</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Observations" value={processRecords.length} />
            <KpiCard label="Pass" value={processRecords.filter((r) => displayCpvStatus(r.status) === 'Pass').length} tone="green" />
            <KpiCard label="OOT" value={processRecords.filter((r) => r.status === 'OOT').length} tone="amber" />
            <KpiCard label="OOS" value={processRecords.filter((r) => r.status === 'OOS').length} tone="red" />
          </div>

          <div className="flex gap-3 items-end no-print">
            <div className="flex-1 max-w-xs">
              <Label>Trend Parameter</Label>
              <Select value={processParamFilter} onValueChange={setProcessParamFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parameters</SelectItem>
                  {PROCESS_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TrendChart title={`Process Parameter Trend${processParamFilter !== 'all' ? `: ${processParamFilter}` : ''}`} data={processTrend} lines={[
            { key: 'observed', label: 'Observed', color: colors.blue },
            { key: 'target', label: 'Target', color: colors.green },
          ]} limits={processTrend[0] ? { lower: processTrend[0].lsl as number, upper: processTrend[0].usl as number } : undefined} />

          <Card>
            <CardHeader><CardTitle>Process Parameter Register</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataState loading={loading} empty={!processRecords.length} />
              {!loading && processRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Product / Batch</TableHead><TableHead>Parameter</TableHead>
                      <TableHead>Observed</TableHead><TableHead>Target</TableHead><TableHead>LSL – USL</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{processRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><p className="font-medium">{r.productName}</p><p className="text-xs font-mono text-muted-foreground">{r.batchNo}</p></TableCell>
                        <TableCell>{r.parameterName}</TableCell>
                        <TableCell className="font-mono">{r.observedValue} {r.unit}</TableCell>
                        <TableCell>{r.targetValue}</TableCell>
                        <TableCell>{r.lsl} – {r.usl}</TableCell>
                        <TableCell><StatusBadge status={displayCpvStatus(r.status)} /></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Utility Parameters ── */}
        <TabsContent value="utility" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{UTILITY_PARAMETERS.join(' · ')}</p>
            <Dialog open={utilityOpen} onOpenChange={setUtilityOpen}>
              <DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record Utilities</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader><DialogTitle>Utility Parameter Entry</DialogTitle></DialogHeader>
                <Form {...utilityForm}>
                  <form onSubmit={submitUtility} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <BatchSelect batches={batches} value={utilityForm.watch('batchNo')} onChange={(v) => utilityForm.setValue('batchNo', v)} onBatchPick={(b) => onBatchPick(utilityForm, b)} />
                      <Field form={utilityForm} name="productName" label="Product" />
                      <Field form={utilityForm} name="manufacturingDate" label="Date" type="date" />
                      {(['hvacTemperature', 'relativeHumidity', 'differentialPressure'] as const).map((key) => {
                        const limits = UTILITY_LIMITS[key];
                        return (
                          <div key={key}>
                            <Field form={utilityForm} name={key} label={`${limits.label} (${limits.unit})`} type="number" />
                            <p className="mt-1 text-xs text-muted-foreground">Spec: {limits.lsl} – {limits.usl} {limits.unit}</p>
                          </div>
                        );
                      })}
                      <Field form={utilityForm} name="recordedBy" label="Recorded By" />
                      <AutoStatusPreview status={utilityPreview.status} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setUtilityOpen(false)}>Cancel</Button>
                      <Button type="submit">Save Utilities</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <TrendChart title="Utility Parameter Trend" data={utilityTrend} lines={[
            { key: 'roomTemp', label: 'Room Temperature °C', color: colors.blue },
            { key: 'humidity', label: 'Relative Humidity %', color: colors.green },
            { key: 'pressure', label: 'Differential Pressure Pa', color: colors.amber },
          ]} />

          <Card>
            <CardHeader><CardTitle>Utility Register</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataState loading={loading} empty={!utilities.length} />
              {!loading && utilities.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Product / Batch</TableHead><TableHead>Room Temp</TableHead>
                      <TableHead>RH</TableHead><TableHead>DP</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{utilities.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><p className="font-medium">{r.productName}</p><p className="text-xs font-mono text-muted-foreground">{r.batchNo}</p></TableCell>
                        <TableCell>{r.hvacTemperature}°C</TableCell>
                        <TableCell>{r.relativeHumidity}%</TableCell>
                        <TableCell>{r.differentialPressure} Pa</TableCell>
                        <TableCell><StatusBadge status={displayCpvStatus(r.status)} /></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Batch Trend + Monthly Report ── */}
        <TabsContent value="trend" className="space-y-5">
          <Card className="no-print">
            <CardHeader><CardTitle className="text-base">Filters & Export</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label>Product</Label><Select value={product} onValueChange={setProduct}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Products</SelectItem>{products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Group By</Label><Select value={period} onValueChange={(v: 'month' | 'quarter' | 'year') => setPeriod(v)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">Month</SelectItem><SelectItem value="quarter">Quarter</SelectItem><SelectItem value="year">Year</SelectItem></SelectContent></Select></div>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <Button variant="outline" className="gap-2" onClick={() => printPage()}><Printer className="h-4 w-4" />Export PDF</Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportExcel(trendRows as Array<Record<string, string | number>>, 'cpp-batch-trend.csv')}><FileSpreadsheet className="h-4 w-4" />Export Excel</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <TrendChart title="Yield Trend" data={trendRows} lines={[{ key: 'Yield', label: 'Yield %', color: colors.green }]} />
            <TrendChart title="Fill Volume Trend" data={trendRows} lines={[{ key: 'Fill Volume', label: 'Fill Volume', color: colors.blue }]} />
            <TrendChart title="Temperature Trend" data={trendRows} lines={[{ key: 'Temperature', label: 'Temperature', color: colors.amber }]} />
          </div>

          {/* Monthly Report */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Monthly CPP Report</CardTitle>
                  <CardDescription>Aggregated yield, process, and utility compliance for the selected period</CardDescription>
                </div>
                <div className="flex gap-2 no-print">
                  <Select value={reportMonth} onValueChange={setReportMonth}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                      <SelectItem key={m} value={m}>{new Date(2000, Number(m) - 1).toLocaleDateString('en-US', { month: 'long' })}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <Select value={reportYear} onValueChange={setReportYear}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{[reportYear, String(Number(reportYear) - 1)].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => printPage()}><Download className="h-4 w-4" />Print Report</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Yield Records', ...monthlyReport.yield },
                  { label: 'Process Records', ...monthlyReport.process },
                  { label: 'Utility Records', ...monthlyReport.utility },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.total}</p>
                    <div className="flex gap-2 mt-1 text-xs">
                      <span className="text-emerald-600">Pass: {s.pass}</span>
                      <span className="text-amber-600">OOT: {s.oot}</span>
                      <span className="text-red-600">OOS: {s.oos}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Compliance Trend ({reportYear})</CardTitle></CardHeader>
                <CardContent className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyCompliance}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} unit="%" /><Tooltip />
                      <Bar dataKey="complianceRate" name="Compliance %" radius={[4, 4, 0, 0]}>
                        {monthlyCompliance.map((entry) => (
                          <Cell key={entry.month} fill={entry.complianceRate >= 95 ? colors.green : entry.complianceRate >= 80 ? colors.amber : colors.red} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {monthlyReport.process.byParameter.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Parameter</TableHead><TableHead>Total</TableHead><TableHead>Pass</TableHead><TableHead>OOT</TableHead><TableHead>OOS</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{monthlyReport.process.byParameter.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.total}</TableCell>
                        <TableCell className="text-emerald-600">{p.pass}</TableCell>
                        <TableCell className="text-amber-600">{p.oot}</TableCell>
                        <TableCell className="text-red-600">{p.oos}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch Wise CPP Trend Data</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataState loading={loading} empty={!trendRows.length} />
              {!loading && trendRows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Yield</TableHead><TableHead>Fill Volume</TableHead><TableHead>Temperature</TableHead></TableRow></TableHeader>
                  <TableBody>{trendRows.map((row) => (
                    <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell>{row.Yield ?? 'N/A'}</TableCell><TableCell>{row['Fill Volume'] ?? 'N/A'}</TableCell><TableCell>{row.Temperature ?? 'N/A'}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
