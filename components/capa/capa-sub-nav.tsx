'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, Link2, Wrench, CheckCircle2, ShieldCheck, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'CAPA Dashboard', href: '/qms/capa', icon: LayoutDashboard, exact: true },
  { label: 'Create CAPA', href: '/qms/capa/create', icon: Plus },
  { label: 'Investigation Link', href: '/qms/capa/investigation', icon: Link2 },
  { label: 'Implementation', href: '/qms/capa/implementation', icon: Wrench },
  { label: 'Effectiveness Check', href: '/qms/capa/effectiveness', icon: CheckCircle2 },
  { label: 'Approval Workflow', href: '/qms/capa/approval', icon: ShieldCheck },
  { label: 'Reports', href: '/qms/capa/reports', icon: FileDown },
];

export function CapaSubNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          CAPA Management
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const base = item.href.split('?')[0];
          const active = item.exact
            ? pathname === base
            : pathname.startsWith(base) && !item.exact;
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

export function CapaStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    submitted: 'bg-blue-100 text-blue-800',
    assigned: 'bg-indigo-100 text-indigo-800',
    under_implementation: 'bg-purple-100 text-purple-800',
    implemented: 'bg-teal-100 text-teal-800',
    effectiveness_pending: 'bg-amber-100 text-amber-800',
    effectiveness_completed: 'bg-green-100 text-green-800',
    qa_review: 'bg-orange-100 text-orange-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-slate-200 text-slate-800',
    overdue: 'bg-red-100 text-red-800 animate-pulse',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>
      {label}
    </span>
  );
}

export function CapaPriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', colors[priority] || colors.medium)}>
      {priority}
    </span>
  );
}
