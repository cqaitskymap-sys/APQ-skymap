'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, Library, ClipboardCheck, GitBranch,
  CheckCircle, Archive, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusLabel } from '@/lib/dms-types';

const items = [
  { label: 'DMS Dashboard', href: '/qms/dms', icon: LayoutDashboard, exact: true },
  { label: 'Create Document', href: '/qms/dms/create', icon: Plus },
  { label: 'Document Library', href: '/qms/dms/library', icon: Library },
  { label: 'Review & Approval', href: '/qms/dms/review', icon: ClipboardCheck },
  { label: 'Revision Control', href: '/qms/dms/revisions', icon: GitBranch },
  { label: 'Effective Documents', href: '/qms/dms/effective', icon: CheckCircle },
  { label: 'Obsolete Documents', href: '/qms/dms/obsolete', icon: Archive },
  { label: 'Reports', href: '/qms/dms/reports', icon: FileDown },
];

const STATIC_SEGMENTS = new Set(['create', 'library', 'review', 'revisions', 'effective', 'obsolete', 'reports']);

export function DmsSubNav() {
  const pathname = usePathname();
  const segment = pathname.match(/^\/qms\/dms\/([^/]+)/)?.[1];
  const isDetailRoute = segment && !STATIC_SEGMENTS.has(segment);

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Management</p>
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

export function DmsStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    under_review: 'bg-amber-100 text-amber-800',
    returned_for_correction: 'bg-orange-100 text-orange-800',
    approved: 'bg-blue-100 text-blue-800',
    effective: 'bg-green-100 text-green-800',
    obsolete: 'bg-gray-100 text-gray-600',
    archived: 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>
      {statusLabel(status)}
    </span>
  );
}

export function DmsTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700">
      {type}
    </span>
  );
}
