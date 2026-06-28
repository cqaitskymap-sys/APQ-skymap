'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import type { CalendarDashboardCharts } from '@/lib/training-calendar-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04'];

function ChartShell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <EmptyState title="No data" message="No records yet." /> : children}</CardContent>
    </Card>
  );
}

export function CalendarDashboardCharts({ charts }: { charts: CalendarDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartShell title="Monthly Training Calendar" empty={charts.monthlyCalendar.every((d) => d.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.monthlyCalendar}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Training Type Distribution" empty={charts.typeDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {charts.typeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Department Schedule" empty={charts.departmentSchedule.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentSchedule}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Trainer Workload" empty={charts.trainerWorkload.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.trainerWorkload} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Attendance Trend" empty={charts.attendanceTrend.every((d) => d.present === 0 && d.absent === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.attendanceTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="present" stroke="#16a34a" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="absent" stroke="#dc2626" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Room Utilization" empty={charts.roomUtilization.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.roomUtilization}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#0891b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
