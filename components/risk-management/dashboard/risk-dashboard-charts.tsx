'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RiskDashboardChartData } from '@/lib/risk-dashboard-records';

const LEVEL_COLORS = ['#16a34a', '#d97706', '#ea580c', '#dc2626'];

function ChartCard({
  title,
  hasData,
  children,
  className,
}: {
  title: string;
  hasData: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className || ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data for selected filters
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskDashboardCharts({ charts }: { charts: RiskDashboardChartData }) {
  const levelHasData = charts.riskLevelDistribution.some((d) => d.count > 0);

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Risk Level Distribution" hasData={levelHasData}>
        <PieChart>
          <Pie data={charts.riskLevelDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
            {charts.riskLevelDistribution.map((_, i) => (
              <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Monthly Risk Trend" hasData={charts.monthlyRiskTrend.length > 0}>
        <LineChart data={charts.monthlyRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Risk Category Trend" hasData={charts.riskCategoryTrend.length > 0}>
        <BarChart data={charts.riskCategoryTrend} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Department-wise Risk Distribution" hasData={charts.departmentRiskTrend.length > 0}>
        <BarChart data={charts.departmentRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0ea5e9" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Open vs Closed Risks" hasData={charts.openVsClosed.length > 0}>
        <BarChart data={charts.openVsClosed}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="open" fill="#f59e0b" name="Open" />
          <Bar dataKey="closed" fill="#16a34a" name="Closed" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Residual Risk Trend" hasData={charts.residualRiskTrend.length > 0}>
        <LineChart data={charts.residualRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Mitigation Status Trend" hasData={charts.mitigationStatusTrend.length > 0}>
        <BarChart data={charts.mitigationStatusTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="pending" fill="#d97706" name="Pending" />
          <Bar dataKey="in_progress" fill="#2563eb" name="In Progress" />
          <Bar dataKey="completed" fill="#16a34a" name="Completed" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Critical Risk Trend" hasData={charts.criticalRiskTrend.length > 0}>
        <LineChart data={charts.criticalRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Risk Closure Trend" hasData={charts.riskClosureTrend.length > 0}>
        <BarChart data={charts.riskClosureTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="closed" fill="#16a34a" name="Closed" />
          <Bar dataKey="open" fill="#94a3b8" name="Open" />
        </BarChart>
      </ChartCard>
    </div>
  );
}
