'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { auditChartData } from '@/lib/audit-mgmt-service';
import type { AuditRecord, AuditFinding } from '@/lib/audit-mgmt-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04'];

export function AuditDashboardCharts({ audits, findings }: { audits: AuditRecord[]; findings: AuditFinding[] }) {
  const charts = auditChartData(audits, findings);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Audit by Type</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.byType.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {charts.byType.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Audit by Department</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byDepartment.slice(0, 8)}><CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Finding by Category</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Finding by Criticality</CardTitle></CardHeader>
        <CardContent className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.byCriticality}><CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis /><Tooltip />
            <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Audit Trend</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.monthlyAudit}><CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Open vs Closed Findings</CardTitle></CardHeader>
        <CardContent className="h-[220px]"><ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={charts.openVsClosed} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            <Cell fill="#ea580c" /><Cell fill="#16a34a" />
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer></CardContent></Card>
    </div>
  );
}
