'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { listOosRecords, getOosById, computeOosDashboardMetrics, syncOverdueOos, getPhase1 } from '@/lib/oos-service';
import type { OosRecord, OosFilters, OosDashboardMetrics, OosPhase1 } from '@/lib/oos-types';
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
      await syncOverdueOos();
      const data = await listOosRecords(filters);
      const phase1List: OosPhase1[] = [];
      for (const r of data.slice(0, 100)) {
        const p1 = await getPhase1(r.id);
        if (p1) phase1List.push(p1);
      }
      setRecords(data);
      setMetrics(computeOosDashboardMetrics(data, phase1List));
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
