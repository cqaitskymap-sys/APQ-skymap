'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchArchiveDashboardData } from '@/lib/archive-management-service';
import type {
  ArchiveRecord, ArchiveKpis, ArchiveCharts, ArchiveFilters, ArchiveActor,
} from '@/lib/archive-management-types';
import {
  canViewArchiveRecords, canManageArchive, canApproveArchive, canRestoreArchive,
  canExportArchive, isArchiveReadOnly, isEmployeeEffectiveOnly,
} from '@/lib/archive-management-types';
import {
  emptyArchiveKpis, emptyArchiveCharts, computeArchiveKpis, computeArchiveCharts,
} from '@/lib/archive-management-records';

const PAGE_SIZE = 20;

export function useArchiveManagement(initialFilters?: ArchiveFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<ArchiveFilters>(initialFilters || {});
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [metrics, setMetrics] = useState<ArchiveKpis>(emptyArchiveKpis());
  const [charts, setCharts] = useState<ArchiveCharts>(emptyArchiveCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: ArchiveActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const deptOnly = role.includes('manager') && !canManageArchive(role);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (isEmployeeEffectiveOnly(role)) {
        setRecords([]); setMetrics(emptyArchiveKpis()); setCharts(emptyArchiveCharts());
        return;
      }
      if (!canViewArchiveRecords(role)) {
        setRecords([]); setMetrics(emptyArchiveKpis()); setCharts(emptyArchiveCharts());
        return;
      }
      const appliedFilters = deptOnly && actor.department
        ? { ...filters, department_only: actor.department }
        : filters;
      const data = await fetchArchiveDashboardData(appliedFilters);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load archive records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, deptOnly, actor.department]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paginatedRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor,
    page, setPage, pageSize: PAGE_SIZE, totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: records.length, totalPages },
    selectedIds,
    toggleSelect: (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]),
    toggleSelectAll: () => {
      const pageIds = paginatedRecords.map((r) => r.id);
      const all = pageIds.every((id) => selectedIds.includes(id));
      setSelectedIds(all ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
    },
    clearSelection: () => setSelectedIds([]),
    canManage: canManageArchive(role),
    canApprove: canApproveArchive(role),
    canRestore: canRestoreArchive(role),
    canExport: canExportArchive(role),
    isReadOnly: isArchiveReadOnly(role),
    canView: canViewArchiveRecords(role),
    deptOnly,
  };
}
