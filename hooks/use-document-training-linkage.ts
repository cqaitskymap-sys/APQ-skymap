'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchTrainingLinkageDashboardData } from '@/lib/document-training-linkage-service';
import type {
  DocumentTrainingLinkRecord, TrainingLinkageKpis, TrainingLinkageCharts,
  TrainingLinkageFilters, TrainingLinkageActor,
} from '@/lib/document-training-linkage-types';
import {
  canViewTrainingLinkage, canManageTrainingLinkage, canReviewTrainingCompliance,
  canExportTrainingLinkage, isTrainingLinkageReadOnly, canBulkAssignTraining,
  isEmployeeTrainingView,
} from '@/lib/document-training-linkage-types';
import {
  emptyTrainingLinkageKpis, emptyTrainingLinkageCharts,
  computeTrainingLinkageKpis, computeTrainingLinkageCharts,
} from '@/lib/document-training-linkage-records';

const PAGE_SIZE = 20;

export function useDocumentTrainingLinkage(initialFilters?: TrainingLinkageFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<TrainingLinkageFilters>(initialFilters || {});
  const [records, setRecords] = useState<DocumentTrainingLinkRecord[]>([]);
  const [metrics, setMetrics] = useState<TrainingLinkageKpis>(emptyTrainingLinkageKpis());
  const [charts, setCharts] = useState<TrainingLinkageCharts>(emptyTrainingLinkageCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: TrainingLinkageActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewTrainingLinkage(role)) {
        setRecords([]); setMetrics(emptyTrainingLinkageKpis()); setCharts(emptyTrainingLinkageCharts());
        return;
      }
      const data = await fetchTrainingLinkageDashboardData(filters);
      let rows = data.records;
      if (isEmployeeTrainingView(role) && actor.id) {
        rows = rows.filter((r) => r.assigned_employees.includes(actor.id));
      }
      setRecords(rows);
      setMetrics(isEmployeeTrainingView(role) ? computeTrainingLinkageKpis(rows) : data.metrics);
      setCharts(isEmployeeTrainingView(role) ? computeTrainingLinkageCharts(rows) : data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training linkage');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, actor.id]);

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
    canManage: canManageTrainingLinkage(role),
    canReview: canReviewTrainingCompliance(role),
    canBulk: canBulkAssignTraining(role),
    canExport: canExportTrainingLinkage(role),
    isReadOnly: isTrainingLinkageReadOnly(role),
    canView: canViewTrainingLinkage(role),
  };
}
