'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { listRecalls, getRecallById, computeDashboardMetrics } from '@/lib/recall-service';
import type { RecallRecord, RecallFilters, RecallDashboardMetrics } from '@/lib/recall-types';
import { normalizeRole } from '@/lib/permissions';

export function useRecalls(filters?: RecallFilters) {
  const [records, setRecords] = useState<RecallRecord[]>([]);
  const [metrics, setMetrics] = useState<RecallDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRecalls(filters);
      setRecords(data);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recalls');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

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
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown User', role: normalizeRole(profile?.role) };
}
