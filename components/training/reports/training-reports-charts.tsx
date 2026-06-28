'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { ChartCard } from './chart-card';
import type { TrainingReportCharts } from '@/lib/training-reports-records';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#64748b'];

export function TrainingReportsCharts({ charts }: { charts: TrainingReportCharts }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Monthly Completion Trend" empty={charts.monthlyCompletionTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.monthlyCompletionTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Department Compliance" empty={charts.departmentCompliance.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.departmentCompliance}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} name="Compliance %" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Pass vs Fail" empty={charts.passVsFail.every((d) => d.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.passVsFail} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {charts.passVsFail.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Competency Distribution" empty={charts.competencyDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={charts.competencyDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {charts.competencyDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Certificate Expiry Trend" empty={charts.certificateExpiryTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.certificateExpiryTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Retraining Trend" empty={charts.retrainingTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.retrainingTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Training Type Distribution" empty={charts.trainingTypeDistribution.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.trainingTypeDistribution} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9 }} /><Tooltip />
            <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Trainer Performance" empty={charts.trainerPerformance.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.trainerPerformance}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis domain={[0, 100]} /><Tooltip /><Legend />
            <Bar dataKey="passRate" fill="#0891b2" name="Pass Rate %" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Assessment Score Trend" empty={charts.assessmentScoreTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.assessmentScoreTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
            <Line type="monotone" dataKey="avgScore" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Avg Score" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Overdue Trend" empty={charts.overdueTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.overdueTrend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
