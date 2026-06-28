'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import type { TrainingAuditCharts } from '@/lib/training-audit-trail-records';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#64748b', '#0d9488'];

function ChartShell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <EmptyState title="No data" message="No audit events yet." /> : children}</CardContent>
    </Card>
  );
}

export function AuditDashboardCharts({ charts }: { charts: TrainingAuditCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartShell title="Daily Audit Activity" empty={charts.dailyActivity.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.dailyActivity}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Events" />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Module-wise Events" empty={charts.moduleEvents.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.moduleEvents} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => e.name.slice(0, 12)}>
              {charts.moduleEvents.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Action Distribution" empty={charts.actionDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.actionDistribution}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="User Activity" empty={charts.userActivity.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.userActivity} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Department Activity" empty={charts.departmentActivity.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentActivity}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#0891b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Critical Event Trend" empty={charts.criticalTrend.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.criticalTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Critical" />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
