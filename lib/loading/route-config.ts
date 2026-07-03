import type { RouteLoaderVariant } from './types';

export const ROUTE_LOADER_VARIANTS: Record<string, RouteLoaderVariant> = {
  dashboard: 'dashboard',
  admin: 'dashboard',
  qms: 'dashboard',
  cpv: 'dashboard',
  pqr: 'dashboard',
  auth: 'fullpage',
  notifications: 'list',
};

export function resolveRouteLoaderVariant(routePath: string): RouteLoaderVariant {
  const segment = routePath.replace(/^app[\\/]/, '').split(/[\\/]/)[0] ?? '';
  return ROUTE_LOADER_VARIANTS[segment] ?? 'section';
}

export function getRouteLoaderMessage(routePath: string): string {
  const segment = routePath.replace(/^app[\\/]/, '').split(/[\\/]/)[0] ?? '';
  const messages: Record<string, string> = {
    dashboard: 'Loading dashboard',
    admin: 'Loading administration',
    qms: 'Loading quality module',
    cpv: 'Loading CPV module',
    pqr: 'Loading PQR module',
    auth: 'Authenticating',
    notifications: 'Loading notifications',
  };
  return messages[segment] ?? 'Loading module';
}
