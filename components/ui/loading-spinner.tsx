'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export function LoadingSpinner({ className, label = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12 animate-in', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 className={cn('animate-spin text-primary', sizeMap[size])} aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
