'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchChangeImpactDashboardData } from '@/lib/change-impact-assessment-service';
import type {
  DocumentChangeImpactRecord, ChangeImpactKpis, ChangeImpactCharts,
  ChangeImpactFilters, ChangeImpactActor,
} from '@/lib/change-impact-assessment-types';
import {
  canViewChangeImpact, canManageChangeImpact, canApproveChangeImpact,
  canExportChangeImpact, isChangeImpactReadOnly, canBulkAssessChangeImpact,
} from '@/lib/change-impact-assessment-types';
import { emptyChangeImpactKpis, emptyChangeImpactCharts } from '@/lib/change-impact-assessment-records';

const PAGE_SIZE = 20;

export function useChangeImpactAssessment(initialFilters?: ChangeImpactFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<ChangeImpactFilters>(initialFilters || {});
  const [records, setRecords] = useState<DocumentChangeImpactRecord[]>([]);
  const [metrics, setMetrics] = useState<ChangeImpactKpis>(emptyChangeImpactKpis());
  const [charts, setCharts] = useState<ChangeImpactCharts>(emptyChangeImpactCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: ChangeImpactActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewChangeImpact(role)) {
        setRecords([]); setMetrics(emptyChangeImpactKpis()); setCharts(emptyChangeImpactCharts());
        return;
      }
      const data = await fetchChangeImpactDashboardData(filters);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load impact assessments');
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
    canManage: canManageChangeImpact(role),
    canApprove: canApproveChangeImpact(role),
    canBulk: canBulkAssessChangeImpact(role),
    canExport: canExportChangeImpact(role),
    isReadOnly: isChangeImpactReadOnly(role),
    canView: canViewChangeImpact(role),
  };
}
