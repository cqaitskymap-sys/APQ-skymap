'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { warehouseChartData } from '@/lib/warehouse-mgmt-service';
import type { InventoryStock, MaterialReceipt, MaterialDispensing } from '@/lib/warehouse-mgmt-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#64748b', '#0891b2'];

export function WarehouseDashboardCharts({
  inventory, receipts, dispensing,
}: {
  inventory: InventoryStock[]; receipts: MaterialReceipt[]; dispensing: MaterialDispensing[];
}) {
  const charts = warehouseChartData(inventory, receipts, dispensing);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Inventory by Material Type</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {charts.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Expiry Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.expiryTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#ea580c" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendor Material Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.vendorTrend} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Rejected Material Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.rejectedTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Batch Consumption Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.consumptionTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} /></LineChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
