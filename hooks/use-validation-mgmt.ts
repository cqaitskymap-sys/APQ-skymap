'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { listValidations, computeDashboardMetrics, syncRevalidationDue } from '@/lib/validation-mgmt-service';
import type { ValidationRecord, ValidationFilters, ValidationDashboardMetrics } from '@/lib/validation-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useValidations(filters?: ValidationFilters) {
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [metrics, setMetrics] = useState<ValidationDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncRevalidationDue();
      const data = await listValidations(filters);
      setRecords(data);
      setMetrics(computeDashboardMetrics(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load validations');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { records, metrics, loading, error, refresh };
}

export function useValidation(id: string) {
  const [record, setRecord] = useState<ValidationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { getValidationById } = await import('@/lib/validation-mgmt-service');
      setRecord(await getValidationById(id));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useValidationActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown', role: normalizeRole(profile?.role) };
}
