'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, History, ShieldAlert, FileBarChart, Lock, CheckCircle2, Activity, ShieldCheck, ClipboardList, PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/qms/risk-management', icon: LayoutDashboard, matchPaths: ['/qms/risk-management', '/qms/risk-management/dashboard'] },
  { label: 'Create Risk', href: '/qms/risk-management/create', icon: PlusCircle, matchPaths: ['/qms/risk-management/create', '/qms/risk-management/new'] },
  { label: 'Audit Trail', href: '/qms/risk-management/audit-trail', icon: History },
  { label: 'Reports & Analytics', href: '/qms/risk-management/reports', icon: FileBarChart, matchPaths: ['/qms/risk-management/reports', '/qms/risk-management/analytics'] },
  { label: 'FMEA Assessment', href: '/qms/risk-management/fmea', icon: ClipboardList, matchPaths: ['/qms/risk-management/fmea'] },
  { label: 'Approval Workflow', href: '/qms/risk-management/approval', icon: CheckCircle2, matchPaths: ['/qms/risk-management/approval'] },
  { label: 'Mitigation Plan', href: '/qms/risk-management/mitigation', icon: ShieldCheck, matchPaths: ['/qms/risk-management/mitigation'] },
  { label: 'Review & Monitoring', href: '/qms/risk-management/review-monitoring', icon: Activity, matchPaths: ['/qms/risk-management/review-monitoring', '/qms/risk-management/risk-review'] },
  { label: 'Closure', href: '/qms/risk-management/closure', icon: Lock, matchPaths: ['/qms/risk-management/closure'] },
  { label: 'CPV Risk Assessment', href: '/cpv/risk-assessment', icon: ShieldAlert },
];

export function RiskSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const matchPaths = 'matchPaths' in item && item.matchPaths ? item.matchPaths : [item.href];
          const active = item.href === '/qms/risk-management'
            ? pathname === '/qms/risk-management' || pathname === '/qms/risk-management/dashboard'
            : item.href === '/qms/risk-management/create'
            ? pathname === item.href || pathname === '/qms/risk-management/new'
            : item.href === '/qms/risk-management/audit-trail'
            ? pathname === item.href || pathname.includes('/audit-trail')
            : item.href === '/qms/risk-management/closure'
              ? pathname === item.href || pathname.includes('/closure')
              : item.href === '/qms/risk-management/approval'
                ? pathname === item.href || pathname.includes('/approval')
                : item.href === '/qms/risk-management/fmea'
                  ? pathname === item.href || pathname.includes('/fmea')
                : item.href === '/qms/risk-management/mitigation'
                  ? pathname === item.href || pathname.includes('/mitigation') || pathname.includes('/mitigation-plan')
                : item.href === '/qms/risk-management/review-monitoring'
                  ? pathname === item.href || pathname.includes('/review-monitoring') || pathname.includes('/risk-review')
                  : matchPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
