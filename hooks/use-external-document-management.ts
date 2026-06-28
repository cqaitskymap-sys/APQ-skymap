'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchExternalDocumentDashboardData } from '@/lib/external-document-service';
import type {
  ExternalDocumentRecord, ExternalDocumentReview, ExternalDocumentKpis,
  ExternalDocumentCharts, ExternalDocumentFilters, ExternalDocumentActor,
} from '@/lib/external-document-types';
import {
  canViewExternalDocuments, canManageExternalDocuments, canApproveExternalDocument,
  canExportExternalDocuments, isExternalDocumentReadOnly, isEmployeeApprovedView,
} from '@/lib/external-document-types';
import { emptyExternalKpis, emptyExternalCharts } from '@/lib/external-document-records';

const PAGE_SIZE = 20;

export function useExternalDocumentManagement(initialFilters?: ExternalDocumentFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<ExternalDocumentFilters>(initialFilters || {});
  const [records, setRecords] = useState<ExternalDocumentRecord[]>([]);
  const [reviews, setReviews] = useState<ExternalDocumentReview[]>([]);
  const [metrics, setMetrics] = useState<ExternalDocumentKpis>(emptyExternalKpis());
  const [charts, setCharts] = useState<ExternalDocumentCharts>(emptyExternalCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: ExternalDocumentActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const deptOnly = role.includes('manager') && !canManageExternalDocuments(role);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewExternalDocuments(role)) {
        setRecords([]); setReviews([]); setMetrics(emptyExternalKpis()); setCharts(emptyExternalCharts());
        return;
      }
      const appliedFilters = deptOnly && actor.department
        ? { ...filters, department_only: actor.department }
        : filters;
      const data = await fetchExternalDocumentDashboardData(appliedFilters);
      let rows = data.records;
      if (isEmployeeApprovedView(role)) {
        rows = rows.filter((r) => ['Approved for Use', 'Effective'].includes(r.status));
      }
      setRecords(rows);
      setReviews(data.reviews);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load external documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, deptOnly, actor.department]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paginatedRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    records, paginatedRecords, reviews, metrics, charts, filters, setFilters,
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
    canManage: canManageExternalDocuments(role),
    canApprove: canApproveExternalDocument(role),
    canExport: canExportExternalDocuments(role),
    isReadOnly: isExternalDocumentReadOnly(role),
    canView: canViewExternalDocuments(role),
    deptOnly,
  };
}
