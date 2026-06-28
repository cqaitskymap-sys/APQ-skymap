'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchDistributionDashboardData, logDistributionDashboardViewed } from '@/lib/controlled-distribution-service';
import type {
  ControlledDistributionRecord, DistributionKpis, DistributionCharts, DistributionFilters, DistributionActor,
} from '@/lib/controlled-distribution-types';
import {
  canManageDistribution, canCreateDistribution, canReviewDistribution, canDeptDistribute,
  canExportDistribution, canBulkDistribute, isDistributionReadOnly, canViewAssignedOnly,
} from '@/lib/controlled-distribution-types';
import { emptyDistributionKpis, emptyDistributionCharts } from '@/lib/controlled-distribution-records';

const PAGE_SIZE = 20;

export function useControlledDistribution(initialFilters?: DistributionFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<DistributionFilters>(initialFilters || {});
  const [records, setRecords] = useState<ControlledDistributionRecord[]>([]);
  const [metrics, setMetrics] = useState<DistributionKpis>(emptyDistributionKpis());
  const [charts, setCharts] = useState<DistributionCharts>(emptyDistributionCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: DistributionActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchDistributionDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load distributions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, actor]);

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
    logViewed: useCallback(() => logDistributionDashboardViewed(actor), [actor]),
    canManage: canManageDistribution(role),
    canCreate: canCreateDistribution(role),
    canReview: canReviewDistribution(role),
    canDeptDistribute: canDeptDistribute(role),
    canExport: canExportDistribution(role),
    canBulk: canBulkDistribute(role),
    isReadOnly: isDistributionReadOnly(role),
    assignedOnly: canViewAssignedOnly(role),
  };
}
