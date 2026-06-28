'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchRiskDashboardAnalytics,
  fetchRiskExportHistory,
  fetchRiskReportOwnerOptions,
  fetchRiskReportProductOptions,
  fetchRiskReportRecords,
} from '@/lib/risk-reports-service';
import type { RiskReportRecord } from '@/lib/risk-reports-records';
import type {
  RiskManagementReviewSummary,
  RiskReportAnalyticsMetrics,
  RiskReportChartData,
} from '@/lib/risk-reports-records';
import {
  canViewRiskReportsModule,
  canGenerateRiskReportsModule,
  canExportRiskReportsModule,
  canViewManagementReviewModule,
  isRiskReportsReadOnlyModule,
  type RiskReportActor,
} from '@/lib/risk-reports-types';

export function useRiskReports() {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const actor: RiskReportActor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RiskReportRecord[]>([]);
  const [exportHistory, setExportHistory] = useState<RiskReportRecord[]>([]);
  const [products, setProducts] = useState<string[]>(['All']);
  const [owners, setOwners] = useState<string[]>(['All']);
  const [dashboardMetrics, setDashboardMetrics] = useState<RiskReportAnalyticsMetrics | null>(null);
  const [dashboardCharts, setDashboardCharts] = useState<RiskReportChartData | null>(null);
  const [managementReview, setManagementReview] = useState<RiskManagementReviewSummary | null>(null);

  const refresh = useCallback(async () => {
    if (!canViewRiskReportsModule(role)) {
      setError('You do not have permission to view risk reports');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, prods, ownerOpts, dash, exports] = await Promise.all([
        fetchRiskReportRecords(),
        fetchRiskReportProductOptions(),
        fetchRiskReportOwnerOptions(),
        fetchRiskDashboardAnalytics(),
        fetchRiskExportHistory(),
      ]);
      setHistory(rows);
      setProducts(prods);
      setOwners(ownerOpts);
      setDashboardMetrics(dash.metrics);
      setDashboardCharts(dash.charts);
      setManagementReview(dash.managementReview);
      setExportHistory(exports);
    } catch {
      setError('Failed to load risk reports and analytics.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    loading,
    error,
    history,
    exportHistory,
    products,
    owners,
    dashboardMetrics,
    dashboardCharts,
    managementReview,
    refresh,
    actor,
    role,
    canView: canViewRiskReportsModule(role),
    canGenerate: canGenerateRiskReportsModule(role),
    canExport: canExportRiskReportsModule(role),
    canManagement: canViewManagementReviewModule(role),
    isReadOnly: isRiskReportsReadOnlyModule(role),
  };
}

export type { RiskReportActor };
