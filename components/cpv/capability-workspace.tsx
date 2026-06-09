'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { addDoc, collection } from 'firebase/firestore';
import { Download, FileBarChart, Save } from 'lucide-react';
import { toast } from 'sonner';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import {
  AssayRecord, CPV_COLLECTIONS, CapabilityResult, CppRecord, CqaRecord,
  ParticulateRecord, PreservativeRecord, YieldRecord, calculateCapability,
} from '@/lib/cpv';
import { listCpvRecords } from '@/lib/cpv-service';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading, StatusBadge } from '@/components/cpv/cpv-ui';

type CapabilitySource = 'batch' | 'cpp' | 'cqa';
type ReportPeriod = 'monthly' | 'yearly';

interface Observation {
  id: string;
  source: CapabilitySource;
  product: string;
  batch: string;
  date: string;
  parameter: string;
  value: number;
  lsl: number;
  usl: number;
  unit: string;
}

interface ReportRow extends CapabilityResult {
  parameter: string;
  product: string;
  lsl: number;
  usl: number;
}

const chartColors = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
};

const getDate = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export function CapabilityWorkspace() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [source, setSource] = useState<CapabilitySource>('cpp');
  const [parameter, setParameter] = useState('');
  const [product, setProduct] = useState('all');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [yieldRecords, cppRecords, cqaRecords, assays, preservatives, particulates] = await Promise.all([
        listCpvRecords<YieldRecord>(CPV_COLLECTIONS.yield),
        listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
        listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
        listCpvRecords<AssayRecord>(CPV_COLLECTIONS.cqaAssay),
        listCpvRecords<PreservativeRecord>(CPV_COLLECTIONS.cqaPreservative),
        listCpvRecords<ParticulateRecord>(CPV_COLLECTIONS.cqaParticulate),
      ]);

      const batchData: Observation[] = yieldRecords.flatMap((record) => [
        ['Observed Yield', record.observedValue],
        ['Bulk Yield', record.bulkYield],
        ['Filling Yield', record.fillingYield],
        ['Packing Yield', record.packingYield],
      ].map(([name, value]) => ({
        id: `${record.id}-${name}`,
        source: 'batch' as const,
        product: record.productName,
        batch: record.batchNo,
        date: record.manufacturingDate || record.createdAt || '',
        parameter: String(name),
        value: Number(value),
        lsl: record.lowerLimit,
        usl: record.upperLimit,
        unit: '%',
      })));

      const cppData: Observation[] = cppRecords.map((record) => ({
        id: record.id || `${record.batchNo}-${record.parameterName}`,
        source: 'cpp',
        product: record.productName,
        batch: record.batchNo,
        date: record.manufacturingDate || record.createdAt || '',
        parameter: record.parameterName,
        value: record.observedValue,
        lsl: record.lsl,
        usl: record.usl,
        unit: record.unit,
      }));

      const cqaData: Observation[] = [
        ...cqaRecords.map((record) => ({
          id: record.id || `${record.batchNo}-${record.testParameter}`,
          source: 'cqa' as const,
          product: record.productName,
          batch: record.batchNo,
          date: record.createdAt || '',
          parameter: record.testParameter,
          value: record.observedValue,
          lsl: record.lsl,
          usl: record.usl,
          unit: record.unit,
        })),
        ...assays.map((record) => ({
          id: record.id || `${record.batchNo}-assay`,
          source: 'cqa' as const,
          product: record.productName,
          batch: record.batchNo,
          date: record.createdAt || '',
          parameter: 'Assay',
          value: record.observedValue,
          lsl: record.lowerLimit,
          usl: record.upperLimit,
          unit: '%',
        })),
        ...preservatives.map((record) => ({
          id: record.id || `${record.batchNo}-preservative`,
          source: 'cqa' as const,
          product: record.productName,
          batch: record.batchNo,
          date: record.createdAt || '',
          parameter: 'Preservative Assay',
          value: record.observedValue,
          lsl: record.lsl,
          usl: record.usl,
          unit: record.unit,
        })),
        ...particulates.map((record) => ({
          id: record.id || `${record.batchNo}-particulate`,
          source: 'cqa' as const,
          product: record.productName,
          batch: record.batchNo,
          date: record.createdAt || '',
          parameter: 'Particulate Matter',
          value: record.observedValue,
          lsl: 0,
          usl: record.limit,
          unit: 'particles',
        })),
      ];

      setObservations([...batchData, ...cppData, ...cqaData]);
      setLoading(false);
    };
    void load();
  }, []);

  const sourceRecords = observations.filter((item) => item.source === source);
  const parameters = Array.from(new Set(sourceRecords.map((item) => item.parameter)));
  const selectedParameter = parameter && parameters.includes(parameter) ? parameter : parameters[0] || '';
  const products = Array.from(new Set(sourceRecords.map((item) => item.product)));
  const selected = sourceRecords
    .filter((item) => item.parameter === selectedParameter)
    .filter((item) => product === 'all' || item.product === product)
    .sort((a, b) => getDate(a.date).getTime() - getDate(b.date).getTime());
  const lsl = selected[0]?.lsl ?? 0;
  const usl = selected[0]?.usl ?? 0;
  const result = calculateCapability(selected.map((item) => item.value), lsl, usl);

  const runChart = selected.map((item, index) => ({
    sample: index + 1,
    batch: item.batch,
    value: item.value,
    mean: result.mean,
  }));

  const histogram = useMemo(() => {
    if (!selected.length) return [];
    const values = selected.map((item) => item.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const binCount = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const width = (maximum - minimum) / binCount || 1;
    return Array.from({ length: binCount }, (_, index) => {
      const start = minimum + (index * width);
      const end = index === binCount - 1 ? maximum + Number.EPSILON : start + width;
      return {
        range: `${start.toFixed(2)}-${(end - Number.EPSILON).toFixed(2)}`,
        count: values.filter((value) => value >= start && value < end).length,
      };
    });
  }, [selected]);

  const reportRows = useMemo(() => {
    const scoped = observations.filter((item) => {
      if (item.source !== source) return false;
      if (product !== 'all' && item.product !== product) return false;
      const date = getDate(item.date);
      if (date.getFullYear() !== reportYear) return false;
      return reportPeriod === 'yearly' || date.getMonth() + 1 === reportMonth;
    });
    const groups = new Map<string, Observation[]>();
    scoped.forEach((item) => {
      const key = `${item.product}::${item.parameter}`;
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups.entries()).map(([key, records]) => {
      const [groupProduct, groupParameter] = key.split('::');
      return {
        product: groupProduct,
        parameter: groupParameter,
        lsl: records[0].lsl,
        usl: records[0].usl,
        ...calculateCapability(records.map((item) => item.value), records[0].lsl, records[0].usl),
      };
    }) as ReportRow[];
  }, [observations, product, reportMonth, reportPeriod, reportYear, source]);

  const saveAnalysis = async () => {
    if (result.status === 'Insufficient Data') return toast.error('At least two batch observations are required');
    await addDoc(collection(firestore, CPV_COLLECTIONS.capability), {
      recordType: 'analysis',
      source,
      product,
      parameter: selectedParameter,
      lsl,
      usl,
      ...result,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'system',
      createdByName: profile?.full_name || 'System',
    });
    toast.success('Capability analysis saved');
  };

  const saveReport = async () => {
    if (!reportRows.length) return toast.error('No capability data is available for this report period');
    await addDoc(collection(firestore, CPV_COLLECTIONS.capability), {
      recordType: `${reportPeriod}_report`,
      source,
      product,
      reportYear,
      reportMonth: reportPeriod === 'monthly' ? reportMonth : null,
      rows: reportRows,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'system',
      createdByName: profile?.full_name || 'System',
    });
    toast.success(`${reportPeriod === 'monthly' ? 'Monthly' : 'Yearly'} capability report saved`);
  };

  return <div className="space-y-6">
    <PageHeading
      title="Pharmaceutical Process Capability"
      description="Capability evaluation across batch yield, critical process parameters, and critical quality attributes using within-process and overall variation."
      actions={<Button onClick={saveAnalysis} disabled={result.status === 'Insufficient Data'}><Save className="mr-2 h-4 w-4" />Save Analysis</Button>}
    />

    <Tabs defaultValue="analysis" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="analysis">Capability Analysis</TabsTrigger>
        <TabsTrigger value="reports">Monthly / Yearly Reports</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis" className="space-y-5">
        <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Input Data</Label><Select value={source} onValueChange={(value: CapabilitySource) => { setSource(value); setParameter(''); setProduct('all'); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="batch">Batch Data</SelectItem><SelectItem value="cpp">CPP Data</SelectItem><SelectItem value="cqa">CQA Data</SelectItem></SelectContent></Select></div>
          <div><Label>Product</Label><Select value={product} onValueChange={setProduct}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Products</SelectItem>{products.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Parameter</Label><Select value={selectedParameter} onValueChange={setParameter}><SelectTrigger className="mt-2"><SelectValue placeholder="Select parameter" /></SelectTrigger><SelectContent>{parameters.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Capability Status</Label><div className="mt-3"><StatusBadge status={result.status} /></div></div>
        </CardContent></Card>

        <DataState loading={loading} empty={!selected.length} emptyText="Record batch, CPP, or CQA observations to calculate process capability." />
        {!loading && selected.length > 0 && <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Mean" value={result.mean} />
            <KpiCard label="Median" value={result.median} />
            <KpiCard label="Range" value={result.range} />
            <KpiCard label="Variance" value={result.variance} />
            <KpiCard label="Standard Deviation" value={result.standardDeviation} />
            <KpiCard label="Cp" value={result.cp} />
            <KpiCard label="Cpk" value={result.cpk} tone={result.cpk > 1.33 ? 'green' : result.cpk >= 1 ? 'amber' : 'red'} />
            <KpiCard label="Pp" value={result.pp} />
            <KpiCard label="Ppk" value={result.ppk} tone={result.ppk > 1.33 ? 'green' : result.ppk >= 1 ? 'amber' : 'red'} />
            <KpiCard label="Sigma Level" value={result.sigmaLevel} />
            <KpiCard label="Samples" value={result.count} />
            <KpiCard label="Status" value={result.status} tone={result.status === 'Excellent' ? 'green' : result.status === 'Acceptable' ? 'amber' : 'red'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>{selectedParameter} Capability Run Chart</CardTitle></CardHeader><CardContent className="h-[380px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={runChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="batch" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Legend /><ReferenceLine y={lsl} stroke={chartColors.red} strokeDasharray="5 5" label="LSL" /><ReferenceLine y={usl} stroke={chartColors.red} strokeDasharray="5 5" label="USL" /><ReferenceLine y={result.mean} stroke={chartColors.green} label="Mean" /><Line type="monotone" dataKey="value" name="Observed" stroke={chartColors.blue} strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader><CardTitle>Capability Distribution</CardTitle></CardHeader><CardContent className="h-[380px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={histogram}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" angle={-25} textAnchor="end" height={70} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Frequency">{histogram.map((_, index) => <Cell key={index} fill={index % 2 ? chartColors.violet : chartColors.blue} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
          </div>
        </>}
      </TabsContent>

      <TabsContent value="reports" className="space-y-5">
        <Card className="no-print"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div><Label>Report Type</Label><Select value={reportPeriod} onValueChange={(value: ReportPeriod) => setReportPeriod(value)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly Report</SelectItem><SelectItem value="yearly">Yearly Report</SelectItem></SelectContent></Select></div>
          <div><Label>Year</Label><Input className="mt-2" type="number" min="2000" max={new Date().getFullYear()} value={reportYear} onChange={(event) => setReportYear(Number(event.target.value))} /></div>
          <div><Label>Month</Label><Select value={String(reportMonth)} onValueChange={(value) => setReportMonth(Number(value))} disabled={reportPeriod === 'yearly'}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2000, index).toLocaleString('en-US', { month: 'long' })}</SelectItem>)}</SelectContent></Select></div>
          <Button className="self-end" onClick={saveReport}><FileBarChart className="mr-2 h-4 w-4" />Generate Report</Button>
          <Button className="self-end" variant="outline" onClick={printPage}><Download className="mr-2 h-4 w-4" />Export PDF</Button>
        </CardContent></Card>

        <section className="space-y-5 bg-white print:p-4 dark:bg-transparent">
          <div className="border-b pb-4"><p className="text-sm font-semibold text-blue-700">SKYMAP PHARMACEUTICALS</p><h2 className="mt-1 text-2xl font-bold">{reportPeriod === 'monthly' ? 'Monthly' : 'Yearly'} Process Capability Report</h2><p className="mt-1 text-sm text-muted-foreground">{reportPeriod === 'monthly' ? `${new Date(2000, reportMonth - 1).toLocaleString('en-US', { month: 'long' })} ` : ''}{reportYear} | {source.toUpperCase()} Data | {product === 'all' ? 'All Products' : product}</p></div>
          <DataState loading={loading} empty={!reportRows.length} emptyText="No repeated observations are available for the selected reporting period." />
          {!loading && reportRows.length > 0 && <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Parameter</TableHead><TableHead>Samples</TableHead><TableHead>Mean</TableHead><TableHead>Std Dev</TableHead><TableHead>Cp</TableHead><TableHead>Cpk</TableHead><TableHead>Pp</TableHead><TableHead>Ppk</TableHead><TableHead>Sigma</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{reportRows.map((row) => <TableRow key={`${row.product}-${row.parameter}`}><TableCell>{row.product}</TableCell><TableCell>{row.parameter}</TableCell><TableCell>{row.count}</TableCell><TableCell>{row.mean}</TableCell><TableCell>{row.standardDeviation}</TableCell><TableCell>{row.cp}</TableCell><TableCell>{row.cpk}</TableCell><TableCell>{row.pp}</TableCell><TableCell>{row.ppk}</TableCell><TableCell>{row.sigmaLevel}</TableCell><TableCell><StatusBadge status={row.status} /></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
        </section>
      </TabsContent>
    </Tabs>
  </div>;
}
