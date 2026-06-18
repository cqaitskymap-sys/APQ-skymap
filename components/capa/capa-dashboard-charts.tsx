'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import type { CapaDashboardChartData } from '@/lib/capa-dashboard-records';
import { ChartEmptyState, hasChartData } from '@/components/ui/chart-empty-state';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

interface CapaDashboardChartsProps {
  charts: CapaDashboardChartData;
}

export function CapaDashboardCharts({ charts }: CapaDashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Monthly CAPA Trend" data={charts.monthlyTrend}>
        <LineChart data={charts.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>

      <ChartCard title="CAPA by Source" data={charts.bySource}>
        <PieChart>
          <Pie data={charts.bySource} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {charts.bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="CAPA by Department" data={charts.byDepartment}>
        <BarChart data={charts.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="CAPA by Status" data={charts.byStatus}>
        <BarChart data={charts.byStatus.map((d) => ({ name: d.name, count: d.count ?? d.value ?? 0 }))}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Open vs Closed Trend" data={charts.openClosedTrend}>
        <LineChart data={charts.openClosedTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="open" stroke="#ea580c" strokeWidth={2} name="Open" />
          <Line type="monotone" dataKey="closed" stroke="#16a34a" strokeWidth={2} name="Closed" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Overdue CAPA Trend" data={charts.overdueTrend}>
        <BarChart data={charts.overdueTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Effective vs Not Effective" data={charts.effectiveness}>
        <BarChart data={charts.effectiveness}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
            {charts.effectiveness.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.name === 'Effective' ? '#16a34a' : entry.name === 'Not Effective' ? '#dc2626' : '#ca8a04'}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>

      <ChartCard title="CAPA Closure Time Trend (Avg Days)" data={charts.closureTimeTrend}>
        <LineChart data={charts.closureTimeTrend}>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        {hasChartData(data) ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState />
        )}
      </CardContent>
    </Card>
  );
}
