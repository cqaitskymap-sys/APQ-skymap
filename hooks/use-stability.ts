'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listStudies, getStudyById, computeDashboardMetrics, syncSampleDueNotifications,
  listAllSamplePulls, listAllResults,
} from '@/lib/stability-service';
import type {
  StabilityStudy, StabilityFilters, StabilityDashboardMetrics,
  StabilitySamplePull, StabilityResult,
} from '@/lib/stability-types';
import { normalizeRole } from '@/lib/permissions';

export function useStabilityStudies(filters?: StabilityFilters) {
  const [records, setRecords] = useState<StabilityStudy[]>([]);
  const [pulls, setPulls] = useState<StabilitySamplePull[]>([]);
  const [results, setResults] = useState<StabilityResult[]>([]);
  const [metrics, setMetrics] = useState<StabilityDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncSampleDueNotifications();
      const [data, pullData, resultData] = await Promise.all([
        listStudies(filters), listAllSamplePulls(), listAllResults(),
      ]);
      setRecords(data);
      setPulls(pullData);
      setResults(resultData);
      setMetrics(computeDashboardMetrics(data, pullData, resultData));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stability studies');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, pulls, results, metrics, loading, error, refresh };
}

export function useStabilityStudy(id: string) {
  const [record, setRecord] = useState<StabilityStudy | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setRecord(await getStudyById(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { record, loading, refresh };
}

export function useStabilityActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
