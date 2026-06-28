'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { FormCharts } from '@/lib/forms-templates-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export function FormsCharts({ charts }: { charts: FormCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Chart title="Status Distribution" data={charts.statusDistribution} type="pie" />
      <Chart title="Category Distribution" data={charts.categoryDistribution} type="bar" />
      <Chart title="Department Distribution" data={charts.departmentDistribution} type="bar" />
      <Chart title="Review Due Trend" data={charts.reviewDueTrend} type="line" lineKey="count" />
      <Chart title="Version Trend" data={charts.versionTrend} type="bar" lineKey="count" />
      <Chart title="Revision Trend" data={charts.revisionTrend} type="bar" lineKey="count" />
      <Chart title="Training Completion Trend" data={charts.trainingCompletionTrend} type="line" lineKey="pct" />
    </div>
  );
}

function Chart({ title, data, type, lineKey }: { title: string; data: Array<{ name?: string; value?: number; month?: string; count?: number; pct?: number }>; type: 'pie' | 'bar' | 'line'; lineKey?: string }) {
  const empty = !data.length;
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent>{empty ? <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No data</div> : (
        <ResponsiveContainer width="100%" height={200}>
          {type === 'pie' ? (
            <PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
          ) : type === 'line' ? (
            <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey={lineKey || 'count'} stroke="#10b981" strokeWidth={2} dot={false} /></LineChart>
          ) : (
            <BarChart data={data.slice(0, 6)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
          )}
        </ResponsiveContainer>
      )}</CardContent></Card>
  );
}
