'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listDocuments, getDocumentById, computeDashboardMetrics, syncEffectiveDocuments,
  syncReviewDueNotifications, computeTrainingPending,
} from '@/lib/dms-service';
import type { DocumentRecord, DmsFilters, DmsDashboardMetrics } from '@/lib/dms-types';
import { normalizeRole } from '@/lib/permissions';

export function useDocuments(filters?: DmsFilters) {
  const { profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [metrics, setMetrics] = useState<DmsDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([syncEffectiveDocuments(), syncReviewDueNotifications()]);
      const data = await listDocuments(filters, role);
      const trainingPending = await computeTrainingPending();
      const m = computeDashboardMetrics(data);
      m.trainingPending = trainingPending;
      setRecords(data);
      setMetrics(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters), role]);

  useEffect(() => { refresh(); }, [refresh]);

  return { records, metrics, loading, error, refresh, role };
}

export function useDocument(id: string) {
  const [record, setRecord] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setRecord(await getDocumentById(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { record, loading, refresh };
}

export function useDmsActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
