'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Printer, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import {
  CPV_COLLECTIONS, CppRecord, CqaRecord, YieldRecord,
} from '@/lib/cpv';
import {
  TREND_METRICS, TrendChartPoint, TrendMetric, buildTrendChartData,
  mergeTrendObservations, trendFilterOptions, trendSummary,
} from '@/lib/cpv-trend-analysis';
import { listCpvRecords } from '@/lib/cpv-service';
import { printPage } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState, KpiCard, PageHeading } from '@/components/cpv/cpv-ui';

const colors = {
  observed: '#2563eb',
  upper: '#dc2626',
  lower: '#dc2626',
  mean: '#059669',
  trend: '#7c3aed',
  moving: '#d97706',
};

function TrendChart({ metric, data }: { metric: TrendMetric; data: TrendChartPoint[] }) {
  const unit = data[0]?.unit || '';
  const latest = data[data.length - 1];

  return (
    <Card className="break-inside-avoid shadow-sm">
      <CardHeader className="border-b bg-slate-50/70 py-4 dark:bg-slate-900/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{metric} Trend</CardTitle>
            <CardDescription className="mt-0.5">
              {data.length} batch{data.length !== 1 ? 'es' : ''}
              {unit ? ` · ${unit}` : ''}
              {latest ? ` · Mean ${latest.mean}` : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[380px] pt-5">
        {!data.length ? (
          <DataState loading={false} empty emptyText={`No ${metric} records match the selected filters.`} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 25, left: 5, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.65} />
              <XAxis dataKey="label" angle={-30} textAnchor="end" height={55} tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value}${unit && name === 'Observed Value' ? ` ${unit}` : ''}`,
                  name,
                ]}
              />
              <Legend verticalAlign="top" height={36} />
              {latest && (
                <>
                  <ReferenceLine y={latest.lowerLimit} stroke={colors.lower} strokeDasharray="6 4" label="LSL" />
                  <ReferenceLine y={latest.upperLimit} stroke={colors.upper} strokeDasharray="6 4" label="USL" />
                </>
              )}
              <Line type="monotone" dataKey="observed" name="Observed Value" stroke={colors.observed} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              <Line type="stepAfter" dataKey="upperLimit" name="Upper Limit" stroke={colors.upper} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
              <Line type="stepAfter" dataKey="lowerLimit" name="Lower Limit" stroke={colors.lower} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
              <Line type="monotone" dataKey="mean" name="Mean" stroke={colors.mean} strokeWidth={1.5} dot={false} connectNulls />
              <Line type="linear" dataKey="trendLine" name="Trend Line" stroke={colors.trend} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="movingAverage" name="Moving Average" stroke={colors.moving} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function FilterBar({
  product, batch, year, month, quarter,
  products, batches, years,
  onProduct, onBatch, onYear, onMonth, onQuarter, onReset,
}: {
  product: string;
  batch: string;
  year: string;
  month: string;
  quarter: string;
  products: string[];
  batches: string[];
  years: number[];
  onProduct: (v: string) => void;
  onBatch: (v: string) => void;
  onYear: (v: string) => void;
  onMonth: (v: string) => void;
  onQuarter: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <Card className="no-print">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <Label>Product</Label>
          <Select value={product} onValueChange={(v) => { onProduct(v); onBatch('all'); }}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Batch</Label>
          <Select value={batch} onValueChange={onBatch}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batches.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Year</Label>
          <Select value={year} onValueChange={onYear}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Month</Label>
          <Select value={month} onValueChange={onMonth}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {Array.from({ length: 12 }, (_, i) => {
                const val = String(i + 1).padStart(2, '0');
                return (
                  <SelectItem key={val} value={val}>
                    {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Quarter</Label>
          <Select value={quarter} onValueChange={onQuarter}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              {[1, 2, 3, 4].map((item) => <SelectItem key={item} value={String(item)}>Q{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="self-end" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />Reset
        </Button>
      </CardContent>
    </Card>
  );
}

export function TrendWorkspace() {
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<ReturnType<typeof mergeTrendObservations>>([]);
  const [product, setProduct] = useState('all');
  const [batch, setBatch] = useState('all');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [quarter, setQuarter] = useState('all');
  const [activeMetric, setActiveMetric] = useState<TrendMetric>('Assay');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [yields, cpp, cqa] = await Promise.all([
        listCpvRecords<YieldRecord>(CPV_COLLECTIONS.yield),
        listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
        listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
      ]);
      setObservations(mergeTrendObservations(yields, cpp, cqa));
      setLoading(false);
    };
    void load();
  }, []);

  const filters = useMemo(
    () => ({ product, batch, year, month, quarter }),
    [product, batch, year, month, quarter],
  );

  const { products, batches, years } = useMemo(
    () => trendFilterOptions(observations, product),
    [observations, product],
  );

  const chartData = useMemo(
    () => buildTrendChartData(observations, filters),
    [observations, filters],
  );

  const summary = useMemo(
    () => trendSummary(observations, filters, chartData),
    [observations, filters, chartData],
  );

  useEffect(() => {
    if (chartData[activeMetric]?.length) return;
    const first = TREND_METRICS.find((m) => chartData[m].length > 0);
    if (first) setActiveMetric(first);
  }, [chartData, activeMetric]);

  const resetFilters = () => {
    setProduct('all');
    setBatch('all');
    setYear('all');
    setMonth('all');
    setQuarter('all');
  };

  const filterProps = {
    product, batch, year, month, quarter,
    products, batches, years,
    onProduct: setProduct,
    onBatch: setBatch,
    onYear: setYear,
    onMonth: setMonth,
    onQuarter: setQuarter,
    onReset: resetFilters,
  };

  const periodLabel = [
    year !== 'all' ? year : null,
    month !== 'all' ? new Date(2000, parseInt(month, 10) - 1).toLocaleString('en-US', { month: 'long' }) : null,
    quarter !== 'all' ? `Q${quarter}` : null,
  ].filter(Boolean).join(' · ') || 'All Periods';

  return (
    <div className="space-y-6">
      <PageHeading
        title="Trend Analysis"
        description="Longitudinal CPV trend graphs for Assay, pH, Extractable Volume, Yield, Fill Volume, Particulate Matter, Methyl/Propyl Paraben, and Sterility — with specification limits, mean, linear trend, and moving average."
        actions={(
          <Button variant="outline" onClick={() => printPage()}>
            <Printer className="mr-2 h-4 w-4" />Export PDF
          </Button>
        )}
      />

      <Card className="no-print border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
          <p className="text-sm text-muted-foreground">Environmental & utility monitoring trends (Temperature, RH, DP, microbial, water systems) are available in QMS Monitoring.</p>
          <Link href="/qms/monitoring/trends"><Button variant="outline" size="sm">View Monitoring Trends →</Button></Link>
        </CardContent>
      </Card>

      <FilterBar {...filterProps} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 no-print">
        <KpiCard label="Records in Scope" value={summary.totalRecords} />
        <KpiCard label="Active Parameters" value={summary.activeMetrics} />
        <KpiCard label="Products" value={summary.products} />
        <KpiCard label="Batches" value={summary.batches} />
        <KpiCard label="Sterility Failures" value={summary.failedSterility} tone={summary.failedSterility ? 'red' : 'green'} />
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="no-print grid h-auto w-full grid-cols-2 gap-1 p-1 lg:grid-cols-2">
          <TabsTrigger value="overview">All Trend Graphs</TabsTrigger>
          <TabsTrigger value="single">Single Parameter</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <section id="trend-report" className="space-y-5 bg-white print:p-4 dark:bg-transparent">
            <div className="hidden border-b-2 border-blue-800 pb-4 print:block">
              <p className="text-sm font-bold text-blue-800">SKYMAP PHARMACEUTICALS</p>
              <h1 className="mt-1 text-2xl font-bold">CPV Trend Analysis Report</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated: {new Date().toLocaleDateString()} · Product: {product === 'all' ? 'All' : product} · Batch: {batch === 'all' ? 'All' : batch} · {periodLabel}
              </p>
            </div>

            <DataState
              loading={loading}
              empty={!summary.totalRecords}
              emptyText="No CPP, CQA, or yield records match these filters. Record data in CPP/CQA monitoring first."
            />

            {!loading && summary.totalRecords > 0 && (
              <div className="grid gap-6 xl:grid-cols-2">
                {TREND_METRICS.map((metric) => (
                  <TrendChart key={metric} metric={metric} data={chartData[metric]} />
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="single" className="space-y-5">
          <Card className="no-print">
            <CardContent className="p-5">
              <Label>Select Parameter</Label>
              <Select value={activeMetric} onValueChange={(v) => setActiveMetric(v as TrendMetric)}>
                <SelectTrigger className="mt-2 max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TREND_METRICS.map((metric) => (
                    <SelectItem key={metric} value={metric} disabled={!chartData[metric].length}>
                      {metric}{chartData[metric].length ? ` (${chartData[metric].length})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <TrendChart metric={activeMetric} data={chartData[activeMetric]} />
        </TabsContent>
      </Tabs>

      <Card className="no-print">
        <CardHeader><CardTitle>Chart Legend</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p><strong className="text-blue-700">Observed Value:</strong> recorded result per batch.</p>
          <p><strong className="text-red-700">Lower / Upper Limit:</strong> LSL and USL from specification; 3σ limits if not stored.</p>
          <p><strong className="text-emerald-700">Mean:</strong> arithmetic mean of filtered observations.</p>
          <p><strong className="text-violet-700">Trend Line:</strong> least-squares linear regression.</p>
          <p><strong className="text-amber-700">Moving Average:</strong> rolling 3-point average.</p>
          <p><strong>Sterility:</strong> Pass = 1, Fail = 0 for trend visualization.</p>
        </CardContent>
      </Card>
    </div>
  );
}
