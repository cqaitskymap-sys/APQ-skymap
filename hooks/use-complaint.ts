'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { listComplaints, getComplaintById, computeDashboardMetrics, syncOverdueComplaints } from '@/lib/complaint-service';
import type { ComplaintRecord, ComplaintFilters, ComplaintDashboardMetrics } from '@/lib/complaint-types';
import { normalizeRole } from '@/lib/permissions';

export function useComplaints(filters?: ComplaintFilters) {
  const [records, setRecords] = useState<ComplaintRecord[]>([]);
  const [metrics, setMetrics] = useState<ComplaintDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueComplaints();
      const data = await listComplaints(filters);
      setRecords(data);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { records, metrics, loading, error, refresh };
}

export function useComplaint(id: string) {
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setRecord(await getComplaintById(id)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useComplaintActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown User', role: normalizeRole(profile?.role) };
}
