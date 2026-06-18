'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { CapaReportAnalyticsMetrics, CapaReportChartData } from '@/lib/capa-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function hasCount(items?: { count?: number; effective?: number; notEffective?: number; avgDays?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) =>
    (d.count ?? 0) > 0 || (d.effective ?? 0) > 0 || (d.notEffective ?? 0) > 0 || (d.avgDays ?? 0) > 0,
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

interface CapaReportsChartsProps {
  charts: CapaReportChartData;
  compact?: boolean;
}

export function CapaReportsCharts({ charts, compact = false }: CapaReportsChartsProps) {
  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
      <ChartCard title="Monthly CAPA Trend" hasData={hasCount(charts.monthlyTrend)}>
        <LineChart data={charts.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="CAPA by Source" hasData={hasCount(charts.bySource)}>
        <PieChart>
          <Pie data={charts.bySource.slice(0, 8)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
            {charts.bySource.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="CAPA by Department" hasData={hasCount(charts.byDepartment)}>
        <BarChart data={charts.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="CAPA by Priority" hasData={hasCount(charts.byPriority)}>
        <BarChart data={charts.byPriority}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="CAPA by Status" hasData={hasCount(charts.byStatus)}>
        <BarChart data={charts.byStatus.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Effectiveness Trend" hasData={hasCount(charts.effectivenessTrend)}>
        <LineChart data={charts.effectivenessTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="effective" stroke="#16a34a" strokeWidth={2} name="Effective" />
          <Line type="monotone" dataKey="notEffective" stroke="#dc2626" strokeWidth={2} name="Not Effective" />
        </LineChart>
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

      <ChartCard title="Overdue CAPA Trend" hasData={hasCount(charts.overdueTrend)}>
        <BarChart data={charts.overdueTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Root Cause Trend" hasData={hasCount(charts.rootCauseTrend)}>
        <BarChart data={charts.rootCauseTrend.slice(0, 6)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ca8a04" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Risk Distribution Trend" hasData={hasCount(charts.riskDistribution)}>
        <PieChart>
          <Pie data={charts.riskDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85}>
            {charts.riskDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartCard>
    </div>
  );
}

export function CapaReportsAnalyticsKpis({ metrics }: { metrics: CapaReportAnalyticsMetrics }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      <MiniKpi label="Total CAPA" value={metrics.total} />
      <MiniKpi label="Open CAPA" value={metrics.open} tone="amber" />
      <MiniKpi label="Closed CAPA" value={metrics.closed} tone="green" />
      <MiniKpi label="Overdue CAPA" value={metrics.overdue} tone="red" />
      <MiniKpi label="Effective CAPA" value={metrics.effective} tone="green" />
      <MiniKpi label="Not Effective" value={metrics.notEffective} tone="red" />
      <MiniKpi label="Avg Closure Days" value={metrics.avgClosureDays} />
      <MiniKpi label="Success Rate" value={`${metrics.capaSuccessRate}%`} />
      <MiniKpi label="Repeat CAPA" value={metrics.repeatCapa} tone="amber" />
      <MiniKpi label="High Risk CAPA" value={metrics.highRiskCapa} tone="red" />
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
