'use client';

import { Loader2, Check, X, Trash2, Download, Upload, Search, Save, FileDown, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonLoaderVariant = 'default' | 'success' | 'error';

interface ButtonLoaderProps {
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function ButtonLoader({
  loading,
  success,
  error,
  loadingText,
  children,
  className,
  iconClassName,
}: ButtonLoaderProps) {
  const variant: ButtonLoaderVariant = success ? 'success' : error ? 'error' : 'default';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {loading && (
        <Loader2 className={cn('h-4 w-4 animate-spin', iconClassName)} aria-hidden="true" />
      )}
      {!loading && variant === 'success' && (
        <Check className={cn('h-4 w-4 text-green-600', iconClassName)} aria-hidden="true" />
      )}
      {!loading && variant === 'error' && (
        <X className={cn('h-4 w-4 text-destructive', iconClassName)} aria-hidden="true" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </span>
  );
}

function ActionLoader({
  icon: Icon,
  label,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground opacity-60" aria-hidden="true" />
    </span>
  );
}

export const SaveLoader = (props: { className?: string }) => (
  <ActionLoader icon={Save} label="Saving..." {...props} />
);
export const DeleteLoader = (props: { className?: string }) => (
  <ActionLoader icon={Trash2} label="Deleting..." {...props} />
);
export const ExportLoader = (props: { className?: string }) => (
  <ActionLoader icon={FileDown} label="Exporting..." {...props} />
);
export const UploadActionLoader = (props: { className?: string }) => (
  <ActionLoader icon={Upload} label="Uploading..." {...props} />
);
export const DownloadLoader = (props: { className?: string }) => (
  <ActionLoader icon={Download} label="Downloading..." {...props} />
);
export const SearchActionLoader = (props: { className?: string }) => (
  <ActionLoader icon={Search} label="Searching..." {...props} />
);
export const ApprovalLoader = (props: { className?: string }) => (
  <ActionLoader icon={ShieldCheck} label="Processing approval..." {...props} />
);
