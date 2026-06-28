'use client';

import { cn } from '@/lib/utils';
import { masterStatusLabel } from '@/lib/document-master-types';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Under Review': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Pending Approval': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Effective: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Superseded: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  Archived: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  Obsolete: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  Retired: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
      STATUS_COLORS[status] ?? STATUS_COLORS.Draft,
      className,
    )}>
      {masterStatusLabel(status)}
    </span>
  );
}

export function VersionBadge({ version, major, minor }: { version: string; major?: number; minor?: number }) {
  const label = major !== undefined && minor !== undefined ? `v${major}.${minor}` : `v${version}`;
  return (
    <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-mono font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
      {label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
      {category}
    </span>
  );
}
