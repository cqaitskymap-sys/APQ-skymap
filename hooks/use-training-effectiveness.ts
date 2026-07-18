'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchEffectivenessDashboard } from '@/lib/training-effectiveness-service';
import {
  canViewEffectiveness, canManageEffectiveness, canApproveEffectiveness,
  canEvaluateEffectiveness, isEffectivenessReadOnly, isEmployeeEffectivenessView,
  type EffectivenessFilters, type EffectivenessDashboardData, type EffectivenessActor,
} from '@/lib/training-effectiveness-types';

export function useTrainingEffectiveness(filters?: EffectivenessFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<EffectivenessDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: EffectivenessActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);
  const hasFilters = filters !== undefined;
  const {
    department, employee_id, evaluation_type, result, status,
    evaluator, date_from, date_to, search,
  } = filters ?? {};
  const stableFilters = useMemo<EffectivenessFilters | undefined>(() => hasFilters ? ({
    department,
    employee_id,
    evaluation_type,
    result,
    status,
    evaluator,
    date_from,
    date_to,
    search,
  }) : undefined, [
    hasFilters, department, employee_id, evaluation_type, result,
    status, evaluator, date_from, date_to, search,
  ]);

  const refresh = useCallback(async () => {
    if (!canViewEffectiveness(role)) {
      setError('You do not have permission to view training effectiveness evaluations');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchEffectivenessDashboard({
        role,
        userId: user?.uid,
        userDepartment: profile?.department,
        filters: stableFilters,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load effectiveness data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, stableFilters]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor, refresh,
    canView: canViewEffectiveness(role),
    canManage: canManageEffectiveness(role),
    canApprove: canApproveEffectiveness(role),
    canEvaluate: canEvaluateEffectiveness(role),
    isReadOnly: isEffectivenessReadOnly(role),
    isEmployeeView: isEmployeeEffectivenessView(role),
  };
}

export type { EffectivenessFilters, EffectivenessDashboardData };
