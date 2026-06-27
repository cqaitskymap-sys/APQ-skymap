'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RiskMitigationChartData } from '@/lib/risk-mitigation-records';

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No mitigation data yet</div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskMitigationCharts({ charts }: { charts: RiskMitigationChartData }) {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Mitigation Status Distribution" hasData={charts.statusDistribution.some((d) => d.count > 0)}>
        <BarChart data={charts.statusDistribution}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Risk Reduction Trend" hasData={charts.riskReductionTrend.some((d) => d.reduction > 0)}>
        <LineChart data={charts.riskReductionTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line dataKey="reduction" stroke="#16a34a" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Residual Risk Trend" hasData={charts.residualRiskTrend.some((d) => d.count > 0)}>
        <BarChart data={charts.residualRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#dc2626" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Department-wise Progress" hasData={charts.departmentProgress.length > 0}>
        <BarChart data={charts.departmentProgress}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="open" fill="#d97706" />
          <Bar dataKey="closed" fill="#16a34a" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Overdue Mitigation Trend" hasData={charts.overdueTrend.some((d) => d.count > 0)}>
        <LineChart data={charts.overdueTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line dataKey="count" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ChartCard>
    </div>
  );
}
