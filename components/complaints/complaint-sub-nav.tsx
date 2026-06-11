'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Plus, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Complaint Dashboard', href: '/qms/complaints', icon: LayoutDashboard, exact: true },
  { label: 'Register Complaint', href: '/qms/complaints/create', icon: Plus },
  { label: 'Reports', href: '/qms/complaints/reports', icon: FileDown },
];

export function ComplaintSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Complaint Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href) && pathname !== '/qms/complaints';
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

export function ComplaintStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700', received: 'bg-blue-100 text-blue-800',
    under_investigation: 'bg-amber-100 text-amber-800', qa_review: 'bg-orange-100 text-orange-800',
    capa_required: 'bg-purple-100 text-purple-800', closed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800', overdue: 'bg-red-100 text-red-800 animate-pulse',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>{status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>;
}

export function CriticalityBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Minor: 'bg-green-100 text-green-800', Major: 'bg-amber-100 text-amber-800', Critical: 'bg-red-100 text-red-800' };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[value] || colors.Minor)}>{value}</span>;
}
