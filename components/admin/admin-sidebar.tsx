'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Shield, Building2, BadgeCheck, Factory,
  FlaskConical, Package, SlidersHorizontal, GitBranch, CheckSquare, Hash,
  FileSearch, PenLine, Bell, Database, Settings, PanelLeftClose,
  PanelLeftOpen, ChevronRight, ShieldCheck, LogIn, UserCheck, KeyRound,
  Mail, Blocks, FileUp, HardDrive, Cloud, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_NAV_ITEMS } from '@/lib/admin/constants';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, Shield, Building2, BadgeCheck, Factory,
  FlaskConical, Package, SlidersHorizontal, GitBranch, CheckSquare, Hash,
  FileSearch, PenLine, Bell, Database, Settings, LogIn, UserCheck, KeyRound,
  Mail, Blocks, FileUp, HardDrive, Cloud, Activity,
};

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const { role, canManageRoles, isReadOnly } = useAdminPermissions();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin' || pathname === '/dashboard/admin';
    }
    if (href === '/admin/users') {
      return pathname.startsWith('/admin/users') || pathname.startsWith('/dashboard/admin/users');
    }
    if (href === '/admin/roles') {
      return pathname.startsWith('/admin/roles') || pathname.startsWith('/dashboard/admin/roles');
    }
    if (href === '/admin/departments') {
      return pathname.startsWith('/admin/departments') || pathname.startsWith('/dashboard/admin/departments');
    }
    if (href === '/admin/designations') {
      return pathname.startsWith('/admin/designations') || pathname.startsWith('/dashboard/admin/designations');
    }
    if (href === '/admin/company-site') {
      return pathname.startsWith('/admin/company-site') || pathname.startsWith('/dashboard/admin/company-sites');
    }
    if (href === '/admin/products') {
      return pathname.startsWith('/admin/products') || pathname.startsWith('/dashboard/admin/products');
    }
    if (href === '/admin/batches') {
      return pathname.startsWith('/admin/batches') || pathname.startsWith('/dashboard/admin/batches');
    }
    if (href === '/admin/parameters') {
      return pathname.startsWith('/admin/parameters') || pathname.startsWith('/dashboard/admin/parameters');
    }
    if (href === '/admin/workflows') {
      return pathname.startsWith('/admin/workflows') || pathname.startsWith('/dashboard/admin/workflows');
    }
    if (href === '/admin/approval-matrix') {
      return pathname.startsWith('/admin/approval-matrix') || pathname.startsWith('/dashboard/admin/approval-matrix');
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const filteredNav = ADMIN_NAV_ITEMS.filter((item) => {
    if (item.href.includes('/roles') && !canManageRoles) return false;
    if (item.href.includes('/system-settings') && !canManageRoles) return false;
    if (item.href.includes('/password-policy') && !canManageRoles) return false;
    if (item.href.includes('/backup') && isReadOnly) return false;
    if (item.href.includes('/data-backup-log') && isReadOnly) return false;
    return true;
  });

  return (
    <aside
      className={cn(
        'h-full flex flex-col border-r bg-slate-50 dark:bg-slate-950 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[280px]'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b bg-white dark:bg-slate-900">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Admin Panel</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pharma QMS</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="shrink-0">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b">
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            {role.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {filteredNav.map((item) => {
          const Icon = ICON_MAP[item.icon] || Settings;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active && 'text-white')} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {active && <ChevronRight className="h-3 w-3 opacity-70" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t text-xs text-muted-foreground">
          <p>21 CFR Part 11 Compliant</p>
          <p className="mt-1">GxP Validated System</p>
        </div>
      )}
    </aside>
  );
}
