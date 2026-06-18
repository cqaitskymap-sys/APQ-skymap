'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ComplaintDashboardChartData } from '@/lib/complaint-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

function hasCount(items?: { count?: number; open?: number; closed?: number; avgDays?: number; value?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) =>
    (d.count ?? 0) > 0 || (d.open ?? 0) > 0 || (d.closed ?? 0) > 0
    || (d.avgDays ?? 0) > 0 || (d.value ?? 0) > 0,
  );
}

export function ComplaintTrendCharts({ charts }: { charts: ComplaintDashboardChartData }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Complaint Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.monthlyTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.monthlyTrend}>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Product-wise Complaint Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byProduct) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byProduct.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Market-wise Complaint Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byMarket) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byMarket.slice(0, 8)}>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Category-wise Complaint Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byCategory) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.byCategory} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {charts.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Criticality Distribution</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byCriticality) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byCriticality}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Root Cause Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byRootCause) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byRootCause.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ea580c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Repeat Complaint Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.repeatComplaintTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.repeatComplaintTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#ca8a04" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CAPA Linkage Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.capaLinkedTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.capaLinkedTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recall Evaluation Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.recallEvaluationTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.recallEvaluationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Average Closure Time Trend (days)</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.closureTimeTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.closureTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="avgDays" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>
    </div>
  );
}
