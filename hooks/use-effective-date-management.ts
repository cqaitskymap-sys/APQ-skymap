'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchEffectiveDateDashboardData } from '@/lib/effective-date-service';
import type {
  EffectiveDateRecord, EffectiveDateKpis, EffectiveDateCharts, EffectiveDateFilters, EffectiveDateActor,
} from '@/lib/effective-date-types';
import {
  canViewEffectiveDates, canManageEffectiveDates, canApproveOverride,
  canExportEffectiveDates, isEffectiveDateReadOnly, canBulkActivate,
  isEmployeeEffectiveDateView,
} from '@/lib/effective-date-types';
import { emptyEffectiveDateKpis, emptyEffectiveDateCharts, computeEffectiveDateKpis, computeEffectiveDateCharts } from '@/lib/effective-date-records';

const PAGE_SIZE = 20;

export function useEffectiveDateManagement(initialFilters?: EffectiveDateFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<EffectiveDateFilters>(initialFilters || {});
  const [records, setRecords] = useState<EffectiveDateRecord[]>([]);
  const [metrics, setMetrics] = useState<EffectiveDateKpis>(emptyEffectiveDateKpis());
  const [charts, setCharts] = useState<EffectiveDateCharts>(emptyEffectiveDateCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: EffectiveDateActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewEffectiveDates(role)) {
        setRecords([]); setMetrics(emptyEffectiveDateKpis()); setCharts(emptyEffectiveDateCharts());
        return;
      }
      const data = await fetchEffectiveDateDashboardData(filters);
      const rows = isEmployeeEffectiveDateView(role)
        ? data.records.filter((r) => r.activation_status === 'Activated')
        : data.records;
      setRecords(rows);
      setMetrics(isEmployeeEffectiveDateView(role) ? computeEffectiveDateKpis(rows) : data.metrics);
      setCharts(isEmployeeEffectiveDateView(role) ? computeEffectiveDateCharts(rows) : data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load effective dates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role]);

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
    canManage: canManageEffectiveDates(role),
    canOverride: canApproveOverride(role),
    canBulk: canBulkActivate(role),
    canExport: canExportEffectiveDates(role),
    isReadOnly: isEffectiveDateReadOnly(role),
    canView: canViewEffectiveDates(role),
  };
}
