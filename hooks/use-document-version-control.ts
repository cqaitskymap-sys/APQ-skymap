'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchVersionControlDashboardData, logVersionDashboardViewed } from '@/lib/document-version-control-service';
import type {
  DocumentVersionRecord, VersionControlKpis, VersionControlCharts,
  VersionControlFilters, VersionControlActor,
} from '@/lib/document-version-control-types';
import {
  canManageVersions, canCreateRevisions, canReviewVersions, canApproveVersions,
  canExportVersions, canRollback, isVersionReadOnly, canViewHistoricalOnly,
} from '@/lib/document-version-control-types';
import { emptyVersionKpis, emptyVersionCharts } from '@/lib/document-version-control-records';

const PAGE_SIZE = 20;

export function useDocumentVersionControl(initialFilters?: VersionControlFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<VersionControlFilters>(initialFilters || { latest_only: false });
  const [records, setRecords] = useState<DocumentVersionRecord[]>([]);
  const [metrics, setMetrics] = useState<VersionControlKpis>(emptyVersionKpis());
  const [charts, setCharts] = useState<VersionControlCharts>(emptyVersionCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: VersionControlActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchVersionControlDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load versions');
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
    logViewed: useCallback(() => logVersionDashboardViewed(actor), [actor]),
    canManage: canManageVersions(role),
    canCreate: canCreateRevisions(role),
    canReview: canReviewVersions(role),
    canApprove: canApproveVersions(role),
    canExport: canExportVersions(role),
    canRollback: canRollback(role),
    isReadOnly: isVersionReadOnly(role),
    historicalOnly: canViewHistoricalOnly(role),
  };
}
