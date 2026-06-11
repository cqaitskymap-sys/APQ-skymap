'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Plus, ClipboardList, AlertTriangle, Link2, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusLabel } from '@/lib/audit-mgmt-types';

const STATIC_SEGMENTS = new Set(['planner', 'create', 'checklist', 'findings', 'capa', 'reports']);

const items = [
  { label: 'Audit Dashboard', href: '/qms/audit', icon: LayoutDashboard, exact: true },
  { label: 'Audit Planner', href: '/qms/audit/planner', icon: Calendar },
  { label: 'Create Audit', href: '/qms/audit/create', icon: Plus },
  { label: 'Audit Checklist', href: '/qms/audit/checklist', icon: ClipboardList },
  { label: 'Audit Findings', href: '/qms/audit/findings', icon: AlertTriangle },
  { label: 'Audit CAPA', href: '/qms/audit/capa', icon: Link2 },
  { label: 'Audit Reports', href: '/qms/audit/reports', icon: FileDown },
];

export function AuditSubNav() {
  const pathname = usePathname();
  const segment = pathname.match(/^\/qms\/audit\/([^/]+)/)?.[1];
  const isDetailRoute = segment && !STATIC_SEGMENTS.has(segment);

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && !isDetailRoute;
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AuditStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700', scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800', completed: 'bg-green-100 text-green-800',
    report_drafted: 'bg-indigo-100 text-indigo-800', capa_required: 'bg-orange-100 text-orange-800',
    capa_in_progress: 'bg-purple-100 text-purple-800', closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-600', overdue: 'bg-red-100 text-red-800 animate-pulse',
    open: 'bg-amber-100 text-amber-800', under_review: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.planned)}>
      {statusLabel(status)}
    </span>
  );
}

export function FindingTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800', Major: 'bg-orange-100 text-orange-800',
    Minor: 'bg-amber-100 text-amber-800', Observation: 'bg-blue-100 text-blue-800',
    'Opportunity for Improvement': 'bg-green-100 text-green-800',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[type] || colors.Minor)}>{type}</span>;
}

export function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Low: 'bg-green-100 text-green-800', Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800', Critical: 'bg-red-100 text-red-800',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', colors[level] || colors.Low)}>{level}</span>;
}

export function ComplianceBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Compliant: 'bg-green-100 text-green-800', 'Partially Compliant': 'bg-amber-100 text-amber-800',
    'Non-Compliant': 'bg-red-100 text-red-800', 'Not Applicable': 'bg-gray-100 text-gray-600',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Compliant)}>{status}</span>;
}
