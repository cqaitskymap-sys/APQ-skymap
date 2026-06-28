'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import type { MatrixDashboardCharts } from '@/lib/training-matrix-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#64748b'];

function Shell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <p className="text-sm text-muted-foreground text-center py-12">No data</p> : children}</CardContent>
    </Card>
  );
}

export function MatrixDashboardCharts({ charts }: { charts: MatrixDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Shell title="Department Matrix Coverage" empty={charts.departmentMatrix.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentMatrix}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Training Frequency" empty={charts.frequencyDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.frequencyDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name }) => String(name).slice(0, 10)}>
              {charts.frequencyDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Training Type Distribution" empty={charts.trainingTypeDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.trainingTypeDistribution}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Compliance by Department (%)" empty={charts.complianceByDepartment.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.complianceByDepartment}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
    </div>
  );
}
