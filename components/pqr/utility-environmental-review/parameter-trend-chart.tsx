'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function ParameterTrendChart({
  title, data, empty,
}: {
  title: string;
  data: Array<{ month: string; value: number }>;
  empty?: boolean;
}) {
  if (empty || !data.length) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{title}: No data</div>;
  }
  return (
    <div className="h-40">
      <p className="text-xs font-medium mb-2">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
