'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchSopDashboardData, logSopDashboardViewed } from '@/lib/sop-service';
import type { SopMasterRecord, SopKpis, SopCharts, SopFilters, SopActor } from '@/lib/sop-types';
import {
  canManageSop, canReviewSop, canApproveSop, canCreateSop,
  canExportSop, canBulkSop, isSopReadOnly, canReadEffectiveSopOnly,
} from '@/lib/sop-types';
import { emptySopKpis, emptySopCharts } from '@/lib/sop-records';

const PAGE_SIZE = 20;

export function useSopManagement(initialFilters?: SopFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [filters, setFilters] = useState<SopFilters>(initialFilters || {});
  const [records, setRecords] = useState<SopMasterRecord[]>([]);
  const [metrics, setMetrics] = useState<SopKpis>(emptySopKpis());
  const [charts, setCharts] = useState<SopCharts>(emptySopCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: SopActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchSopDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SOP data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, actor]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paginatedRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedRecords.map((r) => r.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
  };

  const clearSelection = () => setSelectedIds([]);

  const logViewed = useCallback(() => logSopDashboardViewed(actor), [actor]);

  return {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage,
    pageSize: PAGE_SIZE, totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: records.length, totalPages },
    selectedIds, toggleSelect, toggleSelectAll, clearSelection, logViewed,
    canManage: canManageSop(role), canReview: canReviewSop(role),
    canApprove: canApproveSop(role), canCreate: canCreateSop(role),
    canExport: canExportSop(role), canBulk: canBulkSop(role),
    isReadOnly: isSopReadOnly(role), effectiveOnly: canReadEffectiveSopOnly(role),
  };
}
