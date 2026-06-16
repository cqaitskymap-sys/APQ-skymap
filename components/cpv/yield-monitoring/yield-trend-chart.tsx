'use client';

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export function YieldTrendChart({
  data,
  title,
}: {
  data: Array<{ label: string; yield: number; target?: number; lower?: number; upper?: number }>;
  title?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No yield trend data
      </div>
    );
  }
  const lower = data[0]?.lower;
  const upper = data[0]?.upper;
  return (
    <div className="h-[220px] w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Legend />
          {lower != null && <ReferenceLine y={lower} stroke="#dc2626" strokeDasharray="4 4" label="LSL" />}
          {upper != null && <ReferenceLine y={upper} stroke="#dc2626" strokeDasharray="4 4" label="USL" />}
          <Line type="monotone" dataKey="yield" name="Yield %" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          {data.some((d) => d.target != null) && (
            <Line type="monotone" dataKey="target" name="Target" stroke="#059669" strokeDasharray="5 5" dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
