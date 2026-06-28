'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchRetrainingDashboard } from '@/lib/training-retraining-service';
import {
  canViewRetraining, canManageRetraining, canAssignRetraining, canApproveRetraining,
  canConductRetraining, isRetrainingReadOnly, isEmployeeRetrainingView,
  type RetrainingFilters, type RetrainingDashboardData, type RetrainingActor,
} from '@/lib/training-retraining-types';

export function useTrainingRetraining(filters?: RetrainingFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<RetrainingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: RetrainingActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewRetraining(role)) {
      setError('You do not have permission to view retraining records');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchRetrainingDashboard({
        role, userId: user?.uid, userDepartment: profile?.department, filters,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load retraining data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor,
    selectedIds, setSelectedIds, refresh,
    canView: canViewRetraining(role),
    canManage: canManageRetraining(role),
    canAssign: canAssignRetraining(role),
    canApprove: canApproveRetraining(role),
    canConduct: canConductRetraining(role),
    isReadOnly: isRetrainingReadOnly(role),
    isEmployeeView: isEmployeeRetrainingView(role),
  };
}

export type { RetrainingFilters, RetrainingDashboardData };
