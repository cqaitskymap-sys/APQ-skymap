import type { AppModule } from '@/lib/permissions';

/** Maps route prefixes to application modules for access control */
export const ROUTE_MODULE_MAP: Array<{ prefix: string; module: AppModule }> = [
  { prefix: '/admin', module: 'admin' },
  { prefix: '/dashboard/admin', module: 'admin' },
  { prefix: '/cpv', module: 'cpv' },
  { prefix: '/pqr', module: 'pqr' },
  { prefix: '/dashboard/pqr', module: 'pqr' },
  { prefix: '/qms/deviation', module: 'deviation' },
  { prefix: '/qms/oos', module: 'oos' },
  { prefix: '/qms/capa', module: 'capa' },
  { prefix: '/qms/change-control', module: 'change_control' },
  { prefix: '/qms/stability', module: 'stability' },
  { prefix: '/qms/complaints', module: 'complaints' },
  { prefix: '/qms/recall', module: 'recall' },
  { prefix: '/qms/dms', module: 'dms' },
  { prefix: '/qms/training', module: 'training' },
  { prefix: '/qms/audit', module: 'audit' },
  { prefix: '/qms/vendors', module: 'vendors' },
  { prefix: '/qms/validation', module: 'validation' },
  { prefix: '/qms/csv', module: 'csv' },
  { prefix: '/qms/equipment', module: 'equipment' },
  { prefix: '/qms/monitoring', module: 'monitoring' },
  { prefix: '/qms/warehouse', module: 'warehouse' },
  { prefix: '/qms/ebmr', module: 'ebmr' },
  { prefix: '/qms', module: 'qms' },
];

export function resolveModuleFromPath(pathname: string): AppModule | null {
  const match = ROUTE_MODULE_MAP.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.module ?? null;
}

export function navHrefModule(href: string): AppModule | null {
  if (href === '/dashboard') return 'qms';
  return resolveModuleFromPath(href);
}
