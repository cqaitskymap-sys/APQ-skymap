'use client';

import { scoreGaugeColor } from '@/lib/pqr-summary-conclusion-records';

export function QualityScoreGauge({
  score,
  band,
  size = 140,
}: {
  score: number;
  band?: string;
  size?: number;
}) {
  const safe = Math.max(0, Math.min(100, score));
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  const color = scoreGaugeColor(safe);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center -mt-[calc(50%+8px)] pt-[50%]">
        <p className="text-2xl font-bold" style={{ color }}>{safe}</p>
        <p className="text-xs text-muted-foreground">{band || 'Score'}</p>
      </div>
    </div>
  );
}
