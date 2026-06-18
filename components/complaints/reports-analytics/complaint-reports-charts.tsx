'use client';

import type { ComplaintDashboardChartData, ComplaintDashboardMetrics } from '@/lib/complaint-types';
import { ComplaintDashboardCharts } from '@/components/complaints/complaint-dashboard-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#64748b'];

interface ComplaintReportsChartsProps {
  metrics: ComplaintDashboardMetrics;
  charts: ComplaintDashboardChartData;
  byStatus?: { name: string; count: number }[];
}

export function ComplaintReportsCharts({ charts, byStatus = [] }: ComplaintReportsChartsProps) {
  const hasStatus = byStatus.some((d) => (d.count ?? 0) > 0);

  return (
    <div className="space-y-4">
      <ComplaintDashboardCharts charts={charts} />
      {hasStatus && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus.slice(0, 8)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {byStatus.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
