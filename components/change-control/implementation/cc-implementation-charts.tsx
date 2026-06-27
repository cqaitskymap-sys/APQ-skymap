'use client';

import type { CcImplementationChartData } from '@/lib/change-control-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#0d9488'];

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        {hasData ? children : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</p>}
      </CardContent>
    </Card>
  );
}

export function CcImplementationCharts({ charts }: { charts: CcImplementationChartData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Task Status Distribution" hasData={charts.statusDistribution.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.statusDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
              {charts.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Implementation Progress Trend" hasData={charts.progressTrend.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.progressTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} domain={[0, 100]} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Progress']} /><Bar dataKey="count" fill="#2563eb" name="Avg Progress %" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Department-wise Task Progress" hasData={charts.byDepartment.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byDepartment}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'Completion']} /><Bar dataKey="count" fill="#0d9488" name="Completion %" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Overdue Task Trend" hasData={charts.overdueTrend.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.overdueTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Bar dataKey="count" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
