'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchApprovalDashboardData, logApprovalDashboardViewed } from '@/lib/document-approval-service';
import type {
  DocumentApprovalRecord, ApprovalKpis, ApprovalCharts, ApprovalFilters, ApprovalActor,
} from '@/lib/document-approval-types';
import {
  canViewApprovals, canManageApprovals, canApproveDocuments, canExportApprovals,
  canDesignApprovalWorkflows, isApprovalReadOnly, canViewAssignedApprovalsOnly, canBulkApprove,
} from '@/lib/document-approval-types';
import { emptyApprovalKpis, emptyApprovalCharts } from '@/lib/document-approval-records';

const PAGE_SIZE = 20;

export function useDocumentApproval(initialFilters?: ApprovalFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<ApprovalFilters>(initialFilters || {});
  const [records, setRecords] = useState<DocumentApprovalRecord[]>([]);
  const [metrics, setMetrics] = useState<ApprovalKpis>(emptyApprovalKpis());
  const [charts, setCharts] = useState<ApprovalCharts>(emptyApprovalCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: ApprovalActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewApprovals(role) && !canViewAssignedApprovalsOnly(role)) {
        setRecords([]); setMetrics(emptyApprovalKpis()); setCharts(emptyApprovalCharts());
        return;
      }
      const data = await fetchApprovalDashboardData(filters, actor);
      setRecords(data.records);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
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
    canManage: canManageApprovals(role),
    canApprove: canApproveDocuments(role),
    canExport: canExportApprovals(role),
    canDesign: canDesignApprovalWorkflows(role),
    canBulk: canBulkApprove(role),
    isReadOnly: isApprovalReadOnly(role),
    assignedOnly: canViewAssignedApprovalsOnly(role),
    canView: canViewApprovals(role) || canViewAssignedApprovalsOnly(role),
  };
}
