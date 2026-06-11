'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, ListChecks, ClipboardCheck, Search, FileSignature, TrendingUp, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATIC_SEGMENTS = new Set(['master', 'avl', 'qualification', 'audit', 'technical-agreement', 'performance', 'reports']);

const items = [
  { label: 'Vendor Dashboard', href: '/qms/vendors', icon: LayoutDashboard, exact: true },
  { label: 'Vendor Master', href: '/qms/vendors/master', icon: Building2 },
  { label: 'Approved Vendor List', href: '/qms/vendors/avl', icon: ListChecks },
  { label: 'Vendor Qualification', href: '/qms/vendors/qualification', icon: ClipboardCheck },
  { label: 'Supplier Audit', href: '/qms/vendors/audit', icon: Search },
  { label: 'Technical Agreement', href: '/qms/vendors/technical-agreement', icon: FileSignature },
  { label: 'Vendor Performance', href: '/qms/vendors/performance', icon: TrendingUp },
  { label: 'Vendor Reports', href: '/qms/vendors/reports', icon: FileDown },
];

export function VendorSubNav() {
  const pathname = usePathname();
  const segment = pathname.match(/^\/qms\/vendors\/([^/]+)/)?.[1];
  const isDetailRoute = segment && !STATIC_SEGMENTS.has(segment);

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendor Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && !isDetailRoute;
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function ApprovalBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Not Qualified': 'bg-slate-100 text-slate-700', 'Under Qualification': 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800', 'Conditionally Approved': 'bg-blue-100 text-blue-800',
    Rejected: 'bg-red-100 text-red-800', Blocked: 'bg-red-100 text-red-800', Expired: 'bg-gray-100 text-gray-600',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors['Not Qualified'])}>{status}</span>;
}

export function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { Low: 'bg-green-100 text-green-800', Medium: 'bg-amber-100 text-amber-800', High: 'bg-orange-100 text-orange-800', Critical: 'bg-red-100 text-red-800' };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', colors[level] || colors.Medium)}>{level}</span>;
}

export function PerformanceBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = { Excellent: 'bg-green-100 text-green-800', Good: 'bg-blue-100 text-blue-800', Conditional: 'bg-amber-100 text-amber-800', Unsatisfactory: 'bg-red-100 text-red-800' };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[rating] || colors.Good)}>{rating}</span>;
}
