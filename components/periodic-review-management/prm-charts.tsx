'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { PeriodicReviewCharts } from '@/lib/periodic-review-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export function PrmCharts({ charts }: { charts: PeriodicReviewCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Chart title="Review Status Distribution" data={charts.statusDistribution} type="pie" />
      <Chart title="Review Frequency Distribution" data={charts.frequencyDistribution} type="pie" />
      <Chart title="Department Review Trend" data={charts.departmentTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Overdue Trend" data={charts.overdueTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Review Decision Trend" data={charts.decisionTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Revision Trend" data={charts.revisionTrend} type="bar" dataKey="minor" xKey="month" multi />
    </div>
  );
}

function Chart({ title, data, type, dataKey, xKey, multi }: {
  title: string;
  data: Array<{ name?: string; value?: number; month?: string; count?: number; minor?: number; major?: number }>;
  type: 'pie' | 'bar' | 'line';
  dataKey?: string;
  xKey?: string;
  multi?: boolean;
}) {
  const empty = !data.length;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            {type === 'pie' ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : type === 'line' ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey || 'month'} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey={dataKey || 'count'} stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            ) : multi ? (
              <BarChart data={data.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="minor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="major" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={data.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
