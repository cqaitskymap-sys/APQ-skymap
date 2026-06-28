'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { PrintControlCharts } from '@/lib/print-control-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#4f46e5', '#059669', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function PcmCharts({ charts }: { charts: PrintControlCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Chart title="Print Trend" data={charts.printTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Document Type Distribution" data={charts.documentTypeDistribution} type="pie" />
      <Chart title="Department Printing" data={charts.departmentPrinting} type="bar" />
      <Chart title="Controlled vs Uncontrolled" data={charts.controlledVsUncontrolled} type="pie" />
      <Chart title="Outstanding Copy Trend" data={charts.outstandingCopyTrend} type="line" dataKey="count" xKey="month" />
      <Chart title="Destruction Trend" data={charts.destructionTrend} type="line" dataKey="count" xKey="month" />
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
                <Line type="monotone" dataKey={dataKey || 'count'} stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
