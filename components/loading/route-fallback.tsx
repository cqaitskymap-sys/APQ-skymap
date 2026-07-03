import { cn } from '@/lib/utils';

type RouteFallbackVariant = 'dashboard' | 'table' | 'form' | 'list' | 'auth' | 'full';

function ShimmerBar({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md bg-muted/80', className)} aria-hidden="true" />;
}

export function RouteLoadingFallback({
  variant = 'dashboard',
  className,
}: {
  variant?: RouteFallbackVariant;
  className?: string;
}) {
  if (variant === 'auth' || variant === 'full') {
    return (
      <div
        className={cn('flex min-h-screen items-center justify-center bg-background', className)}
        role="status"
        aria-label="Loading"
      >
        <div className="premium-loader-card w-full max-w-sm p-8">
          <div className="premium-loader-mark mx-auto mb-6 h-20 w-20">
            <div className="premium-loader-orbit premium-loader-orbit-outer"><span /></div>
            <div className="premium-loader-core inset-4 text-lg">S</div>
          </div>
          <p className="premium-loader-title text-center">Skymap QMS</p>
          <p className="premium-loader-message mt-2 justify-center">Loading</p>
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={cn('animate-in space-y-6 p-1', className)} role="status" aria-label="Loading form">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <ShimmerBar className="h-4 w-28" />
            <ShimmerBar className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('animate-in space-y-3 p-1', className)} role="status" aria-label="Loading table">
        <div className="flex gap-3">
          <ShimmerBar className="h-9 w-32 rounded-lg" />
          <ShimmerBar className="ml-auto h-9 w-40 rounded-lg" />
        </div>
        <div className="overflow-hidden rounded-xl border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
              <ShimmerBar className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('animate-in space-y-3 p-1', className)} role="status" aria-label="Loading list">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border p-3">
            <ShimmerBar className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-40" />
              <ShimmerBar className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('animate-in space-y-6 p-1', className)} role="status" aria-label="Loading dashboard">
      <div className="space-y-2">
        <ShimmerBar className="h-8 w-56 rounded-lg" />
        <ShimmerBar className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <ShimmerBar className="h-3 w-24" />
            <ShimmerBar className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <ShimmerBar className="h-64 w-full rounded-xl" />
      <ShimmerBar className="h-48 w-full rounded-xl" />
    </div>
  );
}
