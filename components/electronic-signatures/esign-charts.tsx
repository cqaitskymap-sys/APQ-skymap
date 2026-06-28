'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { SignatureCharts } from '@/lib/electronic-signatures-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function EsignCharts({ charts }: { charts: SignatureCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Chart title="Daily Signature Trend" data={charts.dailyTrend} type="line" dataKey="count" xKey="date" />
      <Chart title="Module-wise Signatures" data={charts.moduleWise} type="bar" />
      <Chart title="Signature Meaning Distribution" data={charts.meaningDistribution} type="pie" />
      <Chart title="Failed Authentication Trend" data={charts.failedAuthTrend} type="line" dataKey="count" xKey="date" />
      <Chart title="User Signature Activity" data={charts.userActivity} type="bar" />
    </div>
  );
}

function Chart({ title, data, type, dataKey, xKey }: {
  title: string;
  data: Array<{ name?: string; value?: number; date?: string; count?: number }>;
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
                <Line type="monotone" dataKey={dataKey || 'count'} stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
