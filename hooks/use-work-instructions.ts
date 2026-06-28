'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchWiDashboardData, logWiDashboardViewed } from '@/lib/wi-service';
import type { WorkInstructionRecord, WiKpis, WiCharts, WiFilters, WiActor } from '@/lib/wi-types';
import {
  canManageWi, canReviewWi, canApproveWi, canCreateWi,
  canExportWi, canBulkWi, isWiReadOnly, canReadEffectiveWiOnly,
} from '@/lib/wi-types';
import { emptyWiKpis, emptyWiCharts } from '@/lib/wi-records';

const PAGE_SIZE = 20;

export function useWorkInstructions(initialFilters?: WiFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [filters, setFilters] = useState<WiFilters>(initialFilters || {});
  const [records, setRecords] = useState<WorkInstructionRecord[]>([]);
  const [metrics, setMetrics] = useState<WiKpis>(emptyWiKpis());
  const [charts, setCharts] = useState<WiCharts>(emptyWiCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: WiActor = useMemo(() => ({
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
      const data = await fetchWiDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work instructions');
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

  return {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage,
    pageSize: PAGE_SIZE, totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: records.length, totalPages },
    selectedIds, toggleSelect, toggleSelectAll,
    clearSelection: () => setSelectedIds([]),
    logViewed: useCallback(() => logWiDashboardViewed(actor), [actor]),
    canManage: canManageWi(role), canReview: canReviewWi(role),
    canApprove: canApproveWi(role), canCreate: canCreateWi(role),
    canExport: canExportWi(role), canBulk: canBulkWi(role),
    isReadOnly: isWiReadOnly(role), effectiveOnly: canReadEffectiveWiOnly(role),
  };
}
