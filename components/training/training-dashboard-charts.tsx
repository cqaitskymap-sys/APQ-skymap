'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import type { TrainingDashboardCharts } from '@/lib/training-dashboard-records';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#64748b'];

function ChartShell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {empty ? <EmptyState title="No data" message="No records for the selected filters." /> : children}
      </CardContent>
    </Card>
  );
}

function safeData<T>(data: T[]): T[] {
  return data?.length ? data : [];
}

export function TrainingDashboardCharts({ charts }: { charts: TrainingDashboardCharts }) {
  const monthly = safeData(charts.monthlyCompletionTrend);
  const dept = safeData(charts.deptCompliance);
  const types = safeData(charts.typeDistribution);
  const pendingCompleted = safeData(charts.pendingVsCompleted);
  const overdue = safeData(charts.overdueTrend);
  const eff = safeData(charts.effectivenessTrend);
  const sop = safeData(charts.sopComplianceTrend);
  const users = safeData(charts.userWiseStatus);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartShell title="Monthly Training Completion Trend" empty={monthly.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Completed" />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Department-wise Training Compliance" empty={dept.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dept}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} name="Compliance %" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Training Type Distribution" empty={types.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={types} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Pending vs Completed Training" empty={pendingCompleted.every((d) => d.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pendingCompleted}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Overdue Training Trend" empty={overdue.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={overdue}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Overdue" />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Effectiveness Result Trend" empty={eff.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={eff}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Bar dataKey="effective" fill="#16a34a" name="Effective" stackId="a" />
            <Bar dataKey="notEffective" fill="#dc2626" name="Not Effective" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="SOP Training Compliance Trend" empty={sop.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sop}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} name="SOP Compliance %" />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="User-wise Training Status" empty={users.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={users} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9 }} /><Tooltip /><Legend />
            <Bar dataKey="completed" fill="#16a34a" stackId="s" name="Completed" />
            <Bar dataKey="pending" fill="#f59e0b" stackId="s" name="Pending" />
            <Bar dataKey="overdue" fill="#dc2626" stackId="s" name="Overdue" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
