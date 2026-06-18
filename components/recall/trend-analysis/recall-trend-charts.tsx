'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RecallTrendAnalysisResult } from '@/lib/recall-trend-records';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

function EmptyChart() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for selected filters
    </div>
  );
}

function hasCount(items?: { count?: number; avgPercent?: number; avgDays?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) => (d.count ?? 0) > 0 || (d.avgPercent ?? 0) > 0 || (d.avgDays ?? 0) > 0);
}

export function RecallTrendCharts({ analysis }: { analysis: RecallTrendAnalysisResult | null }) {
  if (!analysis || analysis.filtered_count === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Generate a trend analysis to view charts. Empty filters will not crash the dashboard.
      </div>
    );
  }

  const m = analysis.metrics;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Monthly Recall Trend" hasData={hasCount(m.monthlyTrend)}>
        <LineChart data={m.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Recalls" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Product-wise Recall Trend" hasData={hasCount(m.byProduct)}>
        <BarChart data={m.byProduct.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Market-wise Recall Trend" hasData={hasCount(m.byMarket)}>
        <BarChart data={m.byMarket.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Recall Classification Distribution" hasData={hasCount(m.byClassification)}>
        <PieChart>
          <Pie data={m.byClassification} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {m.byClassification.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartCard>

      <ChartCard title="Recall Type Distribution" hasData={hasCount(m.byType)}>
        <BarChart data={m.byType}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Source-wise Recall Trend" hasData={hasCount(m.bySource)}>
        <BarChart data={m.bySource.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#0891b2" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Recovery Percentage Trend" hasData={hasCount(m.recoveryTrend)}>
        <LineChart data={m.recoveryTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="avgPercent" stroke="#16a34a" strokeWidth={2} name="Avg Recovery %" />
        </LineChart>
      </ChartCard>

      <ChartCard title="CAPA Linked Recall Trend" hasData={hasCount(m.capaLinkedTrend)}>
        <BarChart data={m.capaLinkedTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="CAPA Linked" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Regulatory Notification Trend" hasData={hasCount(m.regulatoryTrend)}>
        <LineChart data={m.regulatoryTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} name="Notifications" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Closure Time Trend" hasData={hasCount(m.closureTimeTrend)}>
        <LineChart data={m.closureTimeTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="avgDays" stroke="#0891b2" strokeWidth={2} name="Avg Closure Days" />
        </LineChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title, hasData, children,
}: { title: string; hasData: boolean; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        ) : <EmptyChart />}
      </CardContent>
    </Card>
  );
}
