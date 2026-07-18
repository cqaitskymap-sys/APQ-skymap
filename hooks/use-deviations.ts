'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listDeviations, getDeviationById, computeDashboardMetrics, syncOverdueStatuses,
} from '@/lib/deviation-service';
import type { DeviationRecord, DeviationFilters, DeviationDashboardMetrics } from '@/lib/deviation-types';
import { normalizeRole } from '@/lib/permissions';

export function useDeviations(filters?: DeviationFilters) {
  const hasFilters = filters !== undefined;
  const {
    search, deviation_number, department, product_name, batch_number, category,
    criticality, status, capa_required, date_from, date_to, assigned_to,
    overdue_only, kpi_filter,
  } = filters ?? {};
  const stableFilters = useMemo(
    () => hasFilters ? {
      search, deviation_number, department, product_name, batch_number, category,
      criticality, status, capa_required, date_from, date_to, assigned_to,
      overdue_only, kpi_filter,
    } : undefined,
    [
      hasFilters, search, deviation_number, department, product_name, batch_number,
      category, criticality, status, capa_required, date_from, date_to, assigned_to,
      overdue_only, kpi_filter,
    ],
  );
  const [records, setRecords] = useState<DeviationRecord[]>([]);
  const [metrics, setMetrics] = useState<DeviationDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueStatuses();
      const data = await listDeviations(stableFilters);
      setRecords(data);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deviations');
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, metrics, loading, error, refresh };
}

export function useDeviation(id: string) {
  const [record, setRecord] = useState<DeviationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getDeviationById(id);
      setRecord(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { record, loading, refresh };
}

export function useDeviationActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
