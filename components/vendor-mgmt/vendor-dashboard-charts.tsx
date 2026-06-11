'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { vendorChartData } from '@/lib/vendor-mgmt-service';
import type { VendorRecord, VendorPerformance } from '@/lib/vendor-mgmt-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2'];

export function VendorDashboardCharts({ vendors, performance }: { vendors: VendorRecord[]; performance: VendorPerformance[] }) {
  const charts = vendorChartData(vendors, performance);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendor by Type</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byType.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {charts.byType.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendor by Risk Category</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byRisk}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Performance Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.perfTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Approved vs Rejected</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.approvedVsRejected} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            <Cell fill="#16a34a" /><Cell fill="#dc2626" /><Cell fill="#94a3b8" />
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
