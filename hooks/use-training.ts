'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listTrainingMaster, listAssignments, getTrainingMatrix, listEffectiveness,
  listCompetency, computeDashboardMetrics, syncOverdueAssignments, syncDmsTrainingLinks,
  buildTrainingMatrix, listAttendance, listTrainingRecords, getTrainingCalendar,
  listMatrixDefinitions, listEmployees,
} from '@/lib/training-service';
import {
  fetchTrainingDashboard, refreshTrainingDashboard,
} from '@/lib/training-dashboard-service';
import type { TrainingDashboardData, TrainingDashboardFilters } from '@/lib/training-dashboard-records';
import type {
  TrainingMaster, TrainingAssignment, TrainingMatrixRow, TrainingEffectiveness,
  CompetencyRecord, TmsFilters, TmsDashboardMetrics, TrainingAttendance, TrainingRecord,
  TrainingCalendarEvent, TrainingMatrixDefinition, EmployeeProfile,
} from '@/lib/training-types';
import {
  canViewDepartmentTraining, canManageMatrix, canReviewTraining,
  canManageTraining, isEmployeeTrainingView,
} from '@/lib/training-types';
import { normalizeRole } from '@/lib/permissions';

export function useTrainingDashboard(filters?: TmsFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor = { id: user?.uid || '', name: profile?.full_name || '', role };

  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [matrix, setMatrix] = useState<TrainingMatrixRow[]>([]);
  const [effectiveness, setEffectiveness] = useState<TrainingEffectiveness[]>([]);
  const [competency, setCompetency] = useState<CompetencyRecord[]>([]);
  const [metrics, setMetrics] = useState<TmsDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueAssignments();
      if (actor.id) await syncDmsTrainingLinks({ id: actor.id, name: actor.name || 'System', role });
      const [m, a, mx, eff, comp] = await Promise.all([
        listTrainingMaster(filters),
        listAssignments(filters),
        getTrainingMatrix(),
        listEffectiveness(),
        listCompetency(),
      ]);
      setMasters(m);
      setAssignments(a);
      setMatrix(mx);
      setEffectiveness(eff);
      setCompetency(comp);
      setMetrics(computeDashboardMetrics(mx, a, eff));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters), actor.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { masters, assignments, matrix, effectiveness, competency, metrics, loading, error, refresh, role };
}

export function useTrainingMatrix() {
  const [matrix, setMatrix] = useState<TrainingMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMatrix(await buildTrainingMatrix());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { matrix, loading, refresh };
}

export function useTrainingMatrixManagement(filters?: TmsFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const userDepartment = profile?.department || '';

  const [definitions, setDefinitions] = useState<TrainingMatrixDefinition[]>([]);
  const [compliance, setCompliance] = useState<TrainingMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scopedFilters = { ...filters };
      if (canViewDepartmentTraining(role) && !canManageMatrix(role) && !canReviewTraining(role) && userDepartment) {
        scopedFilters.department = userDepartment;
      }
      const [defs, comp] = await Promise.all([
        listMatrixDefinitions(scopedFilters),
        buildTrainingMatrix(),
      ]);
      setDefinitions(defs);
      setCompliance(
        canViewDepartmentTraining(role) && !canManageMatrix(role) && !canReviewTraining(role) && userDepartment
          ? comp.filter((c) => c.department === userDepartment)
          : comp,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matrix data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters), user?.uid, role, userDepartment]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    definitions, compliance, loading, error, refresh, role, userDepartment,
    actor: { id: user?.uid || '', name: profile?.full_name || '', role },
  };
}

export function useTrainingAssignments(filters?: TmsFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const userDepartment = profile?.department || '';
  const userEmployeeId = profile?.employee_id || user?.uid || '';

  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [calendar, setCalendar] = useState<TrainingCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueAssignments();
      await syncDmsTrainingLinks({ id: user?.uid || '', name: profile?.full_name || 'System', role });
      const [a, m, cal] = await Promise.all([
        listAssignments(filters),
        listTrainingMaster({ status: 'Active' }),
        getTrainingCalendar(),
      ]);
      setAssignments(a);
      setMasters(m);
      setCalendar(cal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters), user?.uid, profile?.full_name, role]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    assignments, masters, calendar, loading, error, refresh, role,
    userDepartment, userEmployeeId,
    actor: { id: user?.uid || '', name: profile?.full_name || '', role },
  };
}

export function useTrainingCompletionAttendance(filters?: TmsFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor = { id: user?.uid || '', name: profile?.full_name || '', role };
  const userDepartment = profile?.department || '';
  const userEmployeeId = profile?.employee_id || user?.uid || '';

  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueAssignments();
      const [a, att, rec, m] = await Promise.all([
        listAssignments(filters),
        listAttendance(filters),
        listTrainingRecords(filters),
        listTrainingMaster({ status: 'Active' }),
      ]);
      setAssignments(a);
      setAttendance(att);
      setRecords(rec);
      setMasters(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters), actor.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    assignments, attendance, records, masters, loading, error, refresh, role,
    userDepartment, userEmployeeId, actor,
  };
}

export function useTrainingManagementDashboard() {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const userDepartment = profile?.department || '';
  const userEmployeeId = profile?.employee_id || user?.uid || '';
  const actor = { id: user?.uid || '', name: profile?.full_name || '', role };

  const [filters, setFilters] = useState<TrainingDashboardFilters>({});
  const [data, setData] = useState<TrainingDashboardData | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopedFilters = useMemo((): TrainingDashboardFilters => {
    const f = { ...filters };
    if (isEmployeeTrainingView(role) && userEmployeeId) {
      f.employee_id = userEmployeeId;
    } else if (
      canViewDepartmentTraining(role)
      && !canManageTraining(role)
      && !canReviewTraining(role)
      && userDepartment
      && !f.department
    ) {
      f.department = userDepartment;
    }
    return f;
  }, [filters, role, userDepartment, userEmployeeId]);

  const showDepartmentFilter = !isEmployeeTrainingView(role);
  const showEmployeeFilter = !isEmployeeTrainingView(role);

  const load = useCallback(async (isRefresh = false) => {
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
  }, [scopedFilters, actor.id, actor.name, actor.role]);

  useEffect(() => {
    void listEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    data,
    filters,
    setFilters,
    employees,
    loading,
    refreshing,
    error,
    refresh,
    role,
    actor,
    showDepartmentFilter,
    showEmployeeFilter,
  };
}

export function useTmsActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
