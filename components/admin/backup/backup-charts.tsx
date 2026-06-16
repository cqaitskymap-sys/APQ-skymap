'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#64748b'];

interface BackupChartsProps {
  successTrend: { month: string; success: number; failed: number }[];
  typeDistribution: { name: string; value: number }[];
  restoreTrend: { month: string; count: number }[];
  sizeTrend: { month: string; size: number }[];
}

export function BackupCharts({ successTrend, typeDistribution, restoreTrend, sizeTrend }: BackupChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Backup Success Trend</CardTitle></CardHeader>
        <CardContent>
          {successTrend.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={successTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#16a34a" name="Success" />
                <Bar dataKey="failed" fill="#dc2626" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No backup data yet</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Backup Type Distribution</CardTitle></CardHeader>
        <CardContent>
          {typeDistribution.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {typeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No data</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Restore Activity Trend</CardTitle></CardHeader>
        <CardContent>
          {restoreTrend.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={restoreTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No restore activity</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Backup Size Trend (KB)</CardTitle></CardHeader>
        <CardContent>
          {sizeTrend.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sizeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="size" stroke="#2563eb" strokeWidth={2} name="Size (KB)" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No size data</p>}
        </CardContent>
      </Card>
    </div>
  );
}
