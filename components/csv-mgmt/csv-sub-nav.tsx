'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Server, ShieldCheck, AlertTriangle, FileText, Code, PenTool,
  Settings, PlayCircle, CheckSquare, Grid3X3, Lock, FileDown, Calendar, Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATIC_SEGMENTS = new Set([
  'systems', 'gxp-assessment', 'risk-assessment', 'urs', 'frs', 'design-specification',
  'iq', 'oq', 'pq', 'traceability-matrix', 'part11', 'validation-report', 'periodic-review',
]);

const items = [
  { label: 'CSV Dashboard', href: '/qms/csv', icon: LayoutDashboard, exact: true },
  { label: 'System Inventory', href: '/qms/csv/systems', icon: Server },
  { label: 'GxP Assessment', href: '/qms/csv/gxp-assessment', icon: ShieldCheck },
  { label: 'Risk Assessment', href: '/qms/csv/risk-assessment', icon: AlertTriangle },
  { label: 'URS', href: '/qms/csv/urs', icon: FileText },
  { label: 'FRS', href: '/qms/csv/frs', icon: Code },
  { label: 'Design Specification', href: '/qms/csv/design-specification', icon: PenTool },
  { label: 'IQ', href: '/qms/csv/iq', icon: Settings },
  { label: 'OQ', href: '/qms/csv/oq', icon: PlayCircle },
  { label: 'PQ', href: '/qms/csv/pq', icon: CheckSquare },
  { label: 'Traceability Matrix', href: '/qms/csv/traceability-matrix', icon: Grid3X3 },
  { label: 'Part 11 Assessment', href: '/qms/csv/part11', icon: Lock },
  { label: 'Validation Report', href: '/qms/csv/validation-report', icon: FileDown },
  { label: 'Periodic Review', href: '/qms/csv/periodic-review', icon: Calendar },
];

export function CsvSubNav() {
  const pathname = usePathname();
  const segment = pathname.match(/^\/qms\/csv\/([^/]+)/)?.[1];
  const isDetailRoute = segment && !STATIC_SEGMENTS.has(segment);

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card">CSV Management</p>
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

export function CsvStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700', 'Under Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800', 'In Execution': 'bg-purple-100 text-purple-800',
    'Deviation Observed': 'bg-red-100 text-red-800', Completed: 'bg-green-100 text-green-800',
    Validated: 'bg-green-100 text-green-800', Rejected: 'bg-red-100 text-red-800', Retired: 'bg-gray-100 text-gray-600',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Draft)}>{status}</span>;
}

export function PassFailBadge({ result }: { result: string }) {
  const colors: Record<string, string> = { Pass: 'bg-green-100 text-green-800', Fail: 'bg-red-100 text-red-800', 'N/A': 'bg-gray-100 text-gray-600' };
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-bold', colors[result] || colors['N/A'])}>{result}</span>;
}

export function GxpBadge({ critical }: { critical: boolean }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', critical ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600')}>{critical ? 'GxP' : 'Non-GxP'}</span>;
}
