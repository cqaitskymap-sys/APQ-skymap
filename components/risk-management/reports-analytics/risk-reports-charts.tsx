'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RiskReportAnalyticsMetrics, RiskReportChartData } from '@/lib/risk-reports-records';

const COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#0891b2', '#64748b'];

function hasCount(items?: { count?: number; closed?: number; open?: number; reduction?: number }[]): boolean {
  if (!items?.length) return false;
  return items.some((d) => (d.count ?? 0) > 0 || (d.closed ?? 0) > 0 || (d.open ?? 0) > 0 || (d.reduction ?? 0) > 0);
}

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for selected filters</div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskReportsAnalyticsKpis({ metrics }: { metrics: RiskReportAnalyticsMetrics }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <KpiCard label="Total Risks" value={metrics.totalRisks} />
      <KpiCard label="Open Risks" value={metrics.openRisks} accent="border-l-amber-500" />
      <KpiCard label="Closed Risks" value={metrics.closedRisks} accent="border-l-emerald-600" />
      <KpiCard label="Critical Risks" value={metrics.criticalRisks} accent="border-l-red-600" />
      <KpiCard label="High Risks" value={metrics.highRisks} accent="border-l-orange-600" />
      <KpiCard label="Medium Risks" value={metrics.mediumRisks} accent="border-l-amber-500" />
      <KpiCard label="Low Risks" value={metrics.lowRisks} accent="border-l-emerald-600" />
      <KpiCard label="Residual High" value={metrics.residualHighRisks} accent="border-l-red-600" />
      <KpiCard label="Mitigation Pending" value={metrics.mitigationPending} accent="border-l-amber-500" />
      <KpiCard label="Overdue Risks" value={metrics.overdueRisks} accent="border-l-red-600" />
      <KpiCard label="Average RPN" value={metrics.averageRpn} accent="border-l-violet-600" />
      <KpiCard label="Closure Rate %" value={`${metrics.riskClosureRate}%`} accent="border-l-blue-600" />
    </div>
  );
}

export function RiskReportsCharts({ charts, compact }: { charts: RiskReportChartData; compact?: boolean }) {
  const grid = compact ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3';
  return (
    <div className={`grid gap-4 ${grid}`}>
      <ChartCard title="Risk Level Distribution" hasData={hasCount(charts.riskLevelDistribution)}>
        <PieChart>
          <Pie data={charts.riskLevelDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
            {charts.riskLevelDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Monthly Risk Trend" hasData={hasCount(charts.monthlyRiskTrend)}>
        <LineChart data={charts.monthlyRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Risk Category Trend" hasData={hasCount(charts.riskCategoryTrend)}>
        <BarChart data={charts.riskCategoryTrend.slice(0, 8)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Department-wise Risk Trend" hasData={hasCount(charts.departmentRiskTrend)}>
        <BarChart data={charts.departmentRiskTrend.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 9 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Residual Risk Trend" hasData={hasCount(charts.residualRiskTrend)}>
        <LineChart data={charts.residualRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Mitigation Trend" hasData={hasCount(charts.mitigationTrend)}>
        <BarChart data={charts.mitigationTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Risk Closure Trend" hasData={hasCount(charts.riskClosureTrend)}>
        <BarChart data={charts.riskClosureTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="closed" fill="#16a34a" stackId="a" name="Closed" />
          <Bar dataKey="open" fill="#f59e0b" stackId="a" name="Open" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Critical Risk Trend" hasData={hasCount(charts.criticalRiskTrend)}>
        <LineChart data={charts.criticalRiskTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ChartCard>

      <ChartCard title="FMEA Trend" hasData={hasCount(charts.fmeaTrend)}>
        <BarChart data={charts.fmeaTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Risk Reduction Trend %" hasData={hasCount(charts.riskReductionTrend)}>
        <LineChart data={charts.riskReductionTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="reduction" stroke="#7c3aed" strokeWidth={2} name="Reduction %" />
        </LineChart>
      </ChartCard>
    </div>
  );
}
