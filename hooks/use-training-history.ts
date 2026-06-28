'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchEmployeeHistory, fetchDepartmentHistory, logHistoryViewed } from '@/lib/training-history-service';
import { listEmployees } from '@/lib/training-service';
import {
  canViewTrainingHistory, canManageTrainingHistory, isHistoryReadOnly,
  isEmployeeHistoryView, isDepartmentHistoryView,
  type HistoryFilters, type EmployeeHistoryData, type HistoryActor,
} from '@/lib/training-history-types';

export function useTrainingHistory(employeeId?: string, filters?: HistoryFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<EmployeeHistoryData | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string; department: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: HistoryActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const effectiveEmployeeId = useMemo(() => {
    if (isEmployeeHistoryView(role)) return user?.uid || '';
    return selectedEmployeeId || employeeId || '';
  }, [role, user?.uid, selectedEmployeeId, employeeId]);

  const refresh = useCallback(async () => {
    if (!canViewTrainingHistory(role)) {
      setError('You do not have permission to view training history');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const [historyData, deptData] = await Promise.all([
        fetchEmployeeHistory({
          employeeId: effectiveEmployeeId,
          role, userId: user?.uid, userDepartment: profile?.department, filters,
        }),
        fetchDepartmentHistory({
          department: isDepartmentHistoryView(role) ? profile?.department : filters?.department,
          role, userId: user?.uid, userDepartment: profile?.department,
        }),
      ]);
      setData(historyData);
      if (deptData.employees.length > 0) setEmployees(deptData.employees);
      else {
        const emps = await listEmployees();
        setEmployees(emps.map((e) => ({ id: e.id, name: e.full_name, department: e.department })));
      }
      if (effectiveEmployeeId) {
        await logHistoryViewed(actor, effectiveEmployeeId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, effectiveEmployeeId, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor, employees,
    selectedEmployeeId, setSelectedEmployeeId, effectiveEmployeeId, refresh,
    canView: canViewTrainingHistory(role),
    canManage: canManageTrainingHistory(role),
    isReadOnly: isHistoryReadOnly(role),
    isEmployeeView: isEmployeeHistoryView(role),
    isDepartmentView: isDepartmentHistoryView(role),
  };
}

export type { HistoryFilters, EmployeeHistoryData };
