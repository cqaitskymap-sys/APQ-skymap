'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Plus, FileDown, Search, Scale, Link2, CheckSquare, Lock, TrendingUp, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Complaint Dashboard', href: '/qms/complaints', icon: LayoutDashboard, match: ['/qms/complaints', '/qms/complaints/dashboard'] },
  { label: 'Investigations', href: '/qms/complaints/investigation', icon: Search, match: ['/qms/complaints/investigation'] },
  { label: 'Impact Assessment', href: '/qms/complaints/impact-assessment', icon: Scale, match: ['/qms/complaints/impact-assessment'] },
  { label: 'CAPA Link', href: '/qms/complaints/capa-link', icon: Link2, match: ['/qms/complaints/capa-link'] },
  { label: 'Approval', href: '/qms/complaints/approval', icon: CheckSquare, match: ['/qms/complaints/approval'] },
  { label: 'Closure', href: '/qms/complaints/closure', icon: Lock, match: ['/qms/complaints/closure'] },
  { label: 'Trend Analysis', href: '/qms/complaints/trend-analysis', icon: TrendingUp, match: ['/qms/complaints/trend-analysis', '/qms/complaints/trends'] },
  { label: 'Register Complaint', href: '/qms/complaints/create', icon: Plus, match: ['/qms/complaints/create', '/qms/complaints/new'] },
  { label: 'Reports & Analytics', href: '/qms/complaints/reports', icon: FileDown, match: ['/qms/complaints/reports', '/qms/complaints/analytics'] },
  { label: 'Audit Trail', href: '/qms/complaints/audit-trail', icon: ScrollText, match: ['/qms/complaints/audit-trail'] },
];

export function ComplaintSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Complaint Management</p>
        {items.map((item) => {
          const Icon = item.icon;
          const auditTrailActive = item.href === '/qms/complaints/audit-trail'
            && /\/qms\/complaints(\/[^/]+)?\/audit-trail$/.test(pathname);
          const active = auditTrailActive || (item.match
            ? item.match.some((p) => pathname === p)
            : pathname.startsWith(item.href) && !['/qms/complaints', '/qms/complaints/dashboard'].includes(pathname));
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
    capa_required: 'bg-purple-100 text-purple-800', recall_evaluation: 'bg-red-100 text-red-800',
    closed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800', overdue: 'bg-red-100 text-red-800 animate-pulse',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.draft)}>{status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>;
}

export function CriticalityBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Minor: 'bg-green-100 text-green-800', Major: 'bg-amber-100 text-amber-800', Critical: 'bg-red-100 text-red-800' };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[value] || colors.Minor)}>{value}</span>;
}

export function RiskBadge({ level }: { level?: string | null }) {
  const colors: Record<string, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  const key = level || 'Low';
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[key] || colors.Low)}>{key}</span>;
}
