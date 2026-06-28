'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { EffectivenessDashboardCharts } from '@/lib/training-effectiveness-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#64748b'];

function Shell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <p className="text-sm text-muted-foreground text-center py-12">No data</p> : children}</CardContent>
    </Card>
  );
}

export function EffectivenessDashboardCharts({ charts }: { charts: EffectivenessDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Shell title="Pass vs Fail" empty={charts.passVsFail.every((d) => d.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.passVsFail}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Department-wise Competency (% Pass)" empty={charts.departmentCompetency.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentCompetency}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Training Effectiveness Trend" empty={charts.effectivenessTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.effectivenessTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Evaluation Status" empty={charts.statusDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name }) => String(name).slice(0, 10)}>
              {charts.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Shell>
    </div>
  );
}
