'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { listRecalls, getRecallById, computeDashboardMetrics } from '@/lib/recall-service';
import type { RecallRecord, RecallFilters, RecallDashboardMetrics } from '@/lib/recall-types';
import { normalizeRole } from '@/lib/permissions';

export function useRecalls(filters?: RecallFilters) {
  const hasFilters = filters !== undefined;
  const recallType = filters?.recall_type;
  const recallClassification = filters?.recall_classification;
  const recallStatus = filters?.recall_status;
  const product = filters?.product;
  const batchNumber = filters?.batch_number;
  const marketRegion = filters?.market_region;
  const search = filters?.search;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;
  const kpiFilter = filters?.kpi_filter;
  const stableFilters = useMemo<RecallFilters | undefined>(
    () => hasFilters ? {
      recall_type: recallType,
      recall_classification: recallClassification,
      recall_status: recallStatus,
      product,
      batch_number: batchNumber,
      market_region: marketRegion,
      search,
      date_from: dateFrom,
      date_to: dateTo,
      kpi_filter: kpiFilter,
    } : undefined,
    [
      hasFilters, recallType, recallClassification, recallStatus, product,
      batchNumber, marketRegion, search, dateFrom, dateTo, kpiFilter,
    ],
  );
  const [records, setRecords] = useState<RecallRecord[]>([]);
  const [metrics, setMetrics] = useState<RecallDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRecalls(stableFilters);
      setRecords(data);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recalls');
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => { refresh(); }, [refresh]);
  return { records, metrics, loading, error, refresh };
}

export function useRecall(id: string) {
  const [record, setRecord] = useState<RecallRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setRecord(await getRecallById(id)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useRecallActor() {
  const { user, profile } = useAuth();
  const id = user?.uid || 'anonymous';
  const name = profile?.full_name || profile?.email || 'Unknown User';
  const role = normalizeRole(profile?.role);
  return useMemo(() => ({ id, name, role }), [id, name, role]);
}
