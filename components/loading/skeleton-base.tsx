'use client';

import { cn } from '@/lib/utils';

interface ShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

export function Shimmer({ className, rounded = 'md', ...props }: ShimmerProps) {
  return (
    <div
      className={cn(
        'skeleton relative overflow-hidden bg-muted/80',
        roundedMap[rounded],
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonBlock({
  className,
  lines = 1,
  gap = 'gap-2',
}: {
  className?: string;
  lines?: number;
  gap?: string;
}) {
  return (
    <div className={cn('flex flex-col', gap, className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}
