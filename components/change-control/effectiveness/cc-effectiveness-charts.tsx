'use client';

import type { CcEffectivenessChartData } from '@/lib/change-control-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const COLORS = ['#16a34a', '#f59e0b', '#dc2626', '#3b82f6', '#8b5cf6'];

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? children : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</p>}
      </CardContent>
    </Card>
  );
}

export function CcEffectivenessCharts({ charts }: { charts: CcEffectivenessChartData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Effectiveness Distribution" hasData={charts.resultDistribution.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.resultDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {charts.resultDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Monthly Effectiveness Trend" hasData={charts.monthlyTrend.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Department Effectiveness Trend" hasData={charts.byDepartment.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byDepartment}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} domain={[0, 100]} />
            <Tooltip formatter={(value, name) => [value, name === 'avgScore' ? 'Avg Score' : 'Reviews']} />
            <Bar dataKey="avgScore" fill="#0d9488" name="Avg Score" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Change Type Effectiveness Trend" hasData={charts.byChangeType.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byChangeType}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} domain={[0, 100]} />
            <Tooltip formatter={(value, name) => [value, name === 'avgScore' ? 'Avg Score' : 'Reviews']} />
            <Bar dataKey="avgScore" fill="#7c3aed" name="Avg Score" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
