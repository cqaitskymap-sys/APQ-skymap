'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import type { CapaEffectivenessChartData } from '@/lib/capa-types';
import { ChartEmptyState, hasChartData } from '@/components/ui/chart-empty-state';

const COLORS = ['#16a34a', '#ca8a04', '#dc2626', '#2563eb', '#64748b'];

function ChartCard({
  title,
  data,
  children,
}: {
  title: string;
  data: unknown[] | undefined;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">
        {hasChartData(data) ? (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        ) : (
          <ChartEmptyState />
        )}
      </CardContent>
    </Card>
  );
}

export function CapaEffectivenessCharts({ charts }: { charts: CapaEffectivenessChartData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Effectiveness Result Distribution" data={charts.resultDistribution}>
        <PieChart>
          <Pie data={charts.resultDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {charts.resultDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Monthly Effectiveness Trend" data={charts.monthlyTrend}>
        <LineChart data={charts.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Reviews" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Department-wise Effectiveness" data={charts.byDepartment}>
        <BarChart data={charts.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Source-wise Effectiveness" data={charts.bySource}>
        <BarChart data={charts.bySource}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Effective vs Not Effective Trend" data={charts.effectiveTrend}>
        <LineChart data={charts.effectiveTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="effective" stroke="#16a34a" strokeWidth={2} name="Effective" />
          <Line type="monotone" dataKey="notEffective" stroke="#dc2626" strokeWidth={2} name="Not Effective" />
        </LineChart>
      </ChartCard>
    </div>
  );
}
