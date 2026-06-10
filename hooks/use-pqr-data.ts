'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getPqrDocument, getPqrApprovals, getPqrSnapshot, refreshPqrMetrics, getPqrBatches,
} from '@/lib/pqr-service';
import type { PqrDocument, PqrApproval, PqrDataSnapshot } from '@/lib/pqr-types';

export function usePqrData(pqrId: string | null) {
  const [document, setDocument] = useState<PqrDocument | null>(null);
  const [approvals, setApprovals] = useState<PqrApproval[]>([]);
  const [snapshot, setSnapshot] = useState<PqrDataSnapshot | null>(null);
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pqrId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [doc, appr, snap, batchData] = await Promise.all([
        getPqrDocument(pqrId),
        getPqrApprovals(pqrId),
        getPqrSnapshot(pqrId),
        getPqrBatches(pqrId),
      ]);
      setDocument(doc);
      setApprovals(appr);
      setSnapshot(snap);
      setBatches(batchData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pqrId]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshData = useCallback(async (actor?: { id?: string; name?: string; role?: string }) => {
    if (!pqrId) return null;
    setRefreshing(true);
    try {
      const snap = await refreshPqrMetrics(pqrId, actor);
      setSnapshot(snap);
      const doc = await getPqrDocument(pqrId);
      setDocument(doc);
      return snap;
    } finally {
      setRefreshing(false);
    }
  }, [pqrId]);

  return { document, approvals, snapshot, batches, loading, refreshing, error, reload: load, refreshData };
}
