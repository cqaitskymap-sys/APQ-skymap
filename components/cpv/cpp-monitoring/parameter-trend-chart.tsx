'use client';

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export function ParameterTrendChart({
  data,
  title,
}: {
  data: Array<{ label: string; observed: number; target?: number; lsl?: number; usl?: number }>;
  title?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No trend data for selected parameter
      </div>
    );
  }
  const lsl = data[0]?.lsl;
  const usl = data[0]?.usl;
  return (
    <div className="h-[300px] w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip />
          <Legend />
          {lsl != null && <ReferenceLine y={lsl} stroke="#dc2626" strokeDasharray="4 4" label="LSL" />}
          {usl != null && <ReferenceLine y={usl} stroke="#dc2626" strokeDasharray="4 4" label="USL" />}
          <Line type="monotone" dataKey="observed" name="Observed" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          {data.some((d) => d.target != null) && (
            <Line type="monotone" dataKey="target" name="Target" stroke="#059669" strokeDasharray="5 5" dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
