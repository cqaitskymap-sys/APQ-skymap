'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchTrainingAuditDashboard, logTrainingAuditView,
} from '@/lib/training-audit-trail-service';
import {
  canViewTrainingAuditTrail, canExportTrainingAuditTrail, isTrainingAuditReadOnly,
  type TrainingAuditFilters, type TrainingAuditEntry,
  type TrainingAuditDashboardKpis, type TrainingAuditCharts,
} from '@/lib/training-audit-trail-records';

export function useTrainingAuditTrail(filters?: TrainingAuditFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [entries, setEntries] = useState<TrainingAuditEntry[]>([]);
  const [kpis, setKpis] = useState<TrainingAuditDashboardKpis | null>(null);
  const [charts, setCharts] = useState<TrainingAuditCharts | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewTrainingAuditTrail(role)) {
      setError('You do not have permission to view the Training Audit Trail');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const data = await fetchTrainingAuditDashboard({
        role,
        userId: user?.uid,
        userDepartment: profile?.department,
        filters,
      });
      setEntries(data.entries);
      setKpis(data.kpis);
      setCharts(data.charts);
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (canViewTrainingAuditTrail(role) && user?.uid) {
      logTrainingAuditView(actor).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.uid]);

  return {
    entries, kpis, charts, users, loading, refreshing, error, role, actor,
    refresh,
    canView: canViewTrainingAuditTrail(role),
    canExport: canExportTrainingAuditTrail(role),
    isReadOnly: isTrainingAuditReadOnly(role),
  };
}

export type { TrainingAuditEntry, TrainingAuditFilters };
