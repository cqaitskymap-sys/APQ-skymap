'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listAreas, listEnvironmental, listUtility, listExcursions,
  computeDashboardMetrics,
} from '@/lib/monitoring-mgmt-service';
import type {
  AreaRecord, EnvironmentalRecord, UtilityRecord, ExcursionRecord,
  AreaFilters, MonitoringFilters, MonitoringDashboardMetrics,
} from '@/lib/monitoring-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useMonitoring(areaFilters?: AreaFilters, monFilters?: MonitoringFilters) {
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [environmental, setEnvironmental] = useState<EnvironmentalRecord[]>([]);
  const [utility, setUtility] = useState<UtilityRecord[]>([]);
  const [excursions, setExcursions] = useState<ExcursionRecord[]>([]);
  const [metrics, setMetrics] = useState<MonitoringDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ar, env, utl, exc] = await Promise.all([
        listAreas(areaFilters), listEnvironmental(monFilters), listUtility(monFilters), listExcursions(),
      ]);
      setAreas(ar);
      setEnvironmental(env);
      setUtility(utl);
      setExcursions(exc);
      setMetrics(computeDashboardMetrics(env, utl, exc));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(areaFilters), JSON.stringify(monFilters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { areas, environmental, utility, excursions, metrics, loading, error, refresh };
}

export function useAreaItem(id: string) {
  const [record, setRecord] = useState<AreaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { getAreaById } = await import('@/lib/monitoring-mgmt-service');
      setRecord(await getAreaById(id));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useMonitoringActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown', role: normalizeRole(profile?.role) };
}
