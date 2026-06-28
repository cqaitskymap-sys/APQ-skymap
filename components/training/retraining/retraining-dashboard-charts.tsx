'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { RetrainingDashboardCharts } from '@/lib/training-retraining-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#64748b'];

function Shell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <p className="text-sm text-muted-foreground text-center py-12">No data</p> : children}</CardContent>
    </Card>
  );
}

export function RetrainingDashboardCharts({ charts }: { charts: RetrainingDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Shell title="Retraining Trend" empty={charts.retrainingTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.retrainingTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Trigger Type Distribution" empty={charts.triggerTypeDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.triggerTypeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name }) => String(name).slice(0, 12)}>
              {charts.triggerTypeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Department-wise Retraining" empty={charts.departmentRetraining.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentRetraining}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Completion Trend" empty={charts.completionTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.completionTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Pass vs Fail" empty={charts.passVsFail.every((d) => d.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.passVsFail}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Competency Improvement" empty={charts.competencyImprovement.every((d) => d.percent === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.competencyImprovement}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Line type="monotone" dataKey="percent" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} name="Pass %" />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Certificate Renewal Trend" empty={charts.certificateRenewalTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.certificateRenewalTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Overdue Trend" empty={charts.overdueTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.overdueTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
    </div>
  );
}
