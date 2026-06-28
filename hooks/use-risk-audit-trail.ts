'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  applyRiskAuditFilters,
  computeRiskAuditDashboard,
  paginateRiskAuditEntries,
  type RiskAuditEntry,
} from '@/lib/risk-audit-trail-records';
import {
  getFilteredRiskAuditTrail,
  logRiskAuditPreviewed,
} from '@/lib/risk-audit-trail-service';
import { fetchRiskAssessmentById } from '@/lib/cpv-risk-assessment-service';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import {
  canViewRiskAuditTrailModule,
  canExportRiskAuditTrailModule,
  isRiskAuditTrailReadOnly,
  type RiskAuditFilters,
  type RiskAuditActor,
} from '@/lib/risk-audit-trail-types';

const PAGE_SIZE = 20;

export function useRiskAuditTrail(options?: {
  riskId?: string;
  logPreview?: boolean;
}) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const riskId = options?.riskId;

  const actor: RiskAuditActor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const [record, setRecord] = useState<RiskAssessmentRecord | null>(null);
  const [allEntries, setAllEntries] = useState<RiskAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const previewLogged = useRef(false);

  const [filters, setFilters] = useState<RiskAuditFilters>({});

  const load = useCallback(async () => {
    if (!canViewRiskAuditTrailModule(role)) {
      setError('You do not have permission to view risk audit trail');
      setLoading(false);
      return;
    }
    if (riskId === '') {
      setError('Risk assessment ID is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let riskNumber: string | undefined;
      if (riskId) {
        const risk = await fetchRiskAssessmentById(riskId);
        if (!risk) {
          setError('Risk assessment not found');
          setRecord(null);
          setAllEntries([]);
          return;
        }
        setRecord(risk);
        riskNumber = risk.riskNumber;
      } else {
        setRecord(null);
      }

      const rows = await getFilteredRiskAuditTrail({
        riskId,
        riskNumber,
        role,
        filters: {},
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [riskId, role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (
      options?.logPreview !== false
      && record
      && riskId
      && !previewLogged.current
    ) {
      previewLogged.current = true;
      void logRiskAuditPreviewed(actor, riskId, record.riskNumber);
    }
  }, [record, riskId, actor, options?.logPreview]);

  const entries = useMemo(
    () => applyRiskAuditFilters(allEntries, filters),
    [allEntries, filters],
  );
  const dashboard = useMemo(() => computeRiskAuditDashboard(entries), [entries]);
  const paginated = useMemo(
    () => paginateRiskAuditEntries(entries, page, PAGE_SIZE),
    [entries, page],
  );

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()],
    [allEntries],
  );

  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of allEntries) {
      if (e.changed_by) map.set(e.changed_by, e.changed_by_name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEntries]);

  const updateFilters = useCallback((patch: Partial<RiskAuditFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  return {
    record,
    allEntries,
    entries,
    dashboard,
    paginated,
    filters,
    setFilters,
    updateFilters,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    loading,
    error,
    refresh: load,
    actor,
    role,
    departments,
    users,
    canView: canViewRiskAuditTrailModule(role),
    canExport: canExportRiskAuditTrailModule(role),
    isReadOnly: isRiskAuditTrailReadOnly(role),
  };
}

export type { RiskAuditFilters, RiskAuditEntry };
