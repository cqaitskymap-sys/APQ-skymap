'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchLifecycleDashboardData,
  logLifecycleDashboardViewed,
  logLifecycleDashboardRefreshed,
} from '@/lib/document-lifecycle-service';
import type {
  DocumentLifecycleRecord,
  DocumentLifecycleKpis,
  DocumentLifecycleCharts,
  DocumentLifecycleFilters,
  DocumentLifecycleActor,
} from '@/lib/document-lifecycle-types';
import {
  canManageLifecycle,
  canReviewLifecycle,
  canApproveLifecycle,
  canCreateDraft,
  canExportLifecycle,
  canBulkLifecycleActions,
  isLifecycleReadOnly,
  canReadEffectiveOnly,
} from '@/lib/document-lifecycle-types';
import { emptyLifecycleKpis, emptyLifecycleCharts } from '@/lib/document-lifecycle-records';

const PAGE_SIZE = 20;

export function useDocumentLifecycle(initialFilters?: DocumentLifecycleFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [filters, setFilters] = useState<DocumentLifecycleFilters>(initialFilters || {});
  const [records, setRecords] = useState<DocumentLifecycleRecord[]>([]);
  const [metrics, setMetrics] = useState<DocumentLifecycleKpis>(emptyLifecycleKpis());
  const [charts, setCharts] = useState<DocumentLifecycleCharts>(emptyLifecycleCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: DocumentLifecycleActor = useMemo(() => ({
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
      const data = await fetchLifecycleDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
      if (isRefresh) await logLifecycleDashboardRefreshed(actor, data.records.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lifecycle data');
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

  const logViewed = useCallback(() => logLifecycleDashboardViewed(actor), [actor]);

  return {
    records,
    paginatedRecords,
    metrics,
    charts,
    filters,
    setFilters,
    loading,
    refreshing,
    error,
    refresh,
    actor,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: records.length, totalPages },
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    logViewed,
    canManage: canManageLifecycle(role),
    canReview: canReviewLifecycle(role),
    canApprove: canApproveLifecycle(role),
    canCreate: canCreateDraft(role),
    canExport: canExportLifecycle(role),
    canBulk: canBulkLifecycleActions(role),
    isReadOnly: isLifecycleReadOnly(role),
    effectiveOnly: canReadEffectiveOnly(role),
  };
}
