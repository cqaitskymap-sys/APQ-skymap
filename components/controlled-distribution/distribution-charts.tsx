'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { DistributionCharts } from '@/lib/controlled-distribution-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export function DistributionCharts({ charts }: { charts: DistributionCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Chart title="Distribution Trend" data={charts.distributionTrend} type="line" dataKey="count" />
      <Chart title="Department Distribution" data={charts.departmentDistribution} type="bar" />
      <Chart title="Document Type Distribution" data={charts.documentTypeDistribution} type="bar" />
      <Chart title="Acknowledgement Status" data={charts.acknowledgementStatus} type="pie" />
      <Chart title="Training Assignment Trend" data={charts.trainingAssignmentTrend} type="line" dataKey="count" />
      <Chart title="Site Distribution" data={charts.siteDistribution} type="bar" />
    </div>
  );
}

function Chart({ title, data, type, dataKey }: {
  title: string;
  data: Array<{ name?: string; value?: number; month?: string; count?: number }>;
  type: 'pie' | 'bar' | 'line';
  dataKey?: string;
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
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey={dataKey || 'count'} stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
