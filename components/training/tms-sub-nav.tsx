'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Grid3X3, Calendar, ClipboardList, CheckCircle, Award, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/qms/training', icon: LayoutDashboard, exact: true },
  { label: 'Employee Training Matrix', href: '/qms/training/matrix', icon: Grid3X3 },
  { label: 'Training Schedule', href: '/qms/training/schedule', icon: Calendar },
  { label: 'Training Assignment', href: '/qms/training/assignments', icon: ClipboardList },
  { label: 'Training Effectiveness', href: '/qms/training/effectiveness', icon: CheckCircle },
  { label: 'Competency Assessment', href: '/qms/training/competency', icon: Award },
  { label: 'Training Reports', href: '/qms/training/reports', icon: FileDown },
];

export function TmsSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Training Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

export function TmsStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800 animate-pulse',
    failed: 'bg-red-100 text-red-800',
    retraining: 'bg-purple-100 text-purple-800',
    Active: 'bg-green-100 text-green-800',
    Inactive: 'bg-gray-100 text-gray-600',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.pending)}>
      {label}
    </span>
  );
}

export function EffectivenessBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    Effective: 'bg-green-100 text-green-800',
    'Partially Effective': 'bg-amber-100 text-amber-800',
    'Not Effective': 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[result] || colors.Effective)}>
      {result}
    </span>
  );
}

export function ComplianceBadge({ percent }: { percent: number }) {
  const color = percent >= 90 ? 'bg-green-100 text-green-800' : percent >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', color)}>{percent}%</span>;
}
