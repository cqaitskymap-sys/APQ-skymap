'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RiskFmeaChartData } from '@/lib/risk-fmea-records';

const COLORS = ['#16a34a', '#d97706', '#ea580c', '#dc2626'];

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No FMEA data yet</div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskFmeaCharts({ charts }: { charts: RiskFmeaChartData }) {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Risk Distribution" hasData={charts.riskDistribution.some((d) => d.count > 0)}>
        <PieChart>
          <Pie data={charts.riskDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
            {charts.riskDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Top 10 Risks" hasData={charts.top10Risks.length > 0}>
        <BarChart data={charts.top10Risks}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="rpn" fill="#dc2626" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Residual Risk Trend" hasData={charts.residualRiskTrend.length > 0}>
        <BarChart data={charts.residualRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="rpn" fill="#7c3aed" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Mitigation Progress" hasData={charts.mitigationProgress.some((d) => d.pending > 0 || d.done > 0)}>
        <BarChart data={charts.mitigationProgress}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="pending" fill="#d97706" />
          <Bar dataKey="done" fill="#16a34a" />
        </BarChart>
      </ChartCard>
    </div>
  );
}
