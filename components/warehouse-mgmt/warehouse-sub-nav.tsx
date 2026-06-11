'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, PackagePlus, ShieldAlert, FlaskConical, CheckCircle, Beaker,
  Boxes, Package, GitBranch, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Warehouse Dashboard', href: '/qms/warehouse', icon: LayoutDashboard, exact: true },
  { label: 'Material Receipt', href: '/qms/warehouse/receipt', icon: PackagePlus },
  { label: 'Quarantine', href: '/qms/warehouse/quarantine', icon: ShieldAlert },
  { label: 'QC Sampling', href: '/qms/warehouse/sampling', icon: FlaskConical },
  { label: 'Material Release', href: '/qms/warehouse/release', icon: CheckCircle },
  { label: 'Material Dispensing', href: '/qms/warehouse/dispensing', icon: Beaker },
  { label: 'Inventory', href: '/qms/warehouse/inventory', icon: Boxes },
  { label: 'Finished Goods', href: '/qms/warehouse/finished-goods', icon: Package },
  { label: 'Traceability', href: '/qms/warehouse/traceability', icon: GitBranch },
  { label: 'Reports', href: '/qms/warehouse/reports', icon: FileDown },
];

export function WarehouseSubNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full lg:w-56 shrink-0">
      <div className="rounded-lg border bg-card p-2 space-y-0.5">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Warehouse Management</p>
        {items.map((item) => {
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

export function WarehouseStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Received: 'bg-blue-100 text-blue-800', Quarantine: 'bg-amber-100 text-amber-800',
    'Under Sampling': 'bg-purple-100 text-purple-800', 'Under Test': 'bg-orange-100 text-orange-800',
    Approved: 'bg-green-100 text-green-800', Released: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800', Blocked: 'bg-red-100 text-red-800',
    Expired: 'bg-gray-100 text-gray-600', Dispensed: 'bg-green-100 text-green-800',
    Valid: 'bg-green-100 text-green-800', 'Near Expiry': 'bg-amber-100 text-amber-800',
    'Retest Due': 'bg-orange-100 text-orange-800', Pending: 'bg-gray-100 text-gray-600',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Received)}>{status}</span>;
}
