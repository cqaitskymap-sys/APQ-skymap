'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { WiCharts } from '@/lib/wi-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export function WiCharts({ charts }: { charts: WiCharts }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ChartCard title="Status Distribution">
        {charts.statusDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={charts.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {charts.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
      <ChartCard title="Department Distribution">
        {charts.departmentDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.departmentDistribution.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
      <ChartCard title="Equipment-wise WI">
        {charts.equipmentDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.equipmentDistribution.slice(0, 6)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} /><Tooltip />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
      <ChartCard title="Review Due Trend">
        {charts.reviewDueTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.reviewDueTrend}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
      <ChartCard title="Version Trend">
        {charts.versionTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.versionTrend}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
      <ChartCard title="Training Completion Trend">
        {charts.trainingCompletionTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.trainingCompletionTrend}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip /><Line type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
      <ChartCard title="Revision Trend">
        {charts.revisionTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.revisionTrend}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Bar dataKey="count" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (<Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>);
}
function Empty() { return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No data</div>; }
