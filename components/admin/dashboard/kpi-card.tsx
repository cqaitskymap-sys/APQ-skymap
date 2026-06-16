'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './status-badge';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: string;
  isStatus?: boolean;
}

export function KpiCard({ label, value, icon: Icon, accent = 'border-l-blue-600', isStatus }: KpiCardProps) {
  return (
    <Card className={`border-l-4 ${accent} bg-white dark:bg-slate-900 shadow-sm`}>
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
