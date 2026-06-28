'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchFormsDashboardData, logFormsDashboardViewed } from '@/lib/forms-templates-service';
import type { FormTemplateRecord, FormKpis, FormCharts, FormFilters, FormActor } from '@/lib/forms-templates-types';
import { canManageForms, canReviewForms, canApproveForms, canCreateForms, canExportForms, canBulkForms, isFormsReadOnly, canReadEffectiveFormsOnly } from '@/lib/forms-templates-types';
import { emptyFormKpis, emptyFormCharts } from '@/lib/forms-templates-records';

const PAGE_SIZE = 20;

export function useFormsTemplates(initialFilters?: FormFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<FormFilters>(initialFilters || {});
  const [records, setRecords] = useState<FormTemplateRecord[]>([]);
  const [metrics, setMetrics] = useState<FormKpis>(emptyFormKpis());
  const [charts, setCharts] = useState<FormCharts>(emptyFormCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: FormActor = useMemo(() => ({
    id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown User', role, department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchFormsDashboardData(filters, actor);
      setRecords(data.records); setMetrics(data.metrics); setCharts(data.charts);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load forms'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filters, actor]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paginatedRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    records, paginatedRecords, metrics, charts, filters, setFilters, loading, refreshing, error, refresh, actor,
    page, setPage, pageSize: PAGE_SIZE, totalPages, pagination: { page, pageSize: PAGE_SIZE, total: records.length, totalPages },
    selectedIds,
    toggleSelect: (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]),
    toggleSelectAll: () => {
      const pageIds = paginatedRecords.map((r) => r.id);
      const all = pageIds.every((id) => selectedIds.includes(id));
      setSelectedIds(all ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
    },
    clearSelection: () => setSelectedIds([]),
    logViewed: useCallback(() => logFormsDashboardViewed(actor), [actor]),
    canManage: canManageForms(role), canReview: canReviewForms(role), canApprove: canApproveForms(role),
    canCreate: canCreateForms(role), canExport: canExportForms(role), canBulk: canBulkForms(role),
    isReadOnly: isFormsReadOnly(role), effectiveOnly: canReadEffectiveFormsOnly(role),
  };
}
