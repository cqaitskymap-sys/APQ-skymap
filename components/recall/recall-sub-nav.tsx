'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Plus, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Recall Dashboard', href: '/qms/recall', icon: LayoutDashboard, exact: true },
  { label: 'Initiate Recall', href: '/qms/recall/create', icon: Plus },
  { label: 'Reports', href: '/qms/recall/reports', icon: FileDown },
];

export function RecallSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Recall</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && pathname !== '/qms/recall';
          return (
            <Link key={item.href} href={item.href} className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors', active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function RecallStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700', initiated: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800', regulatory_notified: 'bg-indigo-100 text-indigo-800',
    recovery_in_progress: 'bg-purple-100 text-purple-800', completed: 'bg-green-100 text-green-800', closed: 'bg-slate-200 text-slate-800',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>{status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>;
}

export function ClassificationBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { 'Class I': 'bg-red-100 text-red-800', 'Class II': 'bg-orange-100 text-orange-800', 'Class III': 'bg-amber-100 text-amber-800', Mock: 'bg-blue-100 text-blue-800' };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[value] || colors['Class II'])}>{value}</span>;
}
