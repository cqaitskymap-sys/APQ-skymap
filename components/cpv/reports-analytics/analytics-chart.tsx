'use client';

import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export function AnalyticsChart({
  title,
  data,
  type = 'bar',
  colors = ['#2563eb', '#059669', '#d97706', '#dc2626'],
}: {
  title: string;
  data: Array<{ name: string; value?: number; compliance?: number }>;
  type?: 'bar' | 'pie';
  colors?: string[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border text-sm text-muted-foreground">
        No chart data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name,
    value: d.value ?? d.compliance ?? 0,
  }));

  return (
    <div className="h-56">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'pie' ? (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={70} label>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : (
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
