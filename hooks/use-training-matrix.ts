'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchMatrixDashboard } from '@/lib/training-matrix-service';
import {
  canViewMatrixModule, canManageMatrixModule, canEditMatrixModule,
  canRecommendMatrixModule, isMatrixReadOnly, isDepartmentMatrixView,
  type MatrixFilters, type MatrixDashboardData, type MatrixActor,
} from '@/lib/training-matrix-types';

export function useTrainingMatrix(filters?: MatrixFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<MatrixDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: MatrixActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewMatrixModule(role)) {
      setError('You do not have permission to view the training matrix');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchMatrixDashboard({
        role,
        userDepartment: profile?.department,
        filters,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matrix data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, profile?.department, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor, refresh,
    canView: canViewMatrixModule(role),
    canManage: canManageMatrixModule(role),
    canEdit: canEditMatrixModule(role),
    canRecommend: canRecommendMatrixModule(role),
    isReadOnly: isMatrixReadOnly(role),
    isDepartmentView: isDepartmentMatrixView(role),
  };
}

export type { MatrixFilters, MatrixDashboardData };
