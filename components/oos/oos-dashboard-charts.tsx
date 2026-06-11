'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell } from 'recharts';
import type { OosDashboardMetrics } from '@/lib/oos-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2'];

export function OosDashboardCharts({ metrics }: { metrics: OosDashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly OOS Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={metrics.monthlyTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} /></LineChart>
        </ResponsiveContainer></CardContent>
      </Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Department Wise OOS</CardTitle></CardHeader>
        <CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer></CardContent>
      </Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Product Wise OOS</CardTitle></CardHeader>
        <CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.byProduct.slice(0, 8)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} /></BarChart>
        </ResponsiveContainer></CardContent>
      </Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Phase-I Outcome Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.rootCauseTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>{metrics.rootCauseTrend.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer></CardContent>
      </Card>
      <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OOS Closure Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.closureTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
            <Bar dataKey="open" fill="#f59e0b" name="Open" radius={[4, 4, 0, 0]} /><Bar dataKey="closed" fill="#16a34a" name="Closed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer></CardContent>
      </Card>
    </div>
  );
}
