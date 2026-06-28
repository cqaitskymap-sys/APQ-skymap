'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchRetentionDisposalDashboardData } from '@/lib/retention-disposal-service';
import type {
  RetentionPolicyRecord, RetentionScheduleRecord, DisposalRequestRecord,
  DisposalCertificateRecord, RetentionDisposalKpis, RetentionDisposalCharts,
  RetentionDisposalFilters, RetentionDisposalActor,
} from '@/lib/retention-disposal-types';
import {
  canViewRetentionDisposal, canManagePolicies, canManageDisposal, canApproveDisposal,
  canManageHolds, canExportRetention, isRetentionReadOnly, isEmployeeNoDisposal,
} from '@/lib/retention-disposal-types';
import {
  emptyRetentionKpis, emptyRetentionCharts,
} from '@/lib/retention-disposal-records';

const PAGE_SIZE = 20;

export function useRetentionDisposal(initialFilters?: RetentionDisposalFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<RetentionDisposalFilters>(initialFilters || {});
  const [policies, setPolicies] = useState<RetentionPolicyRecord[]>([]);
  const [schedules, setSchedules] = useState<RetentionScheduleRecord[]>([]);
  const [disposals, setDisposals] = useState<DisposalRequestRecord[]>([]);
  const [certificates, setCertificates] = useState<DisposalCertificateRecord[]>([]);
  const [metrics, setMetrics] = useState<RetentionDisposalKpis>(emptyRetentionKpis());
  const [charts, setCharts] = useState<RetentionDisposalCharts>(emptyRetentionCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: RetentionDisposalActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const deptOnly = role.includes('manager') && !canManagePolicies(role) && !canManageDisposal(role);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (isEmployeeNoDisposal(role) || !canViewRetentionDisposal(role)) {
        setPolicies([]); setSchedules([]); setDisposals([]); setCertificates([]);
        setMetrics(emptyRetentionKpis()); setCharts(emptyRetentionCharts());
        return;
      }
      const appliedFilters = deptOnly && actor.department
        ? { ...filters, department_only: actor.department }
        : filters;
      const data = await fetchRetentionDisposalDashboardData(appliedFilters);
      setPolicies(data.policies);
      setSchedules(data.schedules);
      setDisposals(data.disposals);
      setCertificates(data.certificates);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load retention data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, deptOnly, actor.department]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(schedules.length / PAGE_SIZE));
  const paginatedSchedules = schedules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    policies, schedules, paginatedSchedules, disposals, certificates,
    metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor,
    page, setPage, pageSize: PAGE_SIZE, totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: schedules.length, totalPages },
    selectedIds,
    toggleSelect: (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]),
    toggleSelectAll: () => {
      const pageIds = paginatedSchedules.map((r) => r.id);
      const all = pageIds.every((id) => selectedIds.includes(id));
      setSelectedIds(all ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
    },
    clearSelection: () => setSelectedIds([]),
    canManagePolicies: canManagePolicies(role),
    canManageDisposal: canManageDisposal(role),
    canApprove: canApproveDisposal(role),
    canManageHolds: canManageHolds(role),
    canExport: canExportRetention(role),
    isReadOnly: isRetentionReadOnly(role),
    canView: canViewRetentionDisposal(role),
    deptOnly,
  };
}
