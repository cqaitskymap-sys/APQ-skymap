'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listCapas, getCapaById, computeDashboardMetrics, syncOverdueCapas,
} from '@/lib/capa-service';
import type { CapaRecord, CapaFilters, CapaDashboardMetrics } from '@/lib/capa-types';
import { normalizeRole } from '@/lib/permissions';

export function useCapas(filters?: CapaFilters) {
  const [records, setRecords] = useState<CapaRecord[]>([]);
  const [metrics, setMetrics] = useState<CapaDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueCapas();
      const data = await listCapas(filters);
      setRecords(data);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CAPA records');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, metrics, loading, error, refresh };
}

export function useCapa(id: string) {
  const [record, setRecord] = useState<CapaRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setRecord(await getCapaById(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { record, loading, refresh };
}

export function useCapaActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
