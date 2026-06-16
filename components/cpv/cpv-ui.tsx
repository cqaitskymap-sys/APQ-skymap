'use client';

import { AlertTriangle, CheckCircle2, Database, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { cn } from '@/lib/utils';

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            FDA Stage 3
          </Badge>
          <Badge variant="outline">ALCOA+</Badge>
          <Badge variant="outline">21 CFR Part 11</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="no-print flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneClasses = {
    blue: 'border-l-blue-600',
    green: 'border-l-emerald-600',
    amber: 'border-l-amber-500',
    red: 'border-l-red-600',
  };
  return (
    <Card className={cn('border-l-4 shadow-sm', toneClasses[tone])}>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const complies = ['complies', 'pass', 'excellent', 'low', 'stable', 'in control', 'approved', 'closed'].includes(normalized);
  const critical = normalized === 'critical';
  const pending = normalized.includes('pending') || normalized === 'under review' || normalized === 'in review';
  const warning = !critical && !pending && ['oot', 'acceptable', 'medium', 'needs improvement', 'insufficient data', 'high'].includes(normalized);
  const classes = critical
    ? 'border-red-300 bg-red-900/10 text-red-900 dark:text-red-300'
    : complies
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : pending
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : warning
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-red-200 bg-red-50 text-red-700';
  const Icon = complies ? CheckCircle2 : critical || !warning && !pending ? ShieldAlert : AlertTriangle;
  return (
    <Badge variant="outline" className={cn('gap-1 whitespace-nowrap', classes)}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

export function DataState({
  loading,
  empty,
  emptyText = 'No CPV records are available for the selected filters.',
}: {
  loading: boolean;
  empty: boolean;
  emptyText?: string;
}) {
  if (loading) {
    return <TableSkeleton rows={6} cols={5} />;
  }
  if (empty) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
        <Database className="mb-3 h-9 w-9 text-slate-300" />
        <p className="font-medium">No records found</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return null;
}
