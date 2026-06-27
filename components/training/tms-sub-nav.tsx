'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Grid3X3, ClipboardList, CheckCircle, Award, FileDown,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/qms/training', icon: LayoutDashboard, matchPaths: ['/qms/training', '/qms/training/dashboard'] },
  { label: 'Training Matrix', href: '/qms/training/matrix', icon: Grid3X3, matchPaths: ['/qms/training/matrix', '/qms/training/training-matrix'] },
  { label: 'Assignment & Scheduling', href: '/qms/training/assignments', icon: ClipboardList, matchPaths: ['/qms/training/assignments', '/qms/training/scheduling', '/qms/training/schedule'] },
  { label: 'Completion & Attendance', href: '/qms/training/completion', icon: UserCheck, matchPaths: ['/qms/training/completion', '/qms/training/attendance'] },
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
          const matchPaths = 'matchPaths' in item && item.matchPaths ? item.matchPaths : [item.href];
          const active = matchPaths.some((p) => {
            if (p === '/qms/training') return pathname === '/qms/training' || pathname === '/qms/training/dashboard';
            return pathname === p || pathname.startsWith(`${p}/`);
          });
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
  const normalized = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    Assigned: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    Completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800 animate-pulse',
    Overdue: 'bg-red-100 text-red-800 animate-pulse',
    failed: 'bg-red-100 text-red-800',
    retraining: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-slate-100 text-slate-600',
    Cancelled: 'bg-slate-100 text-slate-600',
    'Effectiveness Pending': 'bg-purple-100 text-purple-800',
    Effective: 'bg-green-100 text-green-800',
    'Not Effective': 'bg-red-100 text-red-800',
    Draft: 'bg-gray-100 text-gray-600',
    Pending: 'bg-amber-100 text-amber-800',
    Active: 'bg-green-100 text-green-800',
    Inactive: 'bg-gray-100 text-gray-600',
  };
  const label = normalized;
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors[normalized] || colors.pending)}>
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

export function AttendanceBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Present: 'bg-green-100 text-green-800',
    Absent: 'bg-red-100 text-red-800',
    Late: 'bg-amber-100 text-amber-800',
    Excused: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || 'bg-gray-100 text-gray-600')}>
      {status}
    </span>
  );
}

export function CompletionBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Not Started': 'bg-gray-100 text-gray-600',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
    Cancelled: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors['In Progress'])}>
      {status}
    </span>
  );
}

export function ResultBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    Pass: 'bg-green-100 text-green-800',
    Fail: 'bg-red-100 text-red-800',
    'Not Applicable': 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[result] || colors['Not Applicable'])}>
      {result}
    </span>
  );
}
