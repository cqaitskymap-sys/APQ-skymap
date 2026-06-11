'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { equipmentChartData } from '@/lib/equipment-mgmt-service';
import type { EquipmentRecord, BreakdownRecord } from '@/lib/equipment-mgmt-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#64748b'];

export function EquipmentDashboardCharts({ equipment, breakdowns }: { equipment: EquipmentRecord[]; breakdowns: BreakdownRecord[] }) {
  const charts = equipmentChartData(equipment, breakdowns);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Calibration Due Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.calTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">PM Due Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.pmTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.bdTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Equipment Status</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {charts.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Department Wise Equipment</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byDept} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" /><YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
