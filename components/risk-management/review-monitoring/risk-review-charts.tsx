'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RiskReviewChartData } from '@/lib/risk-review-monitoring-records';

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No review data yet</div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskReviewCharts({ charts }: { charts: RiskReviewChartData }) {
  const hasTrend = charts.riskTrendAnalysis.some((d) => d.count > 0);
  const hasResidual = charts.residualRiskTrend.length > 0;
  const hasStatus = charts.reviewStatusTrend.some((d) => d.count > 0);
  const hasDevOos = charts.deviationOosCorrelation.some((d) => d.deviations > 0 || d.oos > 0);
  const hasCapa = charts.capaCorrelation.some((d) => d.count > 0);
  const hasComplaint = charts.complaintCorrelation.some((d) => d.count > 0);

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Risk Trend Analysis" hasData={hasTrend}>
        <BarChart data={charts.riskTrendAnalysis}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Residual Risk Trend" hasData={hasResidual}>
        <LineChart data={charts.residualRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="rpn" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Review Status Trend" hasData={hasStatus}>
        <BarChart data={charts.reviewStatusTrend.filter((d) => d.count > 0)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Deviation / OOS Correlation" hasData={hasDevOos}>
        <BarChart data={charts.deviationOosCorrelation}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="deviations" fill="#ea580c" />
          <Bar dataKey="oos" fill="#dc2626" />
        </BarChart>
      </ChartCard>

      <ChartCard title="CAPA Correlation" hasData={hasCapa}>
        <BarChart data={charts.capaCorrelation}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Complaint Correlation" hasData={hasComplaint}>
        <BarChart data={charts.complaintCorrelation}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  );
}
