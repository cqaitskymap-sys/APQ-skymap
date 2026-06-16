'use client';

import { cn } from '@/lib/utils';

const RISK_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function RiskBadge({ risk }: { risk?: string | null }) {
  const key = (risk || 'medium').toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', RISK_STYLES[key] || RISK_STYLES.medium)}>
      {label}
    </span>
  );
}
