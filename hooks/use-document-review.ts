'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchReviewDashboardData, logReviewDashboardViewed } from '@/lib/document-review-service';
import type {
  DocumentReviewRecord, ReviewKpis, ReviewCharts, ReviewFilters, ReviewActor,
} from '@/lib/document-review-types';
import {
  canViewReviews, canManageReviews, canCompleteReviews, canExportReviews,
  canDesignWorkflows, isReviewReadOnly, canViewAssignedOnly,
} from '@/lib/document-review-types';
import { emptyReviewKpis, emptyReviewCharts } from '@/lib/document-review-records';

const PAGE_SIZE = 20;

export function useDocumentReview(initialFilters?: ReviewFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<ReviewFilters>(initialFilters || {});
  const [records, setRecords] = useState<DocumentReviewRecord[]>([]);
  const [metrics, setMetrics] = useState<ReviewKpis>(emptyReviewKpis());
  const [charts, setCharts] = useState<ReviewCharts>(emptyReviewCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: ReviewActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewReviews(role) && !canViewAssignedOnly(role)) {
        setRecords([]); setMetrics(emptyReviewKpis()); setCharts(emptyReviewCharts());
        return;
      }
      const data = await fetchReviewDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, actor, role]);

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
    logViewed: useCallback(() => logReviewDashboardViewed(actor), [actor]),
    canManage: canManageReviews(role),
    canComplete: canCompleteReviews(role),
    canExport: canExportReviews(role),
    canDesign: canDesignWorkflows(role),
    isReadOnly: isReviewReadOnly(role),
    assignedOnly: canViewAssignedOnly(role),
    canView: canViewReviews(role) || canViewAssignedOnly(role),
  };
}
