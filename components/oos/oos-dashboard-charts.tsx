'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { OosDashboardMetrics } from '@/lib/oos-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

function hasCount(items?: { count?: number; open?: number; closed?: number; linked?: number; notLinked?: number; avgDays?: number; phase1?: number; phase2?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) =>
    (d.count ?? 0) > 0 || (d.open ?? 0) > 0 || (d.closed ?? 0) > 0
    || (d.linked ?? 0) > 0 || (d.notLinked ?? 0) > 0 || (d.avgDays ?? 0) > 0
    || (d.phase1 ?? 0) > 0 || (d.phase2 ?? 0) > 0,
  );
}

export function OosDashboardCharts({ metrics }: { metrics: OosDashboardMetrics }) {
  const capaPie = [
    { name: 'CAPA Linked', count: metrics.capaLinked },
    { name: 'Not Linked', count: Math.max(0, metrics.total - metrics.capaLinked) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly OOS Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.monthlyTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OOS by Department</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.byDepartment) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OOS by Product</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.byProduct) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byProduct.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OOS by Test Name</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.byTestName) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byTestName.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0891b2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OOS by Root Cause</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.byRootCause) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.byRootCause.slice(0, 8)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {metrics.byRootCause.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Phase-I vs Phase-II Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.phaseTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.phaseTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="phase1" fill="#eab308" name="Phase-I" radius={[4, 4, 0, 0]} />
                <Bar dataKey="phase2" fill="#ea580c" name="Phase-II" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open vs Closed Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.openClosedTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.openClosedTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" fill="#f59e0b" name="Open" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" fill="#16a34a" name="Closed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CAPA Linked vs Not Linked</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(capaPie) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={capaPie} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  <Cell fill="#ea580c" />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Average Closure Time Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.closureTimeTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.closureTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} days`, 'Avg Closure']} />
                <Line type="monotone" dataKey="avgDays" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Batch Impact Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(metrics.batchImpactTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.batchImpactTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>
    </div>
  );
}
