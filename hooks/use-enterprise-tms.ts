'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchEnterpriseTmsDashboard, getTrainingSettings, listAnnualPlans,
  listTrainingRequests, listQuestionBank, listNeedBasedTraining,
  listExternalTraining, listTrainerQualifications, listTrainerRenewals,
  listPracticalAssessments, listAutomationLog,
  type EnterpriseTmsDashboard, type EnterpriseTmsActor, type TrainingSettings,
} from '@/lib/enterprise-tms';

export function useEnterpriseTms() {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [dashboard, setDashboard] = useState<EnterpriseTmsDashboard | null>(null);
  const [settings, setSettings] = useState<TrainingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: EnterpriseTmsActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
    email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [dash, sett] = await Promise.all([
        fetchEnterpriseTmsDashboard(),
        getTrainingSettings(),
      ]);
      setDashboard(dash);
      setSettings(sett);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load enterprise TMS data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    dashboard, settings, loading, refreshing, error, actor, role, refresh,
    listAnnualPlans, listTrainingRequests, listQuestionBank, listNeedBasedTraining,
    listExternalTraining, listTrainerQualifications, listTrainerRenewals,
    listPracticalAssessments, listAutomationLog,
  };
}
