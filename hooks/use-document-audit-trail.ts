'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchDocumentAuditDashboard } from '@/lib/document-audit-trail-service';
import type {
  DocumentAuditEntry, DocumentAuditKpis, DocumentAuditCharts, DocumentAuditFilters,
  DocumentAuditActor, AuditExportRecord,
} from '@/lib/document-audit-trail-types';
import {
  canViewDocumentAuditTrail, canExportDocumentAuditTrail, isDocumentAuditReadOnly,
} from '@/lib/document-audit-trail-types';
import { emptyDocumentAuditKpis, emptyDocumentAuditCharts, paginateAuditEntries } from '@/lib/document-audit-trail-records';

const PAGE_SIZE = 25;

export function useDocumentAuditTrail(initialFilters?: DocumentAuditFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const [filters, setFilters] = useState<DocumentAuditFilters>(initialFilters || {});
  const [entries, setEntries] = useState<DocumentAuditEntry[]>([]);
  const [exports, setExports] = useState<AuditExportRecord[]>([]);
  const [metrics, setMetrics] = useState<DocumentAuditKpis>(emptyDocumentAuditKpis());
  const [charts, setCharts] = useState<DocumentAuditCharts>(emptyDocumentAuditCharts());
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [tamperCount, setTamperCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [inspectionMode, setInspectionMode] = useState(false);

  const actor: DocumentAuditActor = useMemo(() => ({
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (!canViewDocumentAuditTrail(role)) {
        setEntries([]); setExports([]); setMetrics(emptyDocumentAuditKpis());
        setCharts(emptyDocumentAuditCharts()); setUsers([]);
        return;
      }
      const data = await fetchDocumentAuditDashboard({
        role, userId: actor.id, department: actor.department, filters,
      });
      setEntries(data.entries);
      setExports(data.exports);
      setMetrics(data.metrics);
      setCharts(data.charts);
      setUsers(data.users);
      setTamperCount(data.tamperCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, role, actor.id, actor.department]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = paginateAuditEntries(entries, page, PAGE_SIZE);

  return {
    entries, paginatedEntries, exports, metrics, charts, users, tamperCount,
    filters, setFilters, loading, refreshing, error, refresh, actor,
    page, setPage, pageSize: PAGE_SIZE, totalPages,
    pagination: { page, pageSize: PAGE_SIZE, total: entries.length, totalPages },
    inspectionMode, setInspectionMode,
    canExport: canExportDocumentAuditTrail(role),
    isReadOnly: isDocumentAuditReadOnly(role),
    canView: canViewDocumentAuditTrail(role),
  };
}
