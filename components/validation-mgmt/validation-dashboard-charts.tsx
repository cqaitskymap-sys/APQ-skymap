'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { validationChartData } from '@/lib/validation-mgmt-service';
import type { ValidationRecord } from '@/lib/validation-mgmt-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#64748b'];

export function ValidationDashboardCharts({ records }: { records: ValidationRecord[] }) {
  const charts = validationChartData(records);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Validation by Type</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byType.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {charts.byType.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Validation by Department</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byDept}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.statusTrend} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" /><YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="value" fill="#16a34a" /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Deviation & Revalidation Trends</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.deviationTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} name="Deviations" />
          </LineChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
