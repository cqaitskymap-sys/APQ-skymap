'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { monitoringChartData } from '@/lib/monitoring-mgmt-service';
import type { AreaRecord, EnvironmentalRecord, UtilityRecord, ExcursionRecord } from '@/lib/monitoring-mgmt-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#64748b'];

export function MonitoringDashboardCharts({
  environmental, utility, excursions, areas,
}: {
  environmental: EnvironmentalRecord[]; utility: UtilityRecord[];
  excursions: ExcursionRecord[]; areas: AreaRecord[];
}) {
  const charts = monitoringChartData(environmental, utility, excursions, areas);
  const gradeData = Object.entries(charts.byGrade).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Temperature Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.tempTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">RH Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.rhTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Differential Pressure Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.dpTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Microbial Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.microbialTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Utility Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.utilityTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#0891b2" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Excursion Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.excursionTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Area Wise Compliance %</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.areaCompliance} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Areas by Grade</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {gradeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
