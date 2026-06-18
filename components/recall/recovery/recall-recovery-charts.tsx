'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { RecallRecoveryTrendPoint } from '@/lib/recall-types';

export function RecallRecoveryTrendChart({ data }: { data: RecallRecoveryTrendPoint[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recovery Trend</CardTitle></CardHeader>
        <CardContent className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          No recovery trend data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recovery Trend</CardTitle></CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="qty" allowDecimals={false} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="qty" dataKey="recovered" fill="#16a34a" name="Recovered" />
            <Bar yAxisId="qty" dataKey="pending" fill="#dc2626" name="Pending" />
            <Line yAxisId="pct" type="monotone" dataKey="percent" stroke="#2563eb" strokeWidth={2} name="Recovery %" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MarketRecoveryChart({ data }: { data: { market_region: string; recovery_percent: number }[] }) {
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Market-wise Recovery %</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="market_region" width={100} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="recovery_percent" fill="#2563eb" radius={[0, 4, 4, 0]} name="Recovery %" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
