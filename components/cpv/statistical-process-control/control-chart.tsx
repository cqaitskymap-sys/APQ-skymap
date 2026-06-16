'use client';

import {
  CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { SpcChartPoint } from '@/lib/cpv-spc-records';

function SpcDot(props: { cx?: number; cy?: number; payload?: SpcChartPoint }) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  const fill = payload.outOfControl ? '#dc2626' : payload.violated ? '#d97706' : '#2563eb';
  const r = payload.outOfControl ? 5 : payload.violated ? 4 : 3;
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth={1} />;
}

export function ControlChart({
  data,
  title,
  lsl,
  usl,
  height = 320,
}: {
  data: SpcChartPoint[];
  title?: string;
  lsl?: number;
  usl?: number;
  height?: number;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No control chart data
      </div>
    );
  }
  const cl = data[0]?.centerLine;
  const ucl = data[0]?.ucl;
  const lcl = data[0]?.lcl;

  return (
    <div className="w-full" style={{ height }}>
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={50} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as SpcChartPoint | undefined;
              return p ? `Batch ${p.batchNumber} · ${p.date}` : '';
            }}
          />
          <Legend verticalAlign="top" height={28} />
          {Number.isFinite(lsl) && lsl != null && (
            <ReferenceLine y={lsl} stroke="#9333ea" strokeDasharray="4 4" label={{ value: 'LSL', fontSize: 10 }} />
          )}
          {Number.isFinite(usl) && usl != null && (
            <ReferenceLine y={usl} stroke="#9333ea" strokeDasharray="4 4" label={{ value: 'USL', fontSize: 10 }} />
          )}
          {Number.isFinite(ucl) && <ReferenceLine y={ucl} stroke="#dc2626" strokeDasharray="6 4" label={{ value: 'UCL', fontSize: 10 }} />}
          {Number.isFinite(cl) && <ReferenceLine y={cl} stroke="#059669" label={{ value: 'CL', fontSize: 10 }} />}
          {Number.isFinite(lcl) && <ReferenceLine y={lcl} stroke="#dc2626" strokeDasharray="6 4" label={{ value: 'LCL', fontSize: 10 }} />}
          <Line type="monotone" dataKey="value" name="Observed" stroke="#2563eb" strokeWidth={2} dot={<SpcDot />} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MovingRangeChart({
  data,
  title,
  height = 280,
}: {
  data: SpcChartPoint[];
  title?: string;
  height?: number;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No moving range data
      </div>
    );
  }
  const cl = data[0]?.centerLine;
  const ucl = data[0]?.ucl;

  return (
    <div className="w-full" style={{ height }}>
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {Number.isFinite(ucl) && <ReferenceLine y={ucl} stroke="#dc2626" strokeDasharray="6 4" label="UCL" />}
          {Number.isFinite(cl) && <ReferenceLine y={cl} stroke="#059669" label="CL" />}
          <Line type="monotone" dataKey="value" name="Moving Range" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
