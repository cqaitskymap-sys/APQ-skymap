'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Plus, FileDown, ShieldCheck, Beaker, Settings, Wrench,
  Activity, TestTube, ClipboardCheck, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainItems = [
  { label: 'eBMR Dashboard', href: '/qms/ebmr', icon: LayoutDashboard, exact: true },
  { label: 'Create Batch Record', href: '/qms/ebmr/create', icon: Plus },
  { label: 'eBMR Reports', href: '/qms/ebmr/reports', icon: FileDown },
];

export function EbmrSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">eBMR</p>
        {mainItems.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

export function EbmrBatchSubNav({ batchId }: { batchId: string }) {
  const pathname = usePathname();
  const base = `/qms/ebmr/${batchId}`;
  const items = [
    { label: 'Overview', href: base, icon: LayoutDashboard, exact: true },
    { label: 'Line Clearance', href: `${base}/line-clearance`, icon: ShieldCheck },
    { label: 'Dispensing', href: `${base}/dispensing`, icon: Beaker },
    { label: 'Manufacturing', href: `${base}/manufacturing`, icon: Settings },
    { label: 'Equipment', href: `${base}/equipment`, icon: Wrench },
    { label: 'CPP Recording', href: `${base}/cpp`, icon: Activity },
    { label: 'IPC Checks', href: `${base}/ipc`, icon: TestTube },
    { label: 'Batch Review', href: `${base}/review`, icon: ClipboardCheck },
    { label: 'Batch Release', href: `${base}/release`, icon: CheckCircle },
  ];
  return (
    <nav className="overflow-x-auto">
      <div className="flex gap-1 min-w-max pb-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
                active ? 'bg-blue-600 text-white font-medium' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              <Icon className="h-3.5 w-3.5" />{item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function EbmrStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600', 'Line Clearance Pending': 'bg-amber-100 text-amber-800',
    'Dispensing Pending': 'bg-orange-100 text-orange-800', 'Manufacturing In Progress': 'bg-blue-100 text-blue-800',
    'IPC Pending': 'bg-purple-100 text-purple-800', 'QA Review': 'bg-indigo-100 text-indigo-800',
    Approved: 'bg-green-100 text-green-800', Released: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800', Hold: 'bg-amber-100 text-amber-800',
    Cancelled: 'bg-gray-100 text-gray-600', Compliant: 'bg-green-100 text-green-800',
    OOT: 'bg-red-100 text-red-800', Pass: 'bg-green-100 text-green-800', Failed: 'bg-red-100 text-red-800',
    Verified: 'bg-green-100 text-green-800', Pending: 'bg-amber-100 text-amber-800',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Draft)}>{status}</span>;
}
