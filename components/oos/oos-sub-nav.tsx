'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, FlaskConical, Factory, Link2, CheckCircle, FileDown, Microscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/qms/oos', icon: LayoutDashboard, exact: true },
  { label: 'Create OOS', href: '/qms/oos/create', icon: Plus },
  { label: 'Phase-I Investigation', href: '/qms/oos?status=phase1_investigation', icon: Microscope },
  { label: 'Phase-II Investigation', href: '/qms/oos?status=phase2_investigation', icon: Factory },
  { label: 'CAPA Link', href: '/qms/oos?capa_linked=true', icon: Link2 },
  { label: 'Approval Workflow', href: '/qms/oos?status=final_qa_review', icon: CheckCircle },
  { label: 'Reports', href: '/qms/oos/reports', icon: FileDown },
];

export function OosSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">OOS Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href.split('?')[0] : pathname.startsWith(item.href.split('?')[0]) && item.href !== '/qms/oos';
          return (
            <Link key={item.href} href={item.href} className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}>
              <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function OosStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    phase1_investigation: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    qa_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    phase2_investigation: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    capa_required: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    final_qa_review: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>{label}</span>;
}

export function ResultStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      status === 'OOS' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    )}>{status}</span>
  );
}
