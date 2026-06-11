'use client';

import Link from 'next/link';
import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EmptyState({
  title = 'No records found',
  description = 'Create a new record or adjust your filters to see data here.',
  icon: Icon = Database,
  action,
  actionLabel,
  actionHref,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  const actionNode = action ?? (actionLabel && actionHref ? (
    <Button asChild variant="outline" size="sm">
      <Link href={actionHref}>{actionLabel}</Link>
    </Button>
  ) : null);

  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionNode && <div className="mt-4">{actionNode}</div>}
    </div>
  );
}
