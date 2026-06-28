'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { listEmployees } from '@/lib/training-service';
import type { EmployeeProfile } from '@/lib/training-types';
import {
  fetchTrainingDashboard,
  refreshTrainingDashboard,
  logTrainingDashboardFilterChanged,
} from '@/lib/training-dashboard-service';
import {
  canViewTrainingDashboardModule,
  canManageTrainingDashboardModule,
  canExportTrainingDashboardModule,
  canViewDepartmentTrainingDashboard,
  isEmployeeTrainingDashboardView,
  isTrainingDashboardReadOnly,
  isDepartmentTrainingDashboardView,
  type TrainingDashboardFilters,
  type TrainingDashboardData,
  type TrainingDashboardActor,
} from '@/lib/training-dashboard-types';

export function useTrainingDashboard() {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const userDepartment = profile?.department || '';
  const userEmployeeId = profile?.employee_id || user?.uid || '';

  const actor: TrainingDashboardActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const [filters, setFilters] = useState<TrainingDashboardFilters>({});
  const [data, setData] = useState<TrainingDashboardData | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopedFilters = useMemo((): TrainingDashboardFilters => {
    const f = { ...filters };
    if (isEmployeeTrainingDashboardView(role) && userEmployeeId) {
      f.employee_id = userEmployeeId;
    } else if (
      canViewDepartmentTrainingDashboard(role)
      && !canManageTrainingDashboardModule(role)
      && !canExportTrainingDashboardModule(role)
      && userDepartment
      && !f.department
    ) {
      f.department = userDepartment;
    }
    return f;
  }, [filters, role, userDepartment, userEmployeeId]);

  const load = useCallback(async (isRefresh = false) => {
    if (!canViewTrainingDashboardModule(role)) {
      setError('You do not have permission to view the training dashboard');
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = isRefresh
        ? await refreshTrainingDashboard(scopedFilters, actor)
        : await fetchTrainingDashboard(scopedFilters, actor);
      setData(result);
      if (result.error && !isRefresh) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scopedFilters, actor, role]);

  useEffect(() => {
    void listEmployees().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const setFiltersWithAudit = useCallback((f: TrainingDashboardFilters) => {
    setFilters(f);
    if (actor.id) void logTrainingDashboardFilterChanged(actor, f);
  }, [actor]);

  return {
    data,
    filters,
    setFilters: setFiltersWithAudit,
    employees,
    loading,
    refreshing,
    error,
    refresh,
    role,
    actor,
    showDepartmentFilter: !isEmployeeTrainingDashboardView(role),
    showEmployeeFilter: !isEmployeeTrainingDashboardView(role),
    canView: canViewTrainingDashboardModule(role),
    canManage: canManageTrainingDashboardModule(role),
    canExport: canExportTrainingDashboardModule(role),
    isReadOnly: isTrainingDashboardReadOnly(role),
    isDepartmentView: isDepartmentTrainingDashboardView(role),
    isEmployeeView: isEmployeeTrainingDashboardView(role),
  };
}

export type { TrainingDashboardFilters, TrainingDashboardData };
