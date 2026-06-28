'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { DocumentAuditCharts } from '@/lib/document-audit-trail-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#4f46e5', '#059669', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function DatCharts({ charts }: { charts: DocumentAuditCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Chart title="Daily Audit Activity" data={charts.dailyActivity} type="line" dataKey="count" xKey="date" />
      <Chart title="Event Type Distribution" data={charts.eventTypeDistribution} type="pie" />
      <Chart title="Module Activity" data={charts.moduleActivity} type="bar" />
      <Chart title="User Activity" data={charts.userActivity} type="bar" />
      <Chart title="Department Activity" data={charts.departmentActivity} type="bar" />
      <Chart title="Security Event Trend" data={charts.securityEventTrend} type="line" dataKey="count" xKey="date" />
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
                <XAxis dataKey={xKey || 'date'} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey={dataKey || 'count'} stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data.slice(0, 8)}>
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
