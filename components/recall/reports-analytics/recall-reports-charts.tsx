'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RecallReportAnalyticsMetrics, RecallReportChartData } from '@/lib/recall-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function hasCount(items?: { count?: number; avgPercent?: number; avgDays?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) => (d.count ?? 0) > 0 || (d.avgPercent ?? 0) > 0 || (d.avgDays ?? 0) > 0);
}

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

export function RecallReportsCharts({ charts, compact = false }: { charts: RecallReportChartData; compact?: boolean }) {
  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
      <ChartCard title="Monthly Recall Trend" hasData={hasCount(charts.monthlyTrend)}>
        <LineChart data={charts.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Recall by Product" hasData={hasCount(charts.byProduct)}>
        <BarChart data={charts.byProduct.slice(0, 8)} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Recall by Market" hasData={hasCount(charts.byMarket)}>
        <BarChart data={charts.byMarket.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Recall by Classification" hasData={hasCount(charts.byClassification)}>
        <PieChart>
          <Pie data={charts.byClassification} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
            {charts.byClassification.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartCard>

      <ChartCard title="Recall by Type" hasData={hasCount(charts.byType)}>
        <BarChart data={charts.byType}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Recovery Trend" hasData={hasCount(charts.recoveryTrend)}>
        <LineChart data={charts.recoveryTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="avgPercent" stroke="#16a34a" strokeWidth={2} name="Avg Recovery %" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Regulatory Notification Trend" hasData={hasCount(charts.regulatoryTrend)}>
        <LineChart data={charts.regulatoryTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="CAPA Linkage Trend" hasData={hasCount(charts.capaLinkageTrend)}>
        <BarChart data={charts.capaLinkageTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Closure Performance Trend" hasData={hasCount(charts.closurePerformanceTrend)}>
        <LineChart data={charts.closurePerformanceTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="avgDays" stroke="#0891b2" strokeWidth={2} name="Avg Days" />
        </LineChart>
      </ChartCard>
    </div>
  );
}

export function RecallReportsAnalyticsKpis({ metrics }: { metrics: RecallReportAnalyticsMetrics }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      <MiniKpi label="Total Recalls" value={metrics.total} />
      <MiniKpi label="Open Recalls" value={metrics.open} tone="amber" />
      <MiniKpi label="Closed Recalls" value={metrics.closed} tone="green" />
      <MiniKpi label="Mock Recalls" value={metrics.mockRecalls} />
      <MiniKpi label="Class I Recalls" value={metrics.classI} tone="red" />
      <MiniKpi label="Regulatory Pending" value={metrics.regulatoryPending} tone="red" />
      <MiniKpi label="Avg Recovery %" value={`${metrics.avgRecoveryPercent}%`} tone="green" />
      <MiniKpi label="CAPA Linked" value={metrics.capaLinked} />
      <MiniKpi label="Avg Closure Days" value={metrics.avgClosureDays} />
      <MiniKpi label="Overdue Recalls" value={metrics.overdue} tone="red" />
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string | number; tone?: 'amber' | 'green' | 'red' }) {
  const border = tone === 'amber' ? 'border-l-amber-500' : tone === 'green' ? 'border-l-green-600' : tone === 'red' ? 'border-l-red-600' : 'border-l-blue-600';
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        ) : <EmptyChart />}
      </CardContent>
    </Card>
  );
}
