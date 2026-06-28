'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  loadDocumentMasterData,
  paginateRecords,
  logDocumentMasterViewed,
  type DocumentMasterData,
} from '@/lib/document-master-service';
import type { DocumentMasterFilters } from '@/lib/document-master-types';
import {
  canViewDocumentMaster,
  canCreateDocumentMaster,
  canEditDocumentMaster,
  canReviewDocumentMaster,
  canApproveDocumentMaster,
  canArchiveDocumentMaster,
  canBulkDocumentMaster,
  canExportDocumentMaster,
  isDocumentMasterReadOnly,
  canViewEffectiveOnly,
} from '@/lib/document-master-types';

const DEFAULT_PAGE_SIZE = 15;

export function useDocumentMaster(initialFilters?: DocumentMasterFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const [filters, setFilters] = useState<DocumentMasterFilters>(initialFilters ?? {});
  const [data, setData] = useState<DocumentMasterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const refresh = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await loadDocumentMasterData(filters, role);
      setData(result);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load document master data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role]);

  useEffect(() => { void refresh(); }, [refresh]);

  const pagination = useMemo(() => {
    if (!data) return { rows: [], totalPages: 1, total: 0 };
    return paginateRecords(data.records, page, pageSize);
  }, [data, page, pageSize]);

  const favorites = useMemo(
    () => data?.records.filter((r) => r.is_favorite) ?? [],
    [data?.records],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => (prev.length === ids.length ? [] : ids));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  return {
    data,
    filters,
    setFilters,
    loading,
    refreshing,
    error,
    refresh,
    actor,
    role,
    page,
    setPage,
    pageSize,
    setPageSize,
    pagination,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    favorites,
    canView: canViewDocumentMaster(role),
    canCreate: canCreateDocumentMaster(role),
    canEdit: (record?: Parameters<typeof canEditDocumentMaster>[1]) =>
      canEditDocumentMaster(role, record, actor.id),
    canReview: canReviewDocumentMaster(role),
    canApprove: canApproveDocumentMaster(role),
    canArchive: canArchiveDocumentMaster(role),
    canBulk: canBulkDocumentMaster(role),
    canExport: canExportDocumentMaster(role),
    isReadOnly: isDocumentMasterReadOnly(role),
    effectiveOnly: canViewEffectiveOnly(role),
    logViewed: () => logDocumentMasterViewed(actor),
  };
}
