'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartPoint {
  name: string;
  value: number;
}

interface AuditTrailChartsProps {
  byModule: ChartPoint[];
  byAction: ChartPoint[];
  userActivity: ChartPoint[];
  failedLoginTrend: ChartPoint[];
  criticalTrend: ChartPoint[];
}

function MiniBarChart({ data, color = '#2563eb' }: { data: ChartPoint[]; color?: string }) {
  if (!data.length) {
    return <p className="text-xs text-muted-foreground py-8 text-center">No data</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MiniLineChart({ data, color = '#dc2626' }: { data: ChartPoint[]; color?: string }) {
  if (!data.length) {
    return <p className="text-xs text-muted-foreground py-8 text-center">No data</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AuditTrailCharts({
  byModule, byAction, userActivity, failedLoginTrend, criticalTrend,
}: AuditTrailChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Logs by Module</CardTitle></CardHeader>
        <CardContent><MiniBarChart data={byModule} color="#2563eb" /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Logs by Action Type</CardTitle></CardHeader>
        <CardContent><MiniBarChart data={byAction} color="#7c3aed" /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">User Activity Trend</CardTitle></CardHeader>
        <CardContent><MiniBarChart data={userActivity} color="#059669" /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Failed Login Trend (7 days)</CardTitle></CardHeader>
        <CardContent><MiniLineChart data={failedLoginTrend} color="#dc2626" /></CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Critical Actions Trend (7 days)</CardTitle></CardHeader>
        <CardContent><MiniLineChart data={criticalTrend} color="#d97706" /></CardContent>
      </Card>
    </div>
  );
}
