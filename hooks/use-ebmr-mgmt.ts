'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { listEbmr, computeEbmrMetrics, listAllCppRecords, listAllIpcChecks, listAllManufacturingSteps } from '@/lib/ebmr-mgmt-service';
import type { EbmrRecord, EbmrFilters, EbmrDashboardMetrics, CppRecord, IpcCheckRecord, ManufacturingStepRecord } from '@/lib/ebmr-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useEbmr(filters?: EbmrFilters) {
  const [records, setRecords] = useState<EbmrRecord[]>([]);
  const [cppRecords, setCppRecords] = useState<CppRecord[]>([]);
  const [ipcRecords, setIpcRecords] = useState<IpcCheckRecord[]>([]);
  const [mfgSteps, setMfgSteps] = useState<ManufacturingStepRecord[]>([]);
  const [metrics, setMetrics] = useState<EbmrDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, cpp, ipc, steps] = await Promise.all([
        listEbmr(filters), listAllCppRecords(), listAllIpcChecks(), listAllManufacturingSteps(),
      ]);
      setRecords(data);
      setCppRecords(cpp);
      setIpcRecords(ipc);
      setMfgSteps(steps);
      setMetrics(computeEbmrMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load eBMR data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { records, cppRecords, ipcRecords, mfgSteps, metrics, loading, error, refresh };
}

export function useEbmrItem(id: string) {
  const [record, setRecord] = useState<EbmrRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { getEbmrById } = await import('@/lib/ebmr-mgmt-service');
      setRecord(await getEbmrById(id));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useEbmrActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown', role: normalizeRole(profile?.role) };
}
