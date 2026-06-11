'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listChanges, getChangeById, computeDashboardMetrics, syncOverdueChanges, listAllRiskAssessments,
} from '@/lib/change-control-service';
import type { ChangeControlRecord, CcFilters, CcDashboardMetrics, ChangeRiskAssessment } from '@/lib/change-control-types';
import { normalizeRole } from '@/lib/permissions';

export function useChangeControls(filters?: CcFilters) {
  const [records, setRecords] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState<CcDashboardMetrics | null>(null);
  const [risks, setRisks] = useState<ChangeRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueChanges();
      const [data, riskData] = await Promise.all([listChanges(filters), listAllRiskAssessments()]);
      setRecords(data);
      setRisks(riskData);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load change controls');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, metrics, risks, loading, error, refresh };
}

export function useChangeControl(id: string) {
  const [record, setRecord] = useState<ChangeControlRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setRecord(await getChangeById(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { record, loading, refresh };
}

export function useCcActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
