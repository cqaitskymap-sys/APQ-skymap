'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { csvChartData } from '@/lib/csv-mgmt-service';
import type { CsvSystem, CsvRiskAssessment } from '@/lib/csv-mgmt-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#64748b'];

export function CsvDashboardCharts({ systems, risks }: { systems: CsvSystem[]; risks: CsvRiskAssessment[] }) {
  const charts = csvChartData(systems, risks);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">System by Type</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byType.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {charts.byType.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Validation Status Trend</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byStatus}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">GxP Classification</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byGxp} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            <Cell fill="#dc2626" /><Cell fill="#94a3b8" />
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Periodic Review Due Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.reviewTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
