'use client';

import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export function CapabilityChart({
  data,
  title,
}: {
  data: Array<{ label: string; cp: number; cpk: number; ppk?: number }>;
  title?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No capability chart data
      </div>
    );
  }
  return (
    <div className="h-[300px] w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
          <YAxis domain={[0, 'auto']} />
          <Tooltip />
          <Legend />
          <Bar dataKey="cp" name="Cp" fill="#2563eb" />
          <Bar dataKey="cpk" name="Cpk" fill="#059669" />
          {data.some((d) => d.ppk != null) && <Bar dataKey="ppk" name="Ppk" fill="#7c3aed" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CapabilityTrendChart({
  data,
  title,
}: {
  data: Array<{ month: string; cpk: number }>;
  title?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No trend data
      </div>
    );
  }
  return (
    <div className="h-[300px] w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 'auto']} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="cpk" name="Avg Cpk" stroke="#2563eb" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
