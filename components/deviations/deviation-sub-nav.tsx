'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, Search, ClipboardCheck, AlertTriangle,
  Link2, CheckCircle, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Deviation Dashboard', href: '/qms/deviation', icon: LayoutDashboard, exact: true },
  { label: 'Create Deviation', href: '/qms/deviation/create', icon: Plus },
  { label: 'Investigation', href: '/qms/deviation?status=under_investigation', icon: Search },
  { label: 'Impact Assessment', href: '/qms/deviation?status=qa_review', icon: ClipboardCheck },
  { label: 'CAPA Link', href: '/qms/deviation?capa_required=true', icon: Link2 },
  { label: 'Approval Workflow', href: '/qms/deviation?status=submitted', icon: CheckCircle },
  { label: 'Deviation Reports', href: '/qms/deviation/reports', icon: FileDown },
];

export function DeviationSubNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Deviation Management
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href.split('?')[0]
            : pathname.startsWith(item.href.split('?')[0]) && item.href !== '/qms/deviation';
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

export function DeviationStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    under_investigation: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    qa_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    capa_required: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
    open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>
      {label}
    </span>
  );
}

export function DeviationCriticalityBadge({ criticality }: { criticality: string }) {
  const colors: Record<string, string> = {
    Minor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    Major: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    Critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[criticality] || colors.Minor)}>
      {criticality}
    </span>
  );
}
