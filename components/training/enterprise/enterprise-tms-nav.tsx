'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ENTERPRISE_TMS_MODULES, TMS_MODULE_GROUPS, type TmsModuleGroup,
} from '@/lib/enterprise-tms/modules';
import { COMPLIANCE_STANDARDS } from '@/lib/enterprise-tms/types';

function isActive(pathname: string, href: string, matchPaths?: string[]): boolean {
  const paths = matchPaths ?? [href];
  return paths.some((p) => {
    if (p === '/training') return pathname === '/training' || pathname === '/training/dashboard';
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export function EnterpriseTmsNav() {
  const pathname = usePathname();
  const routeBase = pathname.startsWith('/qms/training') ? '/qms/training' : '/training';
  const [collapsed, setCollapsed] = useState<Partial<Record<TmsModuleGroup, boolean>>>({});
  const routeFor = (path: string) => path.replace(/^\/training/, routeBase);

  const toggleGroup = (group: TmsModuleGroup) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <nav className="w-full lg:w-60 shrink-0">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 text-white">
          <p className="text-sm font-bold tracking-wide">Enterprise TMS</p>
          <p className="text-[10px] opacity-80 mt-0.5">GMP · 21 CFR Part 11 · ALCOA+</p>
        </div>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="p-2 space-y-1">
            {TMS_MODULE_GROUPS.map((group) => {
              const modules = ENTERPRISE_TMS_MODULES.filter((m) => m.group === group);
              const isOpen = !collapsed[group];
              const groupId = `tms-nav-${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              const groupActive = modules.some((module) =>
                isActive(pathname, routeFor(module.href), module.matchPaths?.map(routeFor)));
              return (
                <div key={group}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    aria-expanded={isOpen}
                    aria-controls={groupId}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                      groupActive ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {group}
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div id={groupId} className="ml-1 space-y-0.5 mb-1">
                      {modules.map((mod) => {
                        const Icon = mod.icon;
                        const href = routeFor(mod.href);
                        const active = isActive(pathname, href, mod.matchPaths?.map(routeFor));
                        return (
                          <Link
                            key={mod.id}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all',
                              active
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium shadow-sm'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate leading-tight">{mod.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-t px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>{COMPLIANCE_STANDARDS.length} compliance standards</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Re-export badges from original sub-nav for backward compatibility
export { TmsStatusBadge, EffectivenessBadge, ComplianceBadge, AttendanceBadge, CompletionBadge, ResultBadge } from '@/components/training/tms-sub-nav-badges';
