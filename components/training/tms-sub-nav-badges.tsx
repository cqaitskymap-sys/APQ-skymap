'use client';

import { cn } from '@/lib/utils';

export function TmsStatusBadge({ status }: { status: string }) {
  const normalized = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
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
    Approved: 'bg-green-100 text-green-800',
    'Auto-Generated': 'bg-indigo-100 text-indigo-800',
    Certified: 'bg-green-100 text-green-800',
    'Expiring Soon': 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors[normalized] || colors.pending)}>
      {normalized}
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
