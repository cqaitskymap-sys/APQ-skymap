'use client';

import { healthScoreTone } from '@/lib/cpv-reports-records';

export function HealthScoreBadge({ score, label }: { score: number; label?: string }) {
  const tone = healthScoreTone(score);
  const cls = tone === 'green' ? 'bg-green-50 text-green-700 border-green-200'
    : tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200'
      : tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {score}/100 · {label || (score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Needs Attention' : 'Critical')}
    </span>
  );
}
