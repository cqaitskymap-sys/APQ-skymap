'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { CertificateDashboardCharts } from '@/lib/training-certificate-types';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2'];

function Shell({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="h-[220px]">{empty ? <p className="text-sm text-muted-foreground text-center py-12">No data</p> : children}</CardContent>
    </Card>
  );
}

export function CertificateDashboardCharts({ charts }: { charts: CertificateDashboardCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Shell title="Certificate Issue Trend" empty={charts.issueTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.issueTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Certificate Expiry Trend" empty={charts.expiryTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.expiryTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Department-wise Certificates" empty={charts.departmentCertificates.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentCertificates}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Training Type Distribution" empty={charts.trainingTypeDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.trainingTypeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {charts.trainingTypeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Renewal Trend" empty={charts.renewalTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.renewalTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
      <Shell title="Compliance Trend" empty={charts.complianceTrend.every((d) => d.percent === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.complianceTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Line type="monotone" dataKey="percent" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Compliance %" />
          </LineChart>
        </ResponsiveContainer>
      </Shell>
    </div>
  );
}
