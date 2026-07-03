'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Shimmer } from './skeleton-base';

export function CardSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="space-y-2">
        <Shimmer className="h-5 w-48" rounded="lg" />
        <Shimmer className="h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Shimmer className="h-10 w-10 shrink-0" rounded="lg" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-48" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
  className,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading table">
      {showHeader && (
        <div className="flex items-center gap-3">
          <Shimmer className="h-9 w-36" rounded="lg" />
          <Shimmer className="h-9 w-28" rounded="lg" />
          <Shimmer className="ml-auto h-9 w-44" rounded="lg" />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex gap-4 border-b bg-muted/30 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Shimmer key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Shimmer className="h-4 w-4 shrink-0" rounded="sm" />
            {Array.from({ length: columns - 1 }).map((_, col) => (
              <Shimmer
                key={col}
                className={cn('h-4 flex-1', col === 0 && 'max-w-[12rem]')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl border bg-card p-4', className)}
      style={{ height }}
      role="status"
      aria-label="Loading chart"
    >
      <div className="mb-4 flex items-center justify-between">
        <Shimmer className="h-5 w-36" rounded="lg" />
        <Shimmer className="h-8 w-24" rounded="lg" />
      </div>
      <div className="flex h-[calc(100%-3rem)] items-end justify-between gap-2 px-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer
            key={i}
            className="w-full"
            style={{ height: `${30 + ((i * 17) % 55)}%` }}
            rounded="sm"
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-in space-y-6', className)} role="status" aria-label="Loading dashboard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-56" rounded="lg" />
          <Shimmer className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-10 w-28" rounded="lg" />
          <Shimmer className="h-10 w-32" rounded="lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-primary/20">
            <CardContent className="p-4 space-y-3">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-16" rounded="lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton height={260} />
        <ChartSkeleton height={260} />
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}

export function FormSkeleton({ fields = 5, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-10 w-full" rounded="lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Shimmer className="h-10 w-24" rounded="lg" />
        <Shimmer className="h-10 w-24" rounded="lg" />
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 6, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <Shimmer className="h-10 w-10 shrink-0" rounded="full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-3 w-56" />
          </div>
          <Shimmer className="h-6 w-16" rounded="full" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({
  items = 6,
  columns = 3,
  className,
}: {
  items?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="status"
      aria-label="Loading grid"
    >
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <Shimmer className="h-32 w-full" rounded="lg" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AvatarSkeleton({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };
  return <Shimmer className={cn(sizes[size], className)} rounded="full" />;
}

export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-4', className)} role="status" aria-label="Loading profile">
      <AvatarSkeleton size="lg" />
      <div className="flex-1 space-y-3">
        <Shimmer className="h-6 w-40" rounded="lg" />
        <Shimmer className="h-4 w-56" />
        <div className="flex gap-2 pt-1">
          <Shimmer className="h-8 w-20" rounded="lg" />
          <Shimmer className="h-8 w-20" rounded="lg" />
        </div>
      </div>
    </div>
  );
}

export function DocumentSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 space-y-4', className)} role="status" aria-label="Loading document">
      <Shimmer className="mx-auto h-8 w-48" rounded="lg" />
      <Shimmer className="h-4 w-full" />
      <Shimmer className="h-4 w-full" />
      <Shimmer className="h-4 w-5/6" />
      <Shimmer className="h-4 w-full" />
      <Shimmer className="h-4 w-4/6" />
      <div className="pt-4 grid grid-cols-2 gap-4">
        <Shimmer className="h-24 w-full" rounded="lg" />
        <Shimmer className="h-24 w-full" rounded="lg" />
      </div>
    </div>
  );
}

export function TreeSkeleton({ depth = 3, className }: { depth?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading tree">
      {Array.from({ length: depth }).map((_, i) => (
        <div key={i} style={{ paddingLeft: `${i * 1.25}rem` }} className="flex items-center gap-2">
          <Shimmer className="h-4 w-4" rounded="sm" />
          <Shimmer className="h-4" style={{ width: `${8 + i * 3}rem` }} />
        </div>
      ))}
    </div>
  );
}

export function TimelineSkeleton({ items = 4, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-label="Loading timeline">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Shimmer className="h-3 w-3" rounded="full" />
            {i < items - 1 && <div className="mt-1 w-px flex-1 bg-border min-h-[2rem]" />}
          </div>
          <div className="flex-1 space-y-2 pb-4">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-3 w-full max-w-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationSkeleton({ items = 5, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('divide-y rounded-xl border bg-card', className)} role="status" aria-label="Loading notifications">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-3 p-4">
          <Shimmer className="h-2 w-2 mt-2 shrink-0" rounded="full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-3 w-full max-w-sm" />
          </div>
          <Shimmer className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton({ items = 5, className }: { items?: number; className?: string }) {
  return <TimelineSkeleton items={items} className={className} />;
}

export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)} role="status" aria-label="Loading calendar">
      <div className="mb-4 flex items-center justify-between">
        <Shimmer className="h-6 w-32" rounded="lg" />
        <div className="flex gap-2">
          <Shimmer className="h-8 w-8" rounded="lg" />
          <Shimmer className="h-8 w-8" rounded="lg" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Shimmer key={i} className="aspect-square w-full" rounded="lg" />
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton({ columns = 3, className }: { columns?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="rounded-xl border bg-muted/20 p-3 space-y-3">
          <Shimmer className="h-5 w-24" rounded="lg" />
          {Array.from({ length: 3 }).map((_, card) => (
            <Card key={card}>
              <CardContent className="space-y-2 p-3">
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PDFSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto max-w-2xl space-y-4', className)} role="status" aria-label="Loading PDF">
      <div className="aspect-[8.5/11] rounded-xl border-2 bg-card p-8 shadow-sm space-y-4">
        <Shimmer className="h-6 w-2/3 mx-auto" rounded="lg" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-4/5" />
        <div className="pt-8 space-y-3">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export function ImageSkeleton({
  aspectRatio = 'video',
  className,
}: {
  aspectRatio?: 'square' | 'video' | 'wide';
  className?: string;
}) {
  const ratios = { square: 'aspect-square', video: 'aspect-video', wide: 'aspect-[21/9]' };
  return (
    <Shimmer
      className={cn('w-full', ratios[aspectRatio], className)}
      rounded="xl"
      role="status"
      aria-label="Loading image"
    />
  );
}

export function EmptyLoader({ message = 'Loading...', className }: { message?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-16', className)} role="status">
      <Shimmer className="h-16 w-16" rounded="full" />
      <Shimmer className="h-4 w-40" />
      <p className="sr-only">{message}</p>
    </div>
  );
}

export function InputLoader({ className }: { className?: string }) {
  return <Shimmer className={cn('h-10 w-full', className)} rounded="lg" />;
}

export function SearchLoader({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-label="Searching">
      <Shimmer className="h-10 w-full max-w-md" rounded="lg" />
      <ListSkeleton items={4} />
    </div>
  );
}
