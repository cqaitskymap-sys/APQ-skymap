'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { fetchOosDashboardData } from '@/lib/oos-dashboard-service';
import { getOosById } from '@/lib/oos-service';
import type { OosRecord, OosFilters, OosDashboardMetrics } from '@/lib/oos-types';
import { normalizeRole } from '@/lib/permissions';

export function useOosRecords(filters?: OosFilters) {
  const [records, setRecords] = useState<OosRecord[]>([]);
  const [metrics, setMetrics] = useState<OosDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOosDashboardData(filters);
      setRecords(data.records);
      setMetrics(data.metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load OOS records');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

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
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
