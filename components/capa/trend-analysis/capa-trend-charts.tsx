'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { CapaTrendAnalysisResult } from '@/lib/capa-trend-records';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

function hasCount(items?: { count?: number; open?: number; closed?: number; avgDays?: number; effective?: number; notEffective?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) =>
    (d.count ?? 0) > 0 || (d.open ?? 0) > 0 || (d.closed ?? 0) > 0
    || (d.avgDays ?? 0) > 0 || (d.effective ?? 0) > 0 || (d.notEffective ?? 0) > 0,
  );
}

export function CapaTrendCharts({ analysis }: { analysis: CapaTrendAnalysisResult | null }) {
  if (!analysis || analysis.filtered_count === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Generate a trend analysis to view charts. Empty filters will not crash the dashboard.
      </div>
    );
  }

  const m = analysis.metrics;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Monthly CAPA Trend" hasData={hasCount(m.monthlyTrend)}>
        <LineChart data={m.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>

      <ChartCard title="CAPA Source Trend" hasData={hasCount(m.bySource)}>
        <PieChart>
          <Pie data={m.bySource.slice(0, 8)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {m.bySource.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Department-wise CAPA Trend" hasData={hasCount(m.byDepartment)}>
        <BarChart data={m.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Root Cause Trend" hasData={hasCount(m.byRootCause)}>
        <BarChart data={m.byRootCause.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Priority Distribution" hasData={hasCount(m.byPriority)}>
        <BarChart data={m.byPriority}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Open vs Closed Trend" hasData={hasCount(m.openClosedTrend)}>
        <LineChart data={m.openClosedTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="open" stroke="#f59e0b" strokeWidth={2} name="Open" />
          <Line type="monotone" dataKey="closed" stroke="#16a34a" strokeWidth={2} name="Closed" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Overdue Trend" hasData={hasCount(m.overdueTrend)}>
        <BarChart data={m.overdueTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Effectiveness Trend" hasData={hasCount(m.effectivenessTrend)}>
        <LineChart data={m.effectivenessTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="effective" stroke="#16a34a" strokeWidth={2} name="Effective" />
          <Line type="monotone" dataKey="notEffective" stroke="#dc2626" strokeWidth={2} name="Not Effective" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Average Closure Time Trend" hasData={hasCount(m.closureTimeTrend)}>
        <LineChart data={m.closureTimeTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="avgDays" stroke="#0891b2" strokeWidth={2} name="Avg Days" />
        </LineChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title, hasData, children,
}: { title: string; hasData: boolean; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        ) : <EmptyChart />}
      </CardContent>
    </Card>
  );
}
