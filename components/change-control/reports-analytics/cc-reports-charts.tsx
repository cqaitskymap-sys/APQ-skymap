'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { CcReportAnalyticsMetrics, CcReportChartData } from '@/lib/change-control-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function hasCount(items?: { count?: number; avgDays?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) => (d.count ?? 0) > 0 || (d.avgDays ?? 0) > 0);
}

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

interface CcReportsChartsProps {
  charts: CcReportChartData;
  compact?: boolean;
}

export function CcReportsCharts({ charts, compact = false }: CcReportsChartsProps) {
  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
      <ChartCard title="Monthly Change Trend" hasData={hasCount(charts.monthlyTrend)}>
        <LineChart data={charts.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Department-wise Changes" hasData={hasCount(charts.byDepartment)}>
        <BarChart data={charts.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Change Type Distribution" hasData={hasCount(charts.byType)}>
        <PieChart>
          <Pie data={charts.byType.slice(0, 8)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
            {charts.byType.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Priority Distribution" hasData={hasCount(charts.byPriority)}>
        <BarChart data={charts.byPriority}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Status Distribution" hasData={hasCount(charts.byStatus)}>
        <BarChart data={charts.byStatus.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Validation Impact Trend" hasData={hasCount(charts.validationImpactTrend)}>
        <LineChart data={charts.validationImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="CSV Impact Trend" hasData={hasCount(charts.csvImpactTrend)}>
        <LineChart data={charts.csvImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#0891b2" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Training Impact Trend" hasData={hasCount(charts.trainingImpactTrend)}>
        <LineChart data={charts.trainingImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Regulatory Impact Trend" hasData={hasCount(charts.regulatoryImpactTrend)}>
        <LineChart data={charts.regulatoryImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Implementation Performance Trend" hasData={hasCount(charts.implementationPerformanceTrend)}>
        <BarChart data={charts.implementationPerformanceTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ca8a04" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Effectiveness Trend" hasData={hasCount(charts.effectivenessTrend)}>
        <LineChart data={charts.effectivenessTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} />
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
    </div>
  );
}

export function CcReportsAnalyticsKpis({ metrics }: { metrics: CcReportAnalyticsMetrics }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <MiniKpi label="Total Changes" value={metrics.total} />
      <MiniKpi label="Open Changes" value={metrics.open} tone="amber" />
      <MiniKpi label="Closed Changes" value={metrics.closed} tone="green" />
      <MiniKpi label="Overdue Changes" value={metrics.overdue} tone="red" />
      <MiniKpi label="Critical Changes" value={metrics.critical} tone="red" />
      <MiniKpi label="Validation Impact" value={metrics.validationImpact} tone="purple" />
      <MiniKpi label="CSV Impact" value={metrics.csvImpact} />
      <MiniKpi label="Training Impact" value={metrics.trainingImpactChanges} tone="amber" />
      <MiniKpi label="Regulatory Impact" value={metrics.regulatoryImpact} />
      <MiniKpi label="Implementation Pending" value={metrics.implementationPending} tone="amber" />
      <MiniKpi label="Effectiveness Pending" value={metrics.effectivenessPending} tone="amber" />
      <MiniKpi label="Avg Closure Days" value={metrics.avgClosureDays} />
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string | number; tone?: 'amber' | 'green' | 'red' | 'purple' }) {
  const border = tone === 'amber' ? 'border-l-amber-500' : tone === 'green' ? 'border-l-green-600' : tone === 'red' ? 'border-l-red-600' : tone === 'purple' ? 'border-l-violet-600' : 'border-l-blue-600';
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
