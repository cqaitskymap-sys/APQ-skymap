'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchPrintControlDashboardData } from '@/lib/print-control-service';
import type {
  PrintRequestRecord, PrintCopyRecord, PrintControlKpis, PrintControlCharts,
  PrintControlFilters, PrintControlActor,
} from '@/lib/print-control-types';
import {
  canViewPrintControl, canManagePrintControl, canApprovePrintControl,
  canExportPrintControl, isPrintControlReadOnly, isEmployeeAssignedView,
} from '@/lib/print-control-types';
import { emptyPrintKpis, emptyPrintCharts } from '@/lib/print-control-records';

const PAGE_SIZE = 20;

export function usePrintControlManagement(initialFilters?: PrintControlFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<PrintControlFilters>(initialFilters || {});
  const [requests, setRequests] = useState<PrintRequestRecord[]>([]);
  const [copies, setCopies] = useState<PrintCopyRecord[]>([]);
  const [metrics, setMetrics] = useState<PrintControlKpis>(emptyPrintKpis());
  const [charts, setCharts] = useState<PrintControlCharts>(emptyPrintCharts());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: PrintControlActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const deptOnly = role.includes('manager') && !canManagePrintControl(role);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewPrintControl(role)) {
        setRequests([]); setCopies([]); setMetrics(emptyPrintKpis()); setCharts(emptyPrintCharts());
        return;
      }
      const appliedFilters = deptOnly && actor.department
        ? { ...filters, department_only: actor.department }
        : filters;
      const data = await fetchPrintControlDashboardData(appliedFilters);
      let reqs = data.requests;
      let cps = data.copies;
      if (isEmployeeAssignedView(role)) {
        cps = cps.filter((c) => c.issued_to === actor.id);
        const reqIds = new Set(cps.map((c) => c.print_request_id));
        reqs = reqs.filter((r) => reqIds.has(r.id));
      }
      setRequests(reqs);
      setCopies(cps);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load print control data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, deptOnly, actor.department, actor.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const paginatedRequests = requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    requests, paginatedRequests, copies, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor,
    page, setPage, pageSize: PAGE_SIZE, totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: requests.length, totalPages },
    selectedIds,
    toggleSelect: (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]),
    toggleSelectAll: () => {
      const pageIds = paginatedRequests.map((r) => r.id);
      const all = pageIds.every((id) => selectedIds.includes(id));
      setSelectedIds(all ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
    },
    clearSelection: () => setSelectedIds([]),
    canManage: canManagePrintControl(role),
    canApprove: canApprovePrintControl(role),
    canExport: canExportPrintControl(role),
    isReadOnly: isPrintControlReadOnly(role),
    canView: canViewPrintControl(role),
    deptOnly,
  };
}
