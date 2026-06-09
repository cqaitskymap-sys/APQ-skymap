'use client';

import { cn } from '@/lib/utils';

interface PremiumLoaderProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export function PremiumLoader({
  message = 'Preparing your workspace',
  className,
  compact = false,
}: PremiumLoaderProps) {
  return (
    <div
      className={cn(
        'premium-loader-shell flex w-full items-center justify-center',
        compact ? 'min-h-[18rem]' : 'min-h-[calc(100vh-9rem)]',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${message}. Loading`}
    >
      <div className="premium-loader-card">
        <div className="premium-loader-glow" aria-hidden="true" />

        <div className="premium-loader-mark" aria-hidden="true">
          <div className="premium-loader-orbit premium-loader-orbit-outer">
            <span />
          </div>
          <div className="premium-loader-orbit premium-loader-orbit-inner">
            <span />
          </div>
          <div className="premium-loader-core">
            <div className="premium-loader-core-shine" />
            <span>S</span>
          </div>
        </div>

        <div className="relative text-center">
          <p className="premium-loader-title">Skymap QMS</p>
          <div className="premium-loader-message">
            <span>{message}</span>
            <span className="premium-loader-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>

        <div className="premium-loader-track" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
