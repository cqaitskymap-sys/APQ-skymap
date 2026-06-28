'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchCompletionDashboard } from '@/lib/training-completion-service';
import {
  canViewCompletion, canManageCompletion, canApproveCompletion,
  canMarkCompletionAttendance, isCompletionReadOnly, isEmployeeCompletionView,
  isDepartmentCompletionView,
  type CompletionFilters, type CompletionDashboardData, type CompletionActor,
} from '@/lib/training-completion-types';

export function useTrainingCompletion(filters?: CompletionFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<CompletionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: CompletionActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewCompletion(role)) {
      setError('You do not have permission to view training completion records');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchCompletionDashboard({
        role,
        userId: user?.uid,
        userDepartment: profile?.department,
        filters,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load completion data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor, refresh,
    canView: canViewCompletion(role),
    canManage: canManageCompletion(role),
    canApprove: canApproveCompletion(role),
    canMark: canMarkCompletionAttendance(role),
    isReadOnly: isCompletionReadOnly(role),
    isEmployeeView: isEmployeeCompletionView(role),
    isDepartmentView: isDepartmentCompletionView(role),
  };
}

export type { CompletionFilters, CompletionDashboardData };
