'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, FileSpreadsheet, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CPV_COLLECTIONS, CppInput, CppRecord, PROCESS_PARAMETERS, UTILITY_LIMITS,
  UtilityInput, UtilityRecord, YieldInput, YieldRecord, classifySpecification,
  classifyUtility, cppSchema, cpvPermissions, utilitySchema, yieldSchema,
} from '@/lib/cpv';
import {
  createCpp, createUtility, createYield, listCpvRecords,
} from '@/lib/cpv-service';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

const colors = { blue: '#2563eb', green: '#059669', amber: '#d97706', red: '#dc2626', violet: '#7c3aed' };

function Field({ form, name, label, type = 'text' }: { form: any; name: string; label: string; type?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem>
    <FormLabel>{label}</FormLabel>
    <FormControl><Input {...field} type={type} step={type === 'number' ? 'any' : undefined} value={field.value ?? ''} /></FormControl>
    <FormMessage />
  </FormItem>} />;
}

function ParameterSelect({ form }: { form: any }) {
  return <FormField control={form.control} name="parameterName" render={({ field }) => <FormItem>
    <FormLabel>Process Parameter</FormLabel>
    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select parameter" /></SelectTrigger></FormControl>
      <SelectContent>{PROCESS_PARAMETERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
    </Select><FormMessage />
  </FormItem>} />;
}

function exportExcel(rows: Array<Record<string, string | number>>, filename: string) {
  if (!rows.length) return toast.error('No trend data available to export');
  const headers = Object.keys(rows[0]);
  const table = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${row[header]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const blob = new Blob([table], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TrendChart({
  title,
  data,
  lines,
  limits,
}: {
  title: string;
  data: any[];
  lines: Array<{ key: string; label: string; color: string }>;
  limits?: { lower: number; upper: number };
}) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="h-[360px]">
    {!data.length ? <DataState loading={false} empty emptyText="Record data to generate this trend graph." /> :
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Legend />
        {limits && <><ReferenceLine y={limits.lower} stroke={colors.red} strokeDasharray="5 5" label="Lower" /><ReferenceLine y={limits.upper} stroke={colors.red} strokeDasharray="5 5" label="Upper" /></>}
        {lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
      </LineChart></ResponsiveContainer>}
  </CardContent></Card>;
}

export function CppWorkspace() {
  const { user, profile } = useAuth();
  const canEnter = cpvPermissions.canEnterCpp(profile?.role);
  const [loading, setLoading] = useState(true);
  const [yields, setYields] = useState<YieldRecord[]>([]);
  const [processRecords, setProcessRecords] = useState<CppRecord[]>([]);
  const [utilities, setUtilities] = useState<UtilityRecord[]>([]);
  const [yieldOpen, setYieldOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [product, setProduct] = useState('all');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const actor = { id: user?.uid, name: profile?.full_name, role: profile?.role };
  const yieldForm = useForm<YieldInput>({
    resolver: zodResolver(yieldSchema),
    defaultValues: { productName: '', batchNo: '', manufacturingDate: '', bulkYield: 0, fillingYield: 0, packingYield: 0, lowerLimit: 90, upperLimit: 100, observedValue: 0, recordedBy: profile?.full_name || '' },
  });
  const processForm = useForm<CppInput>({
    resolver: zodResolver(cppSchema),
    defaultValues: { productName: '', batchNo: '', manufacturingDate: '', processStage: 'Manufacturing', parameterName: '', observedValue: 0, targetValue: 0, lsl: 0, usl: 0, unit: '', recordedBy: profile?.full_name || '', reviewedBy: '' },
  });
  const utilityForm = useForm<UtilityInput>({
    resolver: zodResolver(utilitySchema),
    defaultValues: { productName: '', batchNo: '', manufacturingDate: '', hvacTemperature: 22, relativeHumidity: 50, differentialPressure: 15, compressedAirPressure: 6, wfiConductivity: 1, loopTemperature: 80, recordedBy: profile?.full_name || '' },
  });

  const load = async () => {
    setLoading(true);
    const [yieldData, cppData, utilityData] = await Promise.all([
      listCpvRecords<YieldRecord>(CPV_COLLECTIONS.yield),
      listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
      listCpvRecords<UtilityRecord>(CPV_COLLECTIONS.utility),
    ]);
    setYields(yieldData);
    setProcessRecords(cppData);
    setUtilities(utilityData);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const submitYield = yieldForm.handleSubmit(async (values) => {
    try {
      await createYield(values, actor);
      toast.success('Yield monitoring record saved');
      setYieldOpen(false);
      yieldForm.reset({ ...yieldForm.formState.defaultValues, recordedBy: profile?.full_name || '' } as YieldInput);
      await load();
    } catch (error) { console.error(error); toast.error('Yield record could not be saved'); }
  });
  const submitProcess = processForm.handleSubmit(async (values) => {
    try {
      await createCpp(values, actor);
      toast.success('Process parameter saved');
      setProcessOpen(false);
      processForm.reset({ ...processForm.formState.defaultValues, recordedBy: profile?.full_name || '' } as CppInput);
      await load();
    } catch (error) { console.error(error); toast.error('Process parameter could not be saved'); }
  });
  const submitUtility = utilityForm.handleSubmit(async (values) => {
    try {
      await createUtility(values, actor);
      toast.success('Utility parameters saved');
      setUtilityOpen(false);
      utilityForm.reset({ ...utilityForm.formState.defaultValues, recordedBy: profile?.full_name || '' } as UtilityInput);
      await load();
    } catch (error) { console.error(error); toast.error('Utility record could not be saved'); }
  });

  const yieldPreview = classifySpecification(Number(yieldForm.watch('observedValue')), (Number(yieldForm.watch('lowerLimit')) + Number(yieldForm.watch('upperLimit'))) / 2, Number(yieldForm.watch('lowerLimit')), Number(yieldForm.watch('upperLimit')));
  const processPreview = classifySpecification(Number(processForm.watch('observedValue')), Number(processForm.watch('targetValue')), Number(processForm.watch('lsl')), Number(processForm.watch('usl')));
  const utilityPreview = classifyUtility(utilityForm.watch());
  const yieldTrend = yields.slice().reverse().map((record) => ({ label: record.batchNo, bulk: record.bulkYield, filling: record.fillingYield, packing: record.packingYield, observed: record.observedValue }));
  const utilityTrend = utilities.slice().reverse().map((record) => ({ label: record.batchNo, hvac: record.hvacTemperature, humidity: record.relativeHumidity, pressure: record.differentialPressure, air: record.compressedAirPressure, wfi: record.wfiConductivity, loop: record.loopTemperature }));
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
    yields.filter((r) => product === 'all' || r.productName === product).forEach((record) => group(keyFor(record.manufacturingDate)).yields.push(record.observedValue));
    processRecords.filter((r) => product === 'all' || r.productName === product).forEach((record) => {
      const target = group(keyFor(record.manufacturingDate));
      if (record.parameterName === 'Fill Volume') target.fill.push(record.observedValue);
      if (record.parameterName.includes('Temperature')) target.temp.push(record.observedValue);
    });
    const average = (values: number[]) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
    return Array.from(groups.entries()).map(([label, values]) => ({ label, Yield: average(values.yields), 'Fill Volume': average(values.fill), Temperature: average(values.temp) }));
  }, [period, processRecords, product, yields]);

  return <div className="space-y-6">
    <PageHeading title="CPP Monitoring" description="Batch-level yield, manufacturing process, utility, and longitudinal CPP verification in one controlled workspace." />
    <Tabs defaultValue="yield" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-4">
        <TabsTrigger value="yield">1. Yield Monitoring</TabsTrigger>
        <TabsTrigger value="process">2. Process Parameters</TabsTrigger>
        <TabsTrigger value="utility">3. Utility Parameters</TabsTrigger>
        <TabsTrigger value="trend">4. Batch Wise CPP Trend</TabsTrigger>
      </TabsList>

      <TabsContent value="yield" className="space-y-5">
        <div className="flex justify-end"><Dialog open={yieldOpen} onOpenChange={setYieldOpen}><DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record Yield</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Yield Monitoring Entry</DialogTitle></DialogHeader>
          <Form {...yieldForm}><form onSubmit={submitYield} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field form={yieldForm} name="productName" label="Product Name" /><Field form={yieldForm} name="batchNo" label="Batch No" /><Field form={yieldForm} name="manufacturingDate" label="Manufacturing Date" type="date" />
            <Field form={yieldForm} name="bulkYield" label="Bulk Yield %" type="number" /><Field form={yieldForm} name="fillingYield" label="Filling Yield %" type="number" /><Field form={yieldForm} name="packingYield" label="Packing Yield %" type="number" />
            <Field form={yieldForm} name="lowerLimit" label="Lower Limit" type="number" /><Field form={yieldForm} name="upperLimit" label="Upper Limit" type="number" /><Field form={yieldForm} name="observedValue" label="Observed Value" type="number" />
            <Field form={yieldForm} name="recordedBy" label="Recorded By" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Auto Status</p><div className="mt-2"><StatusBadge status={yieldPreview === 'Complies' ? 'Within Limit' : yieldPreview} /></div></div>
          </div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setYieldOpen(false)}>Cancel</Button><Button type="submit">Save Yield</Button></div></form></Form>
        </DialogContent></Dialog></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Batches Monitored" value={yields.length} /><KpiCard label="Within Limit" value={yields.filter((r) => r.status === 'Complies').length} tone="green" /><KpiCard label="OOT" value={yields.filter((r) => r.status === 'OOT').length} tone="amber" /><KpiCard label="OOS" value={yields.filter((r) => r.status === 'OOS').length} tone="red" /></div>
        <TrendChart title="Batch Yield Trend" data={yieldTrend} lines={[{ key: 'bulk', label: 'Bulk Yield %', color: colors.blue }, { key: 'filling', label: 'Filling Yield %', color: colors.green }, { key: 'packing', label: 'Packing Yield %', color: colors.violet }]} limits={yields[0] ? { lower: yields[0].lowerLimit, upper: yields[0].upperLimit } : undefined} />
        <Card><CardHeader><CardTitle>Yield Register</CardTitle></CardHeader><CardContent className="p-0"><DataState loading={loading} empty={!yields.length} />{!loading && yields.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product / Batch</TableHead><TableHead>Date</TableHead><TableHead>Bulk</TableHead><TableHead>Filling</TableHead><TableHead>Packing</TableHead><TableHead>Observed</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{yields.map((r) => <TableRow key={r.id}><TableCell><p className="font-medium">{r.productName}</p><p className="text-xs text-muted-foreground">{r.batchNo}</p></TableCell><TableCell>{r.manufacturingDate}</TableCell><TableCell>{r.bulkYield}%</TableCell><TableCell>{r.fillingYield}%</TableCell><TableCell>{r.packingYield}%</TableCell><TableCell>{r.observedValue}%</TableCell><TableCell><StatusBadge status={r.status === 'Complies' ? 'Within Limit' : r.status} /></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="process" className="space-y-5">
        <div className="flex justify-end"><Dialog open={processOpen} onOpenChange={setProcessOpen}><DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record Process Parameter</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Process Parameter Entry</DialogTitle></DialogHeader>
          <Form {...processForm}><form onSubmit={submitProcess} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field form={processForm} name="productName" label="Product Name" /><Field form={processForm} name="batchNo" label="Batch No" /><Field form={processForm} name="manufacturingDate" label="Manufacturing Date" type="date" />
            <ParameterSelect form={processForm} /><Field form={processForm} name="unit" label="Unit" /><Field form={processForm} name="processStage" label="Process Stage" />
            <Field form={processForm} name="observedValue" label="Observed Value" type="number" /><Field form={processForm} name="targetValue" label="Target" type="number" /><Field form={processForm} name="lsl" label="LSL" type="number" /><Field form={processForm} name="usl" label="USL" type="number" />
            <Field form={processForm} name="recordedBy" label="Recorded By" /><Field form={processForm} name="reviewedBy" label="Reviewed By" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Auto Compliance</p><div className="mt-2"><StatusBadge status={processPreview} /></div></div>
          </div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setProcessOpen(false)}>Cancel</Button><Button type="submit">Save Parameter</Button></div></form></Form>
        </DialogContent></Dialog></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Process Observations" value={processRecords.length} /><KpiCard label="Complies" value={processRecords.filter((r) => r.status === 'Complies').length} tone="green" /><KpiCard label="OOT" value={processRecords.filter((r) => r.status === 'OOT').length} tone="amber" /><KpiCard label="OOS" value={processRecords.filter((r) => r.status === 'OOS').length} tone="red" /></div>
        <Card><CardHeader><CardTitle>Process Parameter Register</CardTitle></CardHeader><CardContent className="p-0"><DataState loading={loading} empty={!processRecords.length} />{!loading && processRecords.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product / Batch</TableHead><TableHead>Parameter</TableHead><TableHead>Observed</TableHead><TableHead>Target</TableHead><TableHead>LSL - USL</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{processRecords.map((r) => <TableRow key={r.id}><TableCell><p className="font-medium">{r.productName}</p><p className="text-xs text-muted-foreground">{r.batchNo}</p></TableCell><TableCell>{r.parameterName}</TableCell><TableCell>{r.observedValue} {r.unit}</TableCell><TableCell>{r.targetValue}</TableCell><TableCell>{r.lsl} - {r.usl}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="utility" className="space-y-5">
        <div className="flex justify-end"><Dialog open={utilityOpen} onOpenChange={setUtilityOpen}><DialogTrigger asChild><Button disabled={!canEnter}><Plus className="mr-2 h-4 w-4" />Record Utilities</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Utility Parameter Entry</DialogTitle></DialogHeader>
          <Form {...utilityForm}><form onSubmit={submitUtility} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field form={utilityForm} name="productName" label="Product Name" /><Field form={utilityForm} name="batchNo" label="Batch No" /><Field form={utilityForm} name="manufacturingDate" label="Manufacturing Date" type="date" />
            {Object.entries(UTILITY_LIMITS).map(([key, limits]) => <div key={key}><Field form={utilityForm} name={key} label={`${limits.label} (${limits.unit})`} type="number" /><p className="mt-1 text-xs text-muted-foreground">Configured limit: {limits.lsl} - {limits.usl}</p></div>)}
            <Field form={utilityForm} name="recordedBy" label="Recorded By" /><div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Overall Status</p><div className="mt-2"><StatusBadge status={utilityPreview.status} /></div></div>
          </div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setUtilityOpen(false)}>Cancel</Button><Button type="submit">Save Utilities</Button></div></form></Form>
        </DialogContent></Dialog></div>
        <TrendChart title="Utility Parameter Trend" data={utilityTrend} lines={[{ key: 'hvac', label: 'HVAC Temperature', color: colors.blue }, { key: 'humidity', label: 'Relative Humidity', color: colors.green }, { key: 'pressure', label: 'Differential Pressure', color: colors.amber }, { key: 'air', label: 'Compressed Air', color: colors.violet }, { key: 'wfi', label: 'WFI Conductivity', color: colors.red }, { key: 'loop', label: 'Loop Temperature', color: '#0891b2' }]} />
        <Card><CardHeader><CardTitle>Utility Register</CardTitle></CardHeader><CardContent className="p-0"><DataState loading={loading} empty={!utilities.length} />{!loading && utilities.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product / Batch</TableHead><TableHead>HVAC</TableHead><TableHead>RH</TableHead><TableHead>DP</TableHead><TableHead>Air</TableHead><TableHead>WFI</TableHead><TableHead>Loop</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{utilities.map((r) => <TableRow key={r.id}><TableCell><p className="font-medium">{r.productName}</p><p className="text-xs text-muted-foreground">{r.batchNo}</p></TableCell><TableCell>{r.hvacTemperature}°C</TableCell><TableCell>{r.relativeHumidity}%</TableCell><TableCell>{r.differentialPressure} Pa</TableCell><TableCell>{r.compressedAirPressure} bar</TableCell><TableCell>{r.wfiConductivity}</TableCell><TableCell>{r.loopTemperature}°C</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="trend" className="space-y-5">
        <div className="no-print flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-end">
          <div className="flex-1"><Label>Product</Label><Select value={product} onValueChange={setProduct}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Products</SelectItem>{products.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex-1"><Label>Group By</Label><Select value={period} onValueChange={(value: 'month' | 'quarter' | 'year') => setPeriod(value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">Month</SelectItem><SelectItem value="quarter">Quarter</SelectItem><SelectItem value="year">Year</SelectItem></SelectContent></Select></div>
          <Button variant="outline" onClick={printPage}><Download className="mr-2 h-4 w-4" />Export PDF</Button>
          <Button variant="outline" onClick={() => exportExcel(trendRows as Array<Record<string, string | number>>, 'batch-wise-cpp-trend.xls')}><FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel</Button>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <TrendChart title="Yield Trend" data={trendRows} lines={[{ key: 'Yield', label: 'Yield %', color: colors.green }]} />
          <TrendChart title="Fill Volume Trend" data={trendRows} lines={[{ key: 'Fill Volume', label: 'Fill Volume', color: colors.blue }]} />
          <TrendChart title="Temperature Trend" data={trendRows} lines={[{ key: 'Temperature', label: 'Temperature', color: colors.amber }]} />
        </div>
        <Card><CardHeader><CardTitle>Batch Wise CPP Trend Data</CardTitle></CardHeader><CardContent className="p-0"><DataState loading={loading} empty={!trendRows.length} />{!loading && trendRows.length > 0 && <Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Yield</TableHead><TableHead>Fill Volume</TableHead><TableHead>Temperature</TableHead></TableRow></TableHeader><TableBody>{trendRows.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell>{row.Yield ?? 'N/A'}</TableCell><TableCell>{row['Fill Volume'] ?? 'N/A'}</TableCell><TableCell>{row.Temperature ?? 'N/A'}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}
