'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, Calendar, Package, FlaskConical, LineChart, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Stability Dashboard', href: '/qms/stability', icon: LayoutDashboard, exact: true },
  { label: 'Create Study', href: '/qms/stability/create', icon: Plus },
  { label: 'Stability Schedule', href: '/qms/stability/schedule', icon: Calendar },
  { label: 'Sample Pulling', href: '/qms/stability/sample-pulling', icon: Package },
  { label: 'Stability Results', href: '/qms/stability/results', icon: FlaskConical },
  { label: 'Trend Analysis', href: '/qms/stability/trends', icon: LineChart },
  { label: 'Stability Reports', href: '/qms/stability/reports', icon: FileDown },
];

export function StabilitySubNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Stability Management
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const base = item.href.split('?')[0];
          const active = item.exact
            ? pathname === base
            : pathname.startsWith(base) && pathname !== '/qms/stability';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function StudyStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    approved_protocol: 'bg-blue-100 text-blue-800',
    study_ongoing: 'bg-green-100 text-green-800',
    sample_due: 'bg-amber-100 text-amber-800 animate-pulse',
    sample_pulled: 'bg-teal-100 text-teal-800',
    testing_completed: 'bg-purple-100 text-purple-800',
    qa_review: 'bg-orange-100 text-orange-800',
    completed: 'bg-emerald-100 text-emerald-800',
    closed: 'bg-slate-200 text-slate-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>
      {label}
    </span>
  );
}

export function ResultStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Complies: 'bg-green-100 text-green-800',
    OOT: 'bg-amber-100 text-amber-800',
    OOS: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Complies)}>
      {status}
    </span>
  );
}

export function PullStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Pulled: 'bg-green-100 text-green-800',
    Missed: 'bg-red-100 text-red-800 animate-pulse',
    Cancelled: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Pending)}>
      {status}
    </span>
  );
}
