'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import type { RecallDashboardChartData } from '@/lib/recall-types';

const COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#2563eb', '#7c3aed', '#0891b2', '#16a34a'];

function hasCount(data: { count?: number; value?: number }[] | undefined): boolean {
  if (!data?.length) return false;
  return data.some((d) => (d.count ?? d.value ?? 0) > 0);
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

interface RecallDashboardChartsProps {
  charts: RecallDashboardChartData;
}

export function RecallDashboardCharts({ charts }: RecallDashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Recall Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.monthlyTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recall by Classification</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byClassification) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.byClassification} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {charts.byClassification.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recall by Product</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.byProduct) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byProduct.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recall by Market</CardTitle></CardHeader>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recovery Percentage Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {charts.recoveryTrend?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.recoveryTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avgPercent" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Recovery %" />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open vs Closed Recall</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.openVsClosed) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.openVsClosed} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  <Cell fill="#f59e0b" />
                  <Cell fill="#16a34a" />
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Complaint Linked Recall Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px]">
          {hasCount(charts.complaintLinkedTrend) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.complaintLinkedTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CAPA Linked Recall Trend</CardTitle></CardHeader>
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
    </div>
  );
}
