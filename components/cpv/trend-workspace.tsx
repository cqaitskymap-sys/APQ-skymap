'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import {
  AssayRecord, CPV_COLLECTIONS, ParticulateRecord, PhysicalRecord,
  PreservativeRecord, SterilityRecord, YieldRecord,
} from '@/lib/cpv';
import { listCpvRecords } from '@/lib/cpv-service';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataState, KpiCard, PageHeading } from '@/components/cpv/cpv-ui';

type Metric =
  | 'Assay'
  | 'pH'
  | 'Extractable Volume'
  | 'Yield'
  | 'Particulate Matter'
  | 'Methyl Paraben'
  | 'Propyl Paraben'
  | 'Sterility';

interface TrendObservation {
  id: string;
  metric: Metric;
  product: string;
  batch: string;
  date: string;
  observed: number;
  lower?: number;
  upper?: number;
  unit: string;
}

interface ChartPoint extends TrendObservation {
  label: string;
  mean: number;
  trendLine: number;
  movingAverage: number;
  lowerLimit: number;
  upperLimit: number;
}

const metrics: Metric[] = [
  'Assay',
  'pH',
  'Extractable Volume',
  'Yield',
  'Particulate Matter',
  'Methyl Paraben',
  'Propyl Paraben',
  'Sterility',
];

const colors = {
  observed: '#2563eb',
  upper: '#dc2626',
  lower: '#dc2626',
  mean: '#059669',
  trend: '#7c3aed',
  moving: '#d97706',
};

const safeDate = (value: string) => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const round = (value: number) => Number(value.toFixed(3));

function enrichTrend(records: TrendObservation[]): ChartPoint[] {
  if (!records.length) return [];
  const sorted = records.slice().sort((a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime());
  const values = sorted.map((item) => item.observed);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1)
    : 0;
  const sigma = Math.sqrt(variance);
  const calculatedLower = mean - (3 * sigma);
  const calculatedUpper = mean + (3 * sigma);
  const n = values.length;
  const sumX = values.reduce((sum, _, index) => sum + index, 0);
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = values.reduce((sum, value, index) => sum + (index * value), 0);
  const sumXX = values.reduce((sum, _, index) => sum + (index * index), 0);
  const denominator = (n * sumXX) - (sumX ** 2);
  const slope = denominator ? ((n * sumXY) - (sumX * sumY)) / denominator : 0;
  const intercept = (sumY - (slope * sumX)) / n;

  return sorted.map((item, index) => {
    const window = values.slice(Math.max(0, index - 2), index + 1);
    const movingAverage = window.reduce((sum, value) => sum + value, 0) / window.length;
    return {
      ...item,
      label: item.batch,
      mean: round(mean),
      trendLine: round(intercept + (slope * index)),
      movingAverage: round(movingAverage),
      lowerLimit: round(item.lower ?? calculatedLower),
      upperLimit: round(item.upper ?? calculatedUpper),
    };
  });
}

function PqrTrendChart({ metric, data }: { metric: Metric; data: ChartPoint[] }) {
  const unit = data[0]?.unit || '';
  return <Card className="break-inside-avoid shadow-sm">
    <CardHeader className="border-b bg-slate-50/70 py-4 dark:bg-slate-900/30">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">{metric} Trend</CardTitle>
        <span className="text-xs text-muted-foreground">{data.length} records {unit ? `| ${unit}` : ''}</span>
      </div>
    </CardHeader>
    <CardContent className="h-[370px] pt-5">
      {!data.length ? <DataState loading={false} empty emptyText={`No ${metric} records match the selected filters.`} /> :
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 25, left: 5, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.65} />
            <XAxis dataKey="label" angle={-30} textAnchor="end" height={55} tick={{ fontSize: 11 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number, name: string) => [`${value}${unit ? ` ${unit}` : ''}`, name]} />
            <Legend verticalAlign="top" height={34} />
            <Line type="monotone" dataKey="observed" name="Observed Value" stroke={colors.observed} strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="stepAfter" dataKey="upperLimit" name="Upper Limit" stroke={colors.upper} strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
            <Line type="stepAfter" dataKey="lowerLimit" name="Lower Limit" stroke={colors.lower} strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="mean" name="Mean" stroke={colors.mean} strokeWidth={1.5} dot={false} />
            <Line type="linear" dataKey="trendLine" name="Trend Line" stroke={colors.trend} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="movingAverage" name="Moving Average" stroke={colors.moving} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>}
    </CardContent>
  </Card>;
}

export function TrendWorkspace() {
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<TrendObservation[]>([]);
  const [product, setProduct] = useState('all');
  const [batch, setBatch] = useState('all');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [quarter, setQuarter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [assays, physical, yields, particulate, preservatives, sterility] = await Promise.all([
        listCpvRecords<AssayRecord>(CPV_COLLECTIONS.cqaAssay),
        listCpvRecords<PhysicalRecord>(CPV_COLLECTIONS.cqaPhysical),
        listCpvRecords<YieldRecord>(CPV_COLLECTIONS.yield),
        listCpvRecords<ParticulateRecord>(CPV_COLLECTIONS.cqaParticulate),
        listCpvRecords<PreservativeRecord>(CPV_COLLECTIONS.cqaPreservative),
        listCpvRecords<SterilityRecord>(CPV_COLLECTIONS.cqaSterility),
      ]);

      const normalized: TrendObservation[] = [
        ...assays.map((item) => ({
          id: item.id || `${item.batchNo}-assay`,
          metric: 'Assay' as const,
          product: item.productName,
          batch: item.batchNo,
          date: item.createdAt || '',
          observed: item.observedValue,
          lower: item.lowerLimit,
          upper: item.upperLimit,
          unit: '%',
        })),
        ...physical.flatMap((item) => [
          {
            id: `${item.id}-ph`,
            metric: 'pH' as const,
            product: item.productName,
            batch: item.batchNo,
            date: item.testDate || item.createdAt || '',
            observed: item.ph,
            unit: 'pH',
          },
          {
            id: `${item.id}-volume`,
            metric: 'Extractable Volume' as const,
            product: item.productName,
            batch: item.batchNo,
            date: item.testDate || item.createdAt || '',
            observed: item.extractableVolume,
            unit: 'mL',
          },
        ]),
        ...yields.map((item) => ({
          id: item.id || `${item.batchNo}-yield`,
          metric: 'Yield' as const,
          product: item.productName,
          batch: item.batchNo,
          date: item.manufacturingDate || item.createdAt || '',
          observed: item.observedValue,
          lower: item.lowerLimit,
          upper: item.upperLimit,
          unit: '%',
        })),
        ...particulate.map((item) => ({
          id: item.id || `${item.batchNo}-particulate`,
          metric: 'Particulate Matter' as const,
          product: item.productName,
          batch: item.batchNo,
          date: item.createdAt || '',
          observed: item.observedValue,
          lower: 0,
          upper: item.limit,
          unit: 'particles',
        })),
        ...preservatives.flatMap((item) => [
          {
            id: `${item.id}-methyl`,
            metric: 'Methyl Paraben' as const,
            product: item.productName,
            batch: item.batchNo,
            date: item.createdAt || '',
            observed: item.methylParaben,
            lower: item.lsl,
            upper: item.usl,
            unit: item.unit,
          },
          {
            id: `${item.id}-propyl`,
            metric: 'Propyl Paraben' as const,
            product: item.productName,
            batch: item.batchNo,
            date: item.createdAt || '',
            observed: item.propylParaben,
            lower: item.lsl,
            upper: item.usl,
            unit: item.unit,
          },
        ]),
        ...sterility.map((item) => ({
          id: item.id || `${item.batchNo}-sterility`,
          metric: 'Sterility' as const,
          product: item.productName,
          batch: item.batchNo,
          date: item.testDate || item.createdAt || '',
          observed: item.status === 'Pass' ? 1 : 0,
          lower: 1,
          upper: 1,
          unit: 'Pass=1',
        })),
      ];
      setObservations(normalized);
      setLoading(false);
    };
    void load();
  }, []);

  const products = Array.from(new Set(observations.map((item) => item.product))).sort();
  const productRecords = observations.filter((item) => product === 'all' || item.product === product);
  const batches = Array.from(new Set(productRecords.map((item) => item.batch))).sort();
  const years = Array.from(new Set(productRecords.map((item) => safeDate(item.date).getFullYear()))).sort((a, b) => b - a);

  const filtered = observations.filter((item) => {
    const date = safeDate(item.date);
    if (product !== 'all' && item.product !== product) return false;
    if (batch !== 'all' && item.batch !== batch) return false;
    if (year !== 'all' && date.getFullYear() !== Number(year)) return false;
    if (month !== 'all' && date.getMonth() + 1 !== Number(month)) return false;
    if (quarter !== 'all' && Math.floor(date.getMonth() / 3) + 1 !== Number(quarter)) return false;
    return true;
  });

  const chartData = useMemo(() => Object.fromEntries(
    metrics.map((metric) => [metric, enrichTrend(filtered.filter((item) => item.metric === metric))]),
  ) as Record<Metric, ChartPoint[]>, [filtered]);

  const activeMetrics = metrics.filter((metric) => chartData[metric].length > 0);
  const totalRecords = filtered.length;
  const failedSterility = filtered.filter((item) => item.metric === 'Sterility' && item.observed === 0).length;

  const resetFilters = () => {
    setProduct('all');
    setBatch('all');
    setYear('all');
    setMonth('all');
    setQuarter('all');
  };

  return <div className="space-y-6">
    <div className="no-print">
      <PageHeading
        title="Trend Analysis"
        description="PQR-style longitudinal review of key quality and process indicators with specification limits, mean, linear trend, and three-point moving average."
        actions={<Button variant="outline" onClick={printPage}><Download className="mr-2 h-4 w-4" />Export PDF</Button>}
      />
    </div>

    <Card className="no-print">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div><Label>Product</Label><Select value={product} onValueChange={(value) => { setProduct(value); setBatch('all'); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Products</SelectItem>{products.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Batch</Label><Select value={batch} onValueChange={setBatch}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Batches</SelectItem>{batches.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Year</Label><Select value={year} onValueChange={setYear}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{years.map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Month</Label><Select value={month} onValueChange={setMonth}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Months</SelectItem>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2000, index).toLocaleString('en-US', { month: 'long' })}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Quarter</Label><Select value={quarter} onValueChange={setQuarter}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Quarters</SelectItem>{[1, 2, 3, 4].map((item) => <SelectItem key={item} value={String(item)}>Q{item}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="outline" className="self-end" onClick={resetFilters}>Reset Filters</Button>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Records in Scope" value={totalRecords} />
      <KpiCard label="Parameters Available" value={activeMetrics.length} />
      <KpiCard label="Products" value={new Set(filtered.map((item) => item.product)).size} />
      <KpiCard label="Sterility Failures" value={failedSterility} tone={failedSterility ? 'red' : 'green'} />
    </div>

    <section className="space-y-5 bg-white print:p-4 dark:bg-transparent">
      <div className="hidden border-b-2 border-blue-800 pb-4 print:block">
        <p className="text-sm font-bold text-blue-800">SKYMAP PHARMACEUTICALS</p>
        <h1 className="mt-1 text-2xl font-bold">Continued Process Verification Trend Report</h1>
        <p className="mt-1 text-sm">Generated: {new Date().toLocaleDateString()} | Product: {product === 'all' ? 'All Products' : product} | Batch: {batch === 'all' ? 'All Batches' : batch}</p>
      </div>
      <DataState loading={loading} empty={!filtered.length} emptyText="No assay, physical, yield, particulate, preservative, or sterility records match these filters." />
      {!loading && filtered.length > 0 && <div className="grid gap-6 xl:grid-cols-2">
        {metrics.map((metric) => <PqrTrendChart key={metric} metric={metric} data={chartData[metric]} />)}
      </div>}
    </section>

    <Card>
      <CardHeader><CardTitle>Chart Interpretation</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <p><strong className="text-blue-700">Observed Value:</strong> recorded result for each batch.</p>
        <p><strong className="text-red-700">Upper / Lower Limit:</strong> stored specification limits where available; otherwise three-sigma analytical limits.</p>
        <p><strong className="text-emerald-700">Mean:</strong> arithmetic mean of filtered observations.</p>
        <p><strong className="text-violet-700">Trend Line:</strong> least-squares linear regression across batches.</p>
        <p><strong className="text-amber-700">Moving Average:</strong> rolling average of the current and previous two observations.</p>
        <p><strong>Sterility:</strong> Pass = 1 and Fail = 0 for visual trending.</p>
      </CardContent>
    </Card>
  </div>;
}
