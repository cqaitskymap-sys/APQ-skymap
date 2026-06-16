'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import type { DeviationDashboardMetrics } from '@/lib/deviation-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

function hasData(items?: { count?: number; open?: number; closed?: number; required?: number; notRequired?: number; avgDays?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) =>
    (d.count ?? 0) > 0 ||
    (d.open ?? 0) > 0 ||
    (d.closed ?? 0) > 0 ||
    (d.required ?? 0) > 0 ||
    (d.notRequired ?? 0) > 0 ||
    (d.avgDays ?? 0) > 0,
  );
}

interface DeviationDashboardChartsProps {
  metrics: DeviationDashboardMetrics;
}

export function DeviationDashboardCharts({ metrics }: DeviationDashboardChartsProps) {
  const capaSummary = metrics.capaTrend.reduce(
    (acc, row) => ({
      required: acc.required + (row.required ?? 0),
      notRequired: acc.notRequired + (row.notRequired ?? 0),
    }),
    { required: 0, notRequired: 0 },
  );
  const capaPie = [
    { name: 'CAPA Required', count: capaSummary.required },
    { name: 'Not Required', count: capaSummary.notRequired },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Deviation Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.monthlyTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deviation by Department</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.byDepartment) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byDepartment.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deviation by Category</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.byCategory) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.byCategory.slice(0, 8)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {metrics.byCategory.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Deviation by Criticality</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.byCriticality) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byCriticality}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {metrics.byCriticality.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === 'Critical' ? '#dc2626' : entry.name === 'Major' ? '#ea580c' : '#2563eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open vs Closed Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.openClosedTrend) ? (
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CAPA Required vs Not Required</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(capaPie) ? (
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Product-wise Deviations</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.byProduct) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byProduct.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Batch Impact Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.batchImpactTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.batchImpactTrend}>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Repeat Deviation Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.repeatTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.repeatTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Closure Time Trend (Avg Days)</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.closureTimeTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.closureTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} days`, 'Avg Closure']} />
                <Bar dataKey="avgDays" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Root Cause Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.byRootCause) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(metrics.byRootCause || []).slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CAPA Linked Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          {hasData(metrics.capaLinkedTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.capaLinkedTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>
    </div>
  );
}
