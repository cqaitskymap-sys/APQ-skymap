'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listAudits, getAuditById, listFindings, computeDashboardMetrics,
  syncOverdueFindings, syncOverdueAudits,
} from '@/lib/audit-mgmt-service';
import type { AuditRecord, AuditFinding, AuditFilters, AuditDashboardMetrics } from '@/lib/audit-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useAudits(filters?: AuditFilters) {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [metrics, setMetrics] = useState<AuditDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([syncOverdueFindings(), syncOverdueAudits()]);
      const [a, f] = await Promise.all([listAudits(filters), listFindings()]);
      setAudits(a);
      setFindings(f);
      setMetrics(computeDashboardMetrics(a, f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audits');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { audits, findings, metrics, loading, error, refresh };
}

export function useAudit(id: string) {
  const [record, setRecord] = useState<AuditRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setRecord(await getAuditById(id)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useAuditActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
