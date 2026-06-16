'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, FlaskConical, Factory, Link2, CheckCircle, FileDown, Microscope, ShieldAlert, Lock, TrendingUp, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/qms/oos', icon: LayoutDashboard, exact: true, alsoMatch: '/qms/oos/dashboard' },
  { label: 'Create OOS', href: '/qms/oos/create', icon: Plus, alsoMatch: '/qms/oos/new' },
  { label: 'Phase-I Investigation', href: '/qms/oos/phase1', icon: Microscope },
  { label: 'Phase-II Investigation', href: '/qms/oos/phase2', icon: Factory },
  { label: 'Impact Assessment', href: '/qms/oos/impact-assessment', icon: ShieldAlert },
  { label: 'CAPA Management', href: '/qms/oos/capa-management', icon: Link2 },
  { label: 'Approval Workflow', href: '/qms/oos/approval', icon: CheckCircle, alsoMatch: '/qms/oos/approval' },
  { label: 'OOS Closure', href: '/qms/oos/closure', icon: Lock, alsoMatch: '/qms/oos/closure' },
  { label: 'Trend Analysis', href: '/qms/oos/trend-analysis', icon: TrendingUp, alsoMatch: '/qms/oos/trends' },
  { label: 'Reports', href: '/qms/oos/reports', icon: FileDown, alsoMatch: '/qms/oos/analytics' },
  { label: 'Audit Trail', href: '/qms/oos/audit-trail', icon: History },
];

export function OosSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">OOS Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const hrefBase = item.href.split('?')[0];
          const alsoMatch = 'alsoMatch' in item ? (item as { alsoMatch?: string }).alsoMatch : undefined;
          const active = item.exact
            ? pathname === hrefBase || pathname === alsoMatch
            : (pathname.startsWith(hrefBase) || pathname === alsoMatch) && item.href !== '/qms/oos';
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
    phase1_investigation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    qa_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    phase2_investigation: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    capa_required: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    final_qa_review: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    closed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>{label}</span>;
}

export function ResultStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OOS: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    Pass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Under Review': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'Confirmed OOS': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'Invalid OOS': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      colors[status] || colors.Pass,
    )}>{status}</span>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-100 text-red-800 border-red-200'
    : level === 'High' ? 'bg-orange-100 text-orange-800 border-orange-200'
      : level === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', cls)}>{level}</span>;
}
