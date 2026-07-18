'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchTrainingReportsDashboard, generateTrainingReport, logTrainingReportViewed,
  getReportTemplates, getReportSchedules,
} from '@/lib/training-reports-service';
import {
  canViewTrainingReports, canGenerateTrainingReports, canExportTrainingReports,
  isTrainingReportsReadOnly, type TrainingReportFilters, type TrainingReportAnalytics,
  type TrainingReportTemplate, type TrainingReportSchedule,
} from '@/lib/training-reports-records';

const defaultFrom = () => `${new Date().getFullYear()}-01-01`;
const defaultTo = () => new Date().toISOString().split('T')[0];

export function useTrainingReports(initialFilters?: TrainingReportFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [filters, setFilters] = useState<TrainingReportFilters>({
    date_from: defaultFrom(),
    date_to: defaultTo(),
    report_type: 'Training Compliance Report',
    ...initialFilters,
  });
  const [analytics, setAnalytics] = useState<(TrainingReportAnalytics & {
    employees?: { id: string; name: string }[];
    trainers?: string[];
  }) | null>(null);
  const [templates, setTemplates] = useState<TrainingReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<TrainingReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewTrainingReports(role)) {
      setError('You do not have permission to view Training Reports');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrainingReportsDashboard({
        role, userId: user?.uid, userDepartment: profile?.department, filters,
      });
      setAnalytics(data);
      if (user?.uid) {
        setTemplates(getReportTemplates(user.uid));
        setSchedules(getReportSchedules(user.uid));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [role, user?.uid, profile?.department, filters]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (canViewTrainingReports(role)) {
      logTrainingReportViewed(actor, filters.report_type).catch(() => {});
    }
  }, [role, actor, filters.report_type]);

  const generate = useCallback(async (overrideFilters?: TrainingReportFilters) => {
    setGenerating(true);
    try {
      const f = overrideFilters || filters;
      const result = await generateTrainingReport(f, actor, role, profile?.department);
      setAnalytics(result);
      return result;
    } finally {
      setGenerating(false);
    }
  }, [filters, actor, role, profile?.department]);

  return {
    filters, setFilters, analytics, templates, schedules,
    loading, generating, error, actor, refresh, generate,
    canView: canViewTrainingReports(role),
    canGenerate: canGenerateTrainingReports(role),
    canExport: canExportTrainingReports(role),
    isReadOnly: isTrainingReportsReadOnly(role),
  };
}

export type { TrainingReportFilters, TrainingReportAnalytics };
