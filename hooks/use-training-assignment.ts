'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchAssignmentDashboard } from '@/lib/training-assignment-service';
import {
  canViewAssignments, canManageAssignments, canAssignAssignments,
  isAssignmentReadOnly, isEmployeeAssignmentView, isDepartmentAssignmentView,
  type AssignmentFilters, type AssignmentDashboardData, type AssignmentActor,
} from '@/lib/training-assignment-types';

export function useTrainingAssignment(filters?: AssignmentFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<AssignmentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: AssignmentActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewAssignments(role)) {
      setError('You do not have permission to view training assignments');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchAssignmentDashboard({
        role,
        userId: user?.uid,
        userDepartment: profile?.department,
        filters,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignment data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor, refresh,
    canView: canViewAssignments(role),
    canManage: canManageAssignments(role),
    canAssign: canAssignAssignments(role),
    isReadOnly: isAssignmentReadOnly(role),
    isEmployeeView: isEmployeeAssignmentView(role),
    isDepartmentView: isDepartmentAssignmentView(role),
  };
}

export type { AssignmentFilters, AssignmentDashboardData };
