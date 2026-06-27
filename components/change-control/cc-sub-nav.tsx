'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, ClipboardCheck, AlertTriangle, Wrench, CheckCircle2, ShieldCheck, FileDown, History, Lock, FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Change Dashboard', href: '/qms/change-control', icon: LayoutDashboard, exact: true, alsoActive: '/qms/change-control/dashboard' },
  { label: 'Create Change', href: '/qms/change-control/create', icon: Plus },
  { label: 'Impact Assessment', href: '/qms/change-control/impact-assessment', icon: ClipboardCheck },
  { label: 'Risk Assessment', href: '/qms/change-control/risk-assessment', icon: AlertTriangle },
  { label: 'Validation Assessment', href: '/qms/change-control/validation-assessment', icon: FlaskConical },
  { label: 'Implementation Plan', href: '/qms/change-control/implementation', icon: Wrench },
  { label: 'Effectiveness Review', href: '/qms/change-control/effectiveness', icon: CheckCircle2 },
  { label: 'Approval Workflow', href: '/qms/change-control/approval', icon: ShieldCheck },
  { label: 'Closure', href: '/qms/change-control/closure', icon: Lock },
  { label: 'Reports', href: '/qms/change-control/reports', icon: FileDown },
  { label: 'Analytics', href: '/qms/change-control/analytics', icon: FileDown },
  { label: 'Audit Trail', href: '/qms/change-control/audit-trail', icon: History },
];

export function CcSubNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Change Control
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const base = item.href.split('?')[0];
          const alsoActive = 'alsoActive' in item ? item.alsoActive : undefined;
          const active = item.exact
            ? pathname === base || pathname === alsoActive
            : pathname.startsWith(base) && pathname !== '/qms/change-control' && pathname !== '/qms/change-control/dashboard';
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

export function CcStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    submitted: 'bg-blue-100 text-blue-800',
    under_qa_review: 'bg-indigo-100 text-indigo-800',
    impact_assessment: 'bg-cyan-100 text-cyan-800',
    risk_assessment: 'bg-violet-100 text-violet-800',
    approved_for_implementation: 'bg-teal-100 text-teal-800',
    implementation_in_progress: 'bg-purple-100 text-purple-800',
    implemented: 'bg-green-100 text-green-800',
    effectiveness_pending: 'bg-amber-100 text-amber-800',
    effectiveness_completed: 'bg-emerald-100 text-emerald-800',
    final_qa_review: 'bg-orange-100 text-orange-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-slate-200 text-slate-800',
    cancelled: 'bg-slate-100 text-slate-600',
    overdue: 'bg-red-100 text-red-800 animate-pulse',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>
      {label}
    </span>
  );
}

export function CcPriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Low: 'bg-blue-100 text-blue-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Urgent: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[priority] || colors.Medium)}>
      {priority}
    </span>
  );
}

export function CcCategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Minor: 'bg-green-100 text-green-800',
    Major: 'bg-amber-100 text-amber-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[category] || colors.Minor)}>
      {category}
    </span>
  );
}
