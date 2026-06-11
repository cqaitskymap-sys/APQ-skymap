'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MapPin, Thermometer, Droplets, AlertTriangle, TrendingUp, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATIC_SEGMENTS = new Set([
  'area-master', 'environmental', 'utility', 'excursions', 'trends', 'reports',
]);

const items = [
  { label: 'Monitoring Dashboard', href: '/qms/monitoring', icon: LayoutDashboard, exact: true },
  { label: 'Area Master', href: '/qms/monitoring/area-master', icon: MapPin },
  { label: 'Environmental Monitoring', href: '/qms/monitoring/environmental', icon: Thermometer },
  { label: 'Utility Monitoring', href: '/qms/monitoring/utility', icon: Droplets },
  { label: 'Alert & Excursion', href: '/qms/monitoring/excursions', icon: AlertTriangle },
  { label: 'Trend Analysis', href: '/qms/monitoring/trends', icon: TrendingUp },
  { label: 'Reports', href: '/qms/monitoring/reports', icon: FileDown },
];

export function MonitoringSubNav() {
  const pathname = usePathname();
  const segment = pathname.match(/^\/qms\/monitoring\/([^/]+)/)?.[1];
  const isDetailRoute = segment && !STATIC_SEGMENTS.has(segment);

  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Environmental & Utility</p>
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

export function MonitoringStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Complies: 'bg-green-100 text-green-800', Alert: 'bg-amber-100 text-amber-800',
    Action: 'bg-orange-100 text-orange-800', Excursion: 'bg-red-100 text-red-800',
    'Under Review': 'bg-purple-100 text-purple-800', Closed: 'bg-gray-100 text-gray-600',
    Open: 'bg-red-100 text-red-800', Active: 'bg-green-100 text-green-800',
    Inactive: 'bg-gray-100 text-gray-600',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Complies)}>{status}</span>;
}

export function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    'Grade A': 'bg-red-100 text-red-800', 'Grade B': 'bg-orange-100 text-orange-800',
    'Grade C': 'bg-amber-100 text-amber-800', 'Grade D': 'bg-yellow-100 text-yellow-800',
    'Controlled Area': 'bg-blue-100 text-blue-800', Unclassified: 'bg-gray-100 text-gray-600',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[grade] || colors.Unclassified)}>{grade}</span>;
}
