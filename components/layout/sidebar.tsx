'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, FlaskConical, Package, AlertTriangle, TestTube, CheckSquare,
  RefreshCw, LineChart, Cog, BookOpen, Users, FileText, TruckIcon, ShieldCheck,
  Bell, Brain, ClipboardList, BarChart3, ChevronDown, ChevronRight, PanelLeftClose,
  PanelLeftOpen, LogOut, Settings, UserCircle, PackageSearch, Beaker, Award,
  AlertCircle, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  badge?: number;
  badgeVariant?: 'default' | 'destructive' | 'warning';
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Quality Management', icon: ShieldCheck,
    children: [
      { label: 'Deviations', href: '/dashboard/deviations', icon: AlertTriangle, badge: 12, badgeVariant: 'warning' },
      { label: 'OOS Records', href: '/dashboard/oos', icon: TestTube, badge: 5, badgeVariant: 'destructive' },
      { label: 'CAPA Management', href: '/dashboard/capa', icon: CheckSquare, badge: 18 },
      { label: 'Change Control', href: '/dashboard/change-control', icon: RefreshCw },
      { label: 'Complaints', href: '/dashboard/complaints', icon: AlertCircle, badge: 7, badgeVariant: 'warning' },
    ]
  },
  {
    label: 'Manufacturing', icon: Building2,
    children: [
      { label: 'Batch Management', href: '/dashboard/batches', icon: Package },
      { label: 'Product Master', href: '/dashboard/products', icon: FlaskConical },
    ]
  },
  {
    label: 'Product Quality', icon: BarChart3,
    children: [
      { label: 'PQR Management', href: '/dashboard/pqr', icon: ClipboardList },
      { label: 'Packaging Review', href: '/dashboard/packaging', icon: PackageSearch },
      { label: 'Stability Studies', href: '/dashboard/stability', icon: LineChart },
    ]
  },
  {
    label: 'Regulatory & Compliance', icon: Award,
    children: [
      { label: 'Audit Trail', href: '/dashboard/audit-trail', icon: FileText },
      { label: 'Document Management', href: '/dashboard/documents', icon: BookOpen },
      { label: 'Training Records', href: '/dashboard/training', icon: Users },
    ]
  },
  {
    label: 'Operations', icon: Cog,
    children: [
      { label: 'Equipment Qualification', href: '/dashboard/equipment', icon: Beaker },
      { label: 'Vendor Management', href: '/dashboard/vendors', icon: TruckIcon },
      { label: 'Warehouse Traceability', href: '/dashboard/warehouse', icon: PackageSearch },
    ]
  },
  { label: 'AI Analytics', href: '/dashboard/ai-analytics', icon: Brain, badge: 4, badgeVariant: 'default' },
  {
    label: 'Master Data', icon: Settings,
    children: [
      { label: 'Product Master', href: '/dashboard/master/product', icon: FlaskConical },
      { label: 'Material Master', href: '/dashboard/master/materials', icon: Beaker },
      { label: 'Vendor Master', href: '/dashboard/master/vendors', icon: TruckIcon },
      { label: 'Abbreviations', href: '/dashboard/master/abbreviations', icon: BookOpen },
    ]
  },
  { label: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'User Management', href: '/dashboard/users', icon: UserCircle },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: 9, badgeVariant: 'destructive' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<string[]>(['Quality Management', 'Manufacturing', 'Product Quality']);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );
  };

  const isActive = (href?: string) => href ? pathname === href || pathname.startsWith(href + '/') : false;

  const BadgeEl = ({ item }: { item: NavItem }) => {
    if (!item.badge) return null;
    return (
      <span className={cn(
        'ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
        item.badgeVariant === 'destructive' ? 'bg-red-500/20 text-red-400' :
        item.badgeVariant === 'warning' ? 'bg-amber-500/20 text-amber-400' :
        'bg-blue-500/20 text-blue-400'
      )}>
        {item.badge}
      </span>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'h-screen flex flex-col sidebar-bg border-r transition-all duration-300 ease-in-out flex-shrink-0',
        'border-r',
        collapsed ? 'w-[64px]' : 'w-[260px]'
      )} style={{ borderColor: 'hsl(var(--sidebar-border))' }}>

        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b px-4 flex-shrink-0',
        )} style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <div className="flex items-center gap-2.5 flex-shrink-0 w-full">
            <div className="relative w-8 h-8 flex-shrink-0">
              <Image
                src="/logo-1.png"
                alt="Skymap Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <span className="text-white font-bold text-sm leading-tight block">SKYMAP</span>
                <span className="text-xs leading-tight block text-blue-300">Pharmaceuticals</span>
              </div>
            )}
            <button
              onClick={onToggle}
              className="ml-auto text-slate-400 hover:text-white transition-colors p-1 rounded"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            if (item.children) {
              const isOpen = openGroups.includes(item.label);
              const hasActiveChild = item.children.some(c => isActive(c.href));

              if (collapsed) {
                return (
                  <div key={item.label} className="mb-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          'w-9 h-9 mx-auto flex items-center justify-center rounded-lg cursor-pointer transition-colors',
                          hasActiveChild ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-slate-700 text-white border-slate-600">
                        <p className="font-medium">{item.label}</p>
                        <div className="mt-1 space-y-0.5">
                          {item.children.map(child => (
                            <Link key={child.href} href={child.href!} className="flex items-center gap-2 px-2 py-1 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-600">
                              <child.icon className="h-3 w-3" />
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              }

              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      hasActiveChild
                        ? 'text-blue-400 bg-blue-600/10'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href!}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                            isActive(child.href)
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                              : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="flex-1">{child.label}</span>
                          <BadgeEl item={child} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href!}
                      className={cn(
                        'w-9 h-9 mx-auto flex items-center justify-center rounded-lg transition-colors relative',
                        isActive(item.href) ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-700 text-white border-slate-600">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  isActive(item.href)
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 font-medium">{item.label}</span>
                <BadgeEl item={item} />
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className={cn(
          'border-t p-3 flex-shrink-0',
        )} style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-9 h-9 mx-auto bg-blue-600/20 rounded-lg flex items-center justify-center cursor-pointer">
                  <UserCircle className="h-5 w-5 text-blue-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-700 text-white border-slate-600">
                <p className="font-medium">{profile?.full_name || 'Demo User'}</p>
                <p className="text-slate-400 text-xs capitalize">{profile?.role || 'super_admin'}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <UserCircle className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'Demo User'}</p>
                <p className="text-xs capitalize truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>
                  {profile?.role?.replace('_', ' ') || 'Super Admin'}
                </p>
              </div>
              <button
                onClick={signOut}
                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
