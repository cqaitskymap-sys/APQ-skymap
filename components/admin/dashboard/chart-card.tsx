'use client';

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from './empty-state';

const CHART_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

interface DashboardChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  type: 'pie' | 'bar' | 'line';
}

export function DashboardChartCard({ title, data, type }: DashboardChartCardProps) {
  const isEmpty = data.length === 1 && data[0].name === 'No Data' && data[0].value === 0;

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState message="Chart data will appear when records exist." />
        ) : (
          <figure aria-label={`${title} chart`} className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {type === 'pie' ? (
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {data.map((item, index) => (
                      <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : type === 'bar' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name={title} fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={title}
                    stroke="#0891b2"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
