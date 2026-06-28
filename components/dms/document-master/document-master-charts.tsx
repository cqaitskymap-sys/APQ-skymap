'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';
import type { DocumentMasterCharts } from '@/lib/document-master-types';

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#db2777', '#64748b', '#0d9488'];

export function DocumentMasterCharts({ charts }: { charts: DocumentMasterCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Document Status Distribution">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={charts.statusDistribution.slice(0, 10)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {charts.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Category Distribution">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={charts.categoryDistribution.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
            <Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Department Distribution">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={charts.departmentDistribution.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly Document Creation">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={charts.monthlyCreation}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Review Due Trend">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={charts.reviewDueTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Version Trend">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={charts.versionTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#0891b2" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Document Growth">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={charts.documentGrowth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Area type="monotone" dataKey="cumulative" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Approval Trend">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={charts.approvalTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
            <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px]">{children}</CardContent>
    </Card>
  );
}
