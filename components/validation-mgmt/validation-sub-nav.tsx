'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, FileCheck, Settings, PlayCircle, CheckSquare,
  FlaskConical, Sparkles, TestTube, Monitor, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusLabel } from '@/lib/validation-mgmt-types';

const STATIC_SEGMENTS = new Set([
  'vmp', 'dq', 'iq', 'oq', 'pq', 'process-validation', 'cleaning-validation',
  'method-validation', 'csv', 'reports',
]);

const items = [
  { label: 'Validation Dashboard', href: '/qms/validation', icon: LayoutDashboard, exact: true },
  { label: 'Validation Master Plan', href: '/qms/validation/vmp', icon: ClipboardList },
  { label: 'DQ', href: '/qms/validation/dq', icon: FileCheck },
  { label: 'IQ', href: '/qms/validation/iq', icon: Settings },
  { label: 'OQ', href: '/qms/validation/oq', icon: PlayCircle },
  { label: 'PQ', href: '/qms/validation/pq', icon: CheckSquare },
  { label: 'Process Validation', href: '/qms/validation/process-validation', icon: FlaskConical },
  { label: 'Cleaning Validation', href: '/qms/validation/cleaning-validation', icon: Sparkles },
  { label: 'Method Validation', href: '/qms/validation/method-validation', icon: TestTube },
  { label: 'CSV Validation', href: '/qms/validation/csv', icon: Monitor },
  { label: 'Validation Reports', href: '/qms/validation/reports', icon: FileDown },
];

export function ValidationSubNav() {
  const pathname = usePathname();
  const segment = pathname.match(/^\/qms\/validation\/([^/]+)/)?.[1];
  const isDetailRoute = segment && !STATIC_SEGMENTS.has(segment);

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validation Management</p>
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

export function ValidationStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700', 'Protocol Under Review': 'bg-amber-100 text-amber-800',
    'Protocol Approved': 'bg-blue-100 text-blue-800', 'Execution In Progress': 'bg-purple-100 text-purple-800',
    'Deviation Observed': 'bg-red-100 text-red-800', 'Report Under Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800', Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-gray-100 text-gray-600', 'Revalidation Due': 'bg-orange-100 text-orange-800',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Draft)}>{statusLabel(status)}</span>;
}

export function PassFailBadge({ result }: { result: string }) {
  const colors: Record<string, string> = { Pass: 'bg-green-100 text-green-800', Fail: 'bg-red-100 text-red-800', 'N/A': 'bg-gray-100 text-gray-600' };
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-bold', colors[result] || colors['N/A'])}>{result}</span>;
}
