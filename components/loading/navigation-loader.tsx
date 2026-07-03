'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NavigationLoaderProps {
  className?: string;
}

export function NavigationLoader({ className }: NavigationLoaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    setVisible(true);
    setProgress(12);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const increment = p < 50 ? 8 : p < 75 ? 4 : 1.5;
        return Math.min(90, p + increment * Math.random());
      });
    }, 180);
  }, []);

  const complete = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
  }, []);

  useEffect(() => {
    start();
    const frame = requestAnimationFrame(() => complete());
    return () => cancelAnimationFrame(frame);
  }, [pathname, searchParams, start, complete]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn('fixed inset-x-0 top-0 z-[200] h-[3px]', className)}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading progress"
    >
      <motion.div
        className="h-full origin-left bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 shadow-[0_0_12px_rgba(79,70,229,0.45)]"
        initial={false}
        animate={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
        }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { width: { duration: 0.25, ease: 'easeOut' }, opacity: { duration: 0.3 } }
        }
      />
    </div>
  );
}

export function ProgressBar({
  value,
  indeterminate = false,
  className,
}: {
  value?: number;
  indeterminate?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <motion.div
          className="h-full w-1/3 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500"
          animate={reducedMotion ? undefined : { x: ['-100%', '400%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <motion.div
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500"
          animate={{ width: `${value ?? 0}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      )}
    </div>
  );
}

export function GlobalLoadingOverlay({
  activeCount,
  message,
}: {
  activeCount: number;
  message?: string;
}) {
  if (activeCount <= 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[150] flex items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="text-muted-foreground">{message ?? 'Syncing...'}</span>
    </div>
  );
}
