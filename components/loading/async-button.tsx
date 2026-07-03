'use client';

import { forwardRef, useState, useCallback } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ButtonLoader } from './button-loaders';
import { cn } from '@/lib/utils';

export interface AsyncButtonProps extends ButtonProps {
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  loadingText?: string;
  successDuration?: number;
  onAsyncClick?: () => Promise<void> | void;
}

export const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (
    {
      loading: controlledLoading,
      success: controlledSuccess,
      error: controlledError,
      loadingText,
      successDuration = 1500,
      onAsyncClick,
      onClick,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const [internalLoading, setInternalLoading] = useState(false);
    const [internalSuccess, setInternalSuccess] = useState(false);
    const [internalError, setInternalError] = useState(false);

    const loading = controlledLoading ?? internalLoading;
    const success = controlledSuccess ?? internalSuccess;
    const error = controlledError ?? internalError;

    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (loading || disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
        if (!onAsyncClick || e.defaultPrevented) return;

        setInternalLoading(true);
        setInternalError(false);
        setInternalSuccess(false);
        try {
          await onAsyncClick();
          setInternalSuccess(true);
          window.setTimeout(() => setInternalSuccess(false), successDuration);
        } catch {
          setInternalError(true);
          window.setTimeout(() => setInternalError(false), successDuration);
        } finally {
          setInternalLoading(false);
        }
      },
      [loading, disabled, onClick, onAsyncClick, successDuration]
    );

    return (
      <Button
        ref={ref}
        className={cn(className)}
        disabled={disabled || loading}
        aria-busy={loading}
        onClick={handleClick}
        {...props}
      >
        <ButtonLoader loading={loading} success={success} error={error} loadingText={loadingText}>
          {children}
        </ButtonLoader>
      </Button>
    );
  }
);
AsyncButton.displayName = 'AsyncButton';
