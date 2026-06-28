'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, FlaskConical, Package, AlertTriangle, TestTube, CheckSquare,
  RefreshCw, LineChart, Cog, BookOpen, Users, FileText, TruckIcon, ShieldCheck,
  ClipboardCheck,
  Bell, Brain, ClipboardList, BarChart3, ChevronDown, ChevronRight, PanelLeftClose,
  PanelLeftOpen, LogOut, Settings, UserCircle, PackageSearch, Beaker, Award,
  AlertCircle, Building2, Activity,   Hash, GitBranch, PenLine, Database, SlidersHorizontal,
  BadgeCheck, Factory, FileSearch, Plus, CheckCircle, FileDown, Search, Link2, Microscope, Calendar, MessageSquare, RotateCcw, Library, Grid3X3, ListChecks, FileSignature, TrendingUp, FileCheck, PlayCircle, Monitor, Sparkles, Server, Code, PenTool, Lock, Wrench, MapPin, Thermometer, Droplets, PackagePlus, ShieldAlert, Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/usePermissions';
import { navHrefModule } from '@/lib/nav-permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  badge?: number;
  badgeVariant?: 'default' | 'destructive' | 'warning';
  children?: NavItem[];
  matchPrefix?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Admin',
    icon: ShieldCheck,
    matchPrefix: '/admin',
    children: [
      { label: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'User Management', href: '/admin/users', icon: Users },
      { label: 'Role & Permission', href: '/admin/roles', icon: ShieldCheck },
      { label: 'Department Master', href: '/admin/departments', icon: Building2 },
      { label: 'Designation Master', href: '/admin/designations', icon: BadgeCheck },
      { label: 'Company / Site Master', href: '/admin/company-site', icon: Factory },
      { label: 'Product Master', href: '/admin/products', icon: FlaskConical },
      { label: 'Parameter Master', href: '/admin/parameters', icon: SlidersHorizontal },
      { label: 'Workflow Configuration', href: '/admin/workflows', icon: GitBranch },
      { label: 'Approval Matrix', href: '/admin/approval-matrix', icon: CheckSquare },
      { label: 'Document Numbering', href: '/admin/document-numbering', icon: Hash },
      { label: 'Audit Trail', href: '/admin/audit-trail', icon: FileSearch },
      { label: 'E-Signature Settings', href: '/admin/esign-settings', icon: PenLine },
      { label: 'Notification Settings', href: '/admin/notifications', icon: Bell },
      { label: 'Backup & Restore', href: '/admin/backup', icon: Database },
      { label: 'System Settings', href: '/admin/system-settings', icon: Settings },
    ],
  },
  {
    label: 'Continued Process Verification',
    icon: LineChart,
    matchPrefix: '/cpv',
    children: [
      { label: 'CPV Dashboard', href: '/cpv/dashboard', icon: LayoutDashboard },
      { label: 'Product Master', href: '/cpv/product-master', icon: FlaskConical },
      { label: 'Batch Registration', href: '/cpv/batch-registration', icon: Package },
      { label: 'CPP Monitoring', href: '/cpv/cpp', icon: Activity },
      { label: 'CQA Monitoring', href: '/cpv/cqa', icon: TestTube },
      { label: 'Raw Material Monitoring', href: '/cpv/raw-material-monitoring', icon: Beaker },
      { label: 'Packing Material Monitoring', href: '/cpv/packing-material-monitoring', icon: PackageSearch },
      { label: 'Utility Monitoring', href: '/cpv/utility-monitoring', icon: Droplets },
      { label: 'Environmental Monitoring', href: '/cpv/environmental-monitoring', icon: Thermometer },
      { label: 'Yield Monitoring', href: '/cpv/yield-monitoring', icon: TrendingUp },
      { label: 'Stability Monitoring', href: '/cpv/stability-monitoring', icon: Microscope },
      { label: 'Hold Time Monitoring', href: '/cpv/hold-time-monitoring', icon: Calendar },
      { label: 'Process Capability', href: '/cpv/process-capability', icon: BarChart3 },
      { label: 'Trend Analysis', href: '/cpv/trend-analysis', icon: LineChart },
      { label: 'Control Charts', href: '/cpv/control-charts', icon: BarChart3 },
      { label: 'Risk Assessment', href: '/cpv/risk-assessment', icon: ShieldCheck },
      { label: 'Annual CPV Review', href: '/cpv/annual-review', icon: FileText },
      { label: 'Reports & Analytics', href: '/cpv/reports-analytics', icon: FileDown },
      { label: 'Alert Engine', href: '/cpv/alert-engine', icon: Bell },
      { label: 'CPV Configuration', href: '/cpv/configuration', icon: Settings },
      { label: 'AI Analytics', href: '/cpv/ai-analytics', icon: Brain },
    ],
  },
  {
    label: 'PQR Management',
    icon: ClipboardList,
    matchPrefix: '/pqr',
    children: [
      { label: 'PQR Dashboard', href: '/pqr/dashboard', icon: LayoutDashboard },
      { label: 'Create PQR', href: '/pqr/create', icon: Plus },
      { label: 'Batch Review', href: '/pqr/batches', icon: Package },
      { label: 'Material Review', href: '/pqr/materials', icon: Beaker },
      { label: 'Packaging Review', href: '/pqr/packaging', icon: PackageSearch },
      { label: 'Equipment Review', href: '/pqr/equipment-review', icon: Cog },
      { label: 'Utility Review', href: '/pqr/utility-review', icon: Droplets },
      { label: 'Stability Review', href: '/pqr/stability', icon: LineChart },
      { label: 'Summary & Conclusion', href: '/pqr/summary', icon: FileText },
      { label: 'Approval', href: '/pqr/approval', icon: CheckCircle },
    ],
  },
  {
    label: 'QMS',
    icon: ShieldCheck,
    matchPrefix: '/qms',
    children: [
      { label: 'Deviation Management', href: '/qms/deviation', icon: AlertTriangle },
      { label: 'OOS Management', href: '/qms/oos', icon: TestTube },
      { label: 'CAPA Management', href: '/qms/capa', icon: CheckSquare },
      { label: 'Change Control', href: '/qms/change-control', icon: RefreshCw },
      { label: 'Stability Management', href: '/qms/stability', icon: LineChart },
      { label: 'Complaint Management', href: '/qms/complaints', icon: MessageSquare },
      { label: 'Product Recall', href: '/qms/recall', icon: RotateCcw },
      { label: 'Document Management', href: '/qms/documents/master', icon: BookOpen },
      { label: 'Training Management', href: '/qms/training', icon: Users },
      { label: 'Audit Management', href: '/qms/audit', icon: ClipboardList },
      { label: 'Vendor Management', href: '/qms/vendors', icon: TruckIcon },
      { label: 'Validation Management', href: '/qms/validation', icon: FileCheck },
      { label: 'CSV Management', href: '/qms/csv', icon: Monitor },
      { label: 'Equipment Management', href: '/qms/equipment', icon: Wrench },
      { label: 'Environmental & Utility Monitoring', href: '/qms/monitoring', icon: Thermometer },
      { label: 'Warehouse Management', href: '/qms/warehouse', icon: PackageSearch },
      { label: 'eBMR', href: '/qms/ebmr', icon: Factory },
    ],
  },
  {
    label: 'Manufacturing',
    icon: Building2,
    children: [
      { label: 'Batch Management', href: '/dashboard/batches', icon: Package },
      { label: 'Product Master', href: '/dashboard/products', icon: FlaskConical },
    ],
  },
  {
    label: 'Regulatory & Compliance',
    icon: Award,
    children: [
      { label: 'Audit Trail', href: '/dashboard/audit-trail', icon: FileText },
      { label: 'Document Management', href: '/qms/documents/master', icon: BookOpen },
      { label: 'Training Records', href: '/qms/training', icon: Users },
    ],
  },
  {
    label: 'Operations',
    icon: Cog,
    children: [
      { label: 'Equipment Management', href: '/qms/equipment', icon: Wrench },
      { label: 'Environmental Monitoring', href: '/qms/monitoring', icon: Thermometer },
      { label: 'Vendor Management', href: '/qms/vendors', icon: TruckIcon },
      { label: 'Warehouse Traceability', href: '/qms/warehouse', icon: PackageSearch },
    ],
  },
  {
    label: 'Master Data',
    icon: Settings,
    children: [
      { label: 'Product Master', href: '/dashboard/master/product', icon: FlaskConical },
      { label: 'Material Master', href: '/dashboard/master/materials', icon: Beaker },
      { label: 'Vendor Master', href: '/dashboard/master/vendors', icon: TruckIcon },
      { label: 'Abbreviations', href: '/dashboard/master/abbreviations', icon: BookOpen },
    ],
  },
  { label: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'AI Analytics', href: '/dashboard/ai-analytics', icon: Brain },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  embedded?: boolean;
}

export function Sidebar({ collapsed, onToggle, embedded = false }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { canAccessModule, canViewDashboard, loading: permLoading } = usePermissions();
  const [openGroups, setOpenGroups] = useState<string[]>([
    'Admin',
    'Continued Process Verification',
    'PQR Management',
  ]);

  const visibleNavItems = navItems
    .map((item) => {
      if (!item.children) {
        if (item.href === '/dashboard') {
          return canViewDashboard ? item : null;
        }
        if (item.href && navHrefModule(item.href)) {
          const mod = navHrefModule(item.href)!;
          if (!canAccessModule(mod)) return null;
        }
        return item;
      }
      const children = item.children.filter((child) => {
        if (!child.href) return true;
        const mod = navHrefModule(child.href);
        if (!mod) return true;
        return canAccessModule(mod);
      });
      if (!children.length) return null;
      if (item.label === 'Admin' && !canAccessModule('admin')) return null;
      return { ...item, children };
    })
    .filter(Boolean) as NavItem[];

  if (permLoading) {
    return (
      <aside className="hidden lg:flex h-screen w-[260px] items-center justify-center sidebar-bg border-r">
        <span className="text-slate-400 text-sm">Loading menu...</span>
      </aside>
    );
  }

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isLinkActive = (href?: string) => {
    if (!href) return false;
    if (href === '/dashboard' || href === '/cpv' || href === '/cpv/dashboard' || href === '/admin' || href === '/pqr/dashboard') {
      return pathname === href || (href === '/cpv/dashboard' && pathname === '/cpv');
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isGroupActive = (item: NavItem) => {
    if (item.label === 'PQR Management') {
      return pathname.startsWith('/pqr') || pathname.startsWith('/dashboard/pqr');
    }
    if (item.label === 'Admin') {
      return pathname.startsWith('/admin') || pathname.startsWith('/dashboard/admin');
    }
    if (item.matchPrefix) {
      return pathname === item.matchPrefix || pathname.startsWith(item.matchPrefix + '/');
    }
    return item.children?.some((c) => isLinkActive(c.href)) ?? false;
  };

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
        'h-screen flex-col sidebar-bg border-r transition-all duration-300 ease-in-out flex-shrink-0 border-r',
        embedded ? 'flex w-full' : 'hidden lg:flex',
        !embedded && (collapsed ? 'w-[64px]' : 'w-[260px]')
      )} style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className="flex items-center h-16 border-b px-4 flex-shrink-0" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <div className="flex items-center gap-2.5 flex-shrink-0 w-full">
            <div className="relative h-8 flex-shrink-0">
              <Image src="/logo-1.png" alt="Skymap Logo" width={298} height={143} className="h-8 w-auto object-contain" priority />
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <span className="text-white font-bold text-sm leading-tight block">SKYMAP</span>
                <span className="text-xs leading-tight block text-blue-300">Pharmaceuticals</span>
              </div>
            )}
            <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="ml-auto text-slate-400 hover:text-white transition-colors p-1 rounded">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 space-y-0.5">
          {visibleNavItems.map((item) => {
            if (item.children) {
              const isOpen = openGroups.includes(item.label) || isGroupActive(item);
              const hasActiveChild = isGroupActive(item);

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
                          {item.children.map((child) => (
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
                      hasActiveChild ? 'text-blue-400 bg-blue-600/10' : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
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
                          key={child.href + child.label}
                          href={child.href!}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                            isLinkActive(child.href)
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
                        isLinkActive(item.href) ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
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
                  isLinkActive(item.href) ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25' : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 font-medium">{item.label}</span>
                <BadgeEl item={item} />
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3 flex-shrink-0" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <UserCircle className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs capitalize truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>
                  {profile?.role?.replace(/_/g, ' ') || 'Viewer'}
                </p>
              </div>
              <button onClick={signOut} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-9 h-9 mx-auto bg-blue-600/20 rounded-lg flex items-center justify-center cursor-pointer">
                  <UserCircle className="h-5 w-5 text-blue-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{profile?.full_name || 'User'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

// Alias for components expecting AppSidebar
export { Sidebar as AppSidebar };
