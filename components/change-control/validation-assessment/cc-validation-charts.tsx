'use client';

import type { CcValidationChartData } from '@/lib/change-control-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#0d9488', '#f59e0b', '#6366f1'];

function ChartCard({ title, hasData, children }: { title: string; hasData: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        {hasData ? children : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</p>}
      </CardContent>
    </Card>
  );
}

export function CcValidationCharts({ charts }: { charts: CcValidationChartData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Validation Impact Distribution" hasData={charts.impactDistribution.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.impactDistribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {charts.impactDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="CSV Impact Trend" hasData={charts.csvImpactTrend.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.csvImpactTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Bar dataKey="count" fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Qualification Requirement Trend" hasData={charts.qualificationTrend.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.qualificationTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Bar dataKey="count" fill="#0d9488" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Revalidation Trend" hasData={charts.revalidationTrend.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.revalidationTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Bar dataKey="count" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
