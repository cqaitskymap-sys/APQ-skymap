'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { fetchOosDashboardData } from '@/lib/oos-dashboard-service';
import { getOosById } from '@/lib/oos-service';
import type { OosRecord, OosFilters, OosDashboardMetrics } from '@/lib/oos-types';
import { normalizeRole } from '@/lib/permissions';

export function useOosRecords(filters?: OosFilters) {
  const hasFilters = filters !== undefined;
  const search = filters?.search;
  const oosNumber = filters?.oos_number;
  const department = filters?.department;
  const productName = filters?.product_name;
  const batchNumber = filters?.batch_number;
  const testName = filters?.test_name;
  const rootCause = filters?.root_cause;
  const status = filters?.status;
  const capaLinked = filters?.capa_linked;
  const capaRequired = filters?.capa_required;
  const assignedTo = filters?.assigned_to;
  const overdueOnly = filters?.overdue_only;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;
  const kpiFilter = filters?.kpi_filter;
  const stableFilters = useMemo<OosFilters | undefined>(
    () => hasFilters ? {
      search,
      oos_number: oosNumber,
      department,
      product_name: productName,
      batch_number: batchNumber,
      test_name: testName,
      root_cause: rootCause,
      status,
      capa_linked: capaLinked,
      capa_required: capaRequired,
      assigned_to: assignedTo,
      overdue_only: overdueOnly,
      date_from: dateFrom,
      date_to: dateTo,
      kpi_filter: kpiFilter,
    } : undefined,
    [
      hasFilters, search, oosNumber, department, productName, batchNumber, testName,
      rootCause, status, capaLinked, capaRequired, assignedTo, overdueOnly, dateFrom,
      dateTo, kpiFilter,
    ],
  );
  const [records, setRecords] = useState<OosRecord[]>([]);
  const [metrics, setMetrics] = useState<OosDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOosDashboardData(stableFilters);
      setRecords(data.records);
      setMetrics(data.metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load OOS records');
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, metrics, loading, error, refresh };
}

export function useOosRecord(id: string) {
  const [record, setRecord] = useState<OosRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setRecord(await getOosById(id)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useOosActor() {
  const { user, profile } = useAuth();
  const id = user?.uid || 'anonymous';
  const name = profile?.full_name || profile?.email || 'Unknown User';
  const role = normalizeRole(profile?.role);
  return useMemo(() => ({ id, name, role }), [id, name, role]);
}
