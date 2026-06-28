'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import type { LmsDashboardCharts } from '@/lib/lms-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2'];

function ChartShell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        {empty ? <EmptyState title="No data" message="No records yet." /> : children}
      </CardContent>
    </Card>
  );
}

export function LmsDashboardCharts({ charts }: { charts: LmsDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartShell title="Daily Sync Trend" empty={charts.dailySyncTrend.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.dailySyncTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="count" stroke="#2563eb" name="Total" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="success" stroke="#16a34a" name="Success" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="failed" stroke="#dc2626" name="Failed" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Sync Success Rate" empty={charts.syncSuccessRate.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.syncSuccessRate} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {charts.syncSuccessRate.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Course Import Trend" empty={charts.courseImportTrend.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.courseImportTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Certificate Import Trend" empty={charts.certificateImportTrend.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.certificateImportTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="User Sync Trend" empty={charts.userSyncTrend.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.userSyncTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Error Distribution" empty={charts.errorDistribution.every((d) => d.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.errorDistribution} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} /><Tooltip />
            <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
