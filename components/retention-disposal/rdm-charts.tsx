'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { RetentionDisposalCharts } from '@/lib/retention-disposal-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function RdmCharts({ charts }: { charts: RetentionDisposalCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Chart title="Retention Expiry Trend" data={charts.retentionExpiryTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Retention by Document Type" data={charts.retentionByDocumentType} type="pie" />
      <Chart title="Department Retention Distribution" data={charts.departmentRetentionDistribution} type="bar" />
      <Chart title="Disposal Trend" data={charts.disposalTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Legal Hold Trend" data={charts.legalHoldTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Regulatory Hold Trend" data={charts.regulatoryHoldTrend} type="line" dataKey="count" xKey="month" />
    </div>
  );
}

function Chart({ title, data, type, dataKey, xKey }: {
  title: string;
  data: Array<{ name?: string; value?: number; month?: string; count?: number }>;
  type: 'pie' | 'bar' | 'line';
  dataKey?: string;
  xKey?: string;
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
                <Line type="monotone" dataKey={dataKey || 'count'} stroke="#0d9488" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
