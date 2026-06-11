'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { recallChartData } from '@/lib/recall-service';
import type { RecallRecord } from '@/lib/recall-types';

const COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#2563eb'];

export function RecallDashboardCharts({ records }: { records: RecallRecord[] }) {
  const charts = recallChartData(records);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recall by Product</CardTitle></CardHeader><CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts.byProduct.slice(0, 8)} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recall by Classification</CardTitle></CardHeader><CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={charts.byClassification} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>{charts.byClassification.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recovery Trend</CardTitle></CardHeader><CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={charts.recoveryTrend.length ? charts.recoveryTrend : [{ month: 'N/A', percent: 0 }]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="percent" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Recovery %" /></LineChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Market Wise Recall</CardTitle></CardHeader><CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts.byMarket}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
    </div>
  );
}
