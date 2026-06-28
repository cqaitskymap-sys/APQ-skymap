'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchPeriodicReviewDashboardData } from '@/lib/periodic-review-service';
import type {
  PeriodicReviewRecord, PeriodicReviewKpis, PeriodicReviewCharts, PeriodicReviewFilters, PeriodicReviewActor,
} from '@/lib/periodic-review-types';
import {
  canViewPeriodicReviews, canManagePeriodicReviews, canApprovePeriodicReview,
  canExportPeriodicReviews, isPeriodicReviewReadOnly, canBulkScheduleReviews,
  isReviewerOnly, isEmployeeEffectiveView,
} from '@/lib/periodic-review-types';
import {
  emptyPeriodicReviewKpis, emptyPeriodicReviewCharts,
  computePeriodicReviewKpis, computePeriodicReviewCharts,
} from '@/lib/periodic-review-records';

const PAGE_SIZE = 20;

export function usePeriodicReviewManagement(initialFilters?: PeriodicReviewFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<PeriodicReviewFilters>(initialFilters || {});
  const [records, setRecords] = useState<PeriodicReviewRecord[]>([]);
  const [metrics, setMetrics] = useState<PeriodicReviewKpis>(emptyPeriodicReviewKpis());
  const [charts, setCharts] = useState<PeriodicReviewCharts>(emptyPeriodicReviewCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: PeriodicReviewActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const assignedOnly = isReviewerOnly(role);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewPeriodicReviews(role)) {
        setRecords([]); setMetrics(emptyPeriodicReviewKpis()); setCharts(emptyPeriodicReviewCharts());
        return;
      }
      const appliedFilters = assignedOnly && actor.id
        ? { ...filters, assigned_to_me: actor.id }
        : filters;
      const data = await fetchPeriodicReviewDashboardData(appliedFilters);
      let rows = data.records;
      if (isEmployeeEffectiveView(role)) {
        rows = rows.filter((r) => r.status === 'Completed');
      }
      setRecords(rows);
      setMetrics(isEmployeeEffectiveView(role) ? computePeriodicReviewKpis(rows) : data.metrics);
      setCharts(isEmployeeEffectiveView(role) ? computePeriodicReviewCharts(rows) : data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load periodic reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, assignedOnly, actor.id]);

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
    canManage: canManagePeriodicReviews(role),
    canApprove: canApprovePeriodicReview(role),
    canBulk: canBulkScheduleReviews(role),
    canExport: canExportPeriodicReviews(role),
    isReadOnly: isPeriodicReviewReadOnly(role),
    canView: canViewPeriodicReviews(role),
    assignedOnly,
  };
}
