'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { CcDashboardChartData } from '@/lib/cc-dashboard-records';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function ChartCard({
  title,
  hasData,
  children,
  className,
}: {
  title: string;
  hasData: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className || ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data for selected filters
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CcDashboardCharts({ charts }: { charts: CcDashboardChartData }) {
  const monthlyHasData = charts.monthlyTrend.some((d) => d.count > 0);
  const deptHasData = charts.byDepartment.some((d) => d.count > 0);
  const typeHasData = charts.byType.some((d) => d.count > 0);
  const categoryHasData = charts.byCategory.some((d) => d.count > 0);
  const priorityHasData = charts.byPriority.some((d) => d.count > 0);
  const openClosedHasData = charts.openVsClosedTrend.some((d) => d.open > 0 || d.closed > 0);

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Monthly Change Control Trend" hasData={monthlyHasData}>
        <LineChart data={charts.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Change by Department" hasData={deptHasData}>
        <BarChart data={charts.byDepartment.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Change by Type" hasData={typeHasData}>
        <PieChart>
          <Pie data={charts.byType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${String(name).slice(0, 10)} ${(percent * 100).toFixed(0)}%`}>
            {charts.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Change by Category" hasData={categoryHasData}>
        <BarChart data={charts.byCategory}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Change by Priority" hasData={priorityHasData}>
        <BarChart data={charts.byPriority}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0ea5e9" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Open vs Closed Trend" hasData={openClosedHasData}>
        <BarChart data={charts.openVsClosedTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="open" fill="#f59e0b" name="Open" />
          <Bar dataKey="closed" fill="#16a34a" name="Closed" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Validation Impact Trend" hasData={charts.validationImpactTrend.some((d) => d.count > 0)}>
        <LineChart data={charts.validationImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Training Impact Trend" hasData={charts.trainingImpactTrend.some((d) => d.count > 0)}>
        <LineChart data={charts.trainingImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Regulatory Impact Trend" hasData={charts.regulatoryImpactTrend.some((d) => d.count > 0)}>
        <LineChart data={charts.regulatoryImpactTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Overdue Change Trend" hasData={charts.overdueTrend.some((d) => d.count > 0)}>
        <LineChart data={charts.overdueTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#ea580c" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>
    </div>
  );
}
