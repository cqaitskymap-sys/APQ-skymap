'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import type { ApprovalDashboardCharts } from '@/lib/training-approval-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2'];

function ChartShell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <EmptyState title="No data" message="No records yet." /> : children}</CardContent>
    </Card>
  );
}

export function ApprovalDashboardCharts({ charts }: { charts: ApprovalDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartShell title="Approval Status Distribution" empty={charts.statusDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {charts.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Approval Trend" empty={charts.approvalTrend.every((d) => d.approved === 0 && d.rejected === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.approvalTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="approved" stroke="#16a34a" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="rejected" stroke="#dc2626" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Department-wise Approvals" empty={charts.departmentApprovals.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentApprovals}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="Workflow Type Distribution" empty={charts.workflowTypeDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.workflowTypeDistribution} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9 }} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
      <ChartShell title="SLA Compliance Trend" empty={charts.slaComplianceTrend.every((d) => d.percent === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.slaComplianceTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Line type="monotone" dataKey="percent" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="SLA %" />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
