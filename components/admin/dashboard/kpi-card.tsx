'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Shimmer } from '@/components/loading/skeleton-base';
import { StatusBadge } from './status-badge';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: string;
  isStatus?: boolean;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'border-l-blue-600',
  isStatus,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className={`border-l-4 ${accent} bg-white dark:bg-slate-900 shadow-sm`} role="status" aria-label="Loading KPI">
        <CardContent className="space-y-3 p-4">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-16" rounded="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-l-4 ${accent} bg-white dark:bg-slate-900 shadow-sm animate-in`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-blue-600 shrink-0" />}
        </div>
        <div className="mt-2">
          {isStatus ? (
            <StatusBadge status={String(value)} />
          ) : (
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiCardSkeleton({ accent = 'border-l-blue-600' }: { accent?: string }) {
  return <KpiCard label="" value="" loading accent={accent} />;
}
