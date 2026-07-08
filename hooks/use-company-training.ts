'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchCompanyTrainingDashboard } from '@/lib/company-training-service';
import {
  canViewCompanyTraining, canManageCompanyTraining, canConductHrInduction,
  canApproveDeptHandover, canManageTni, canCertifyTrainer,
  type CompanyTrainingDashboard, type CompanyTrainingActor,
} from '@/lib/company-training-types';

export function useCompanyTraining() {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<CompanyTrainingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor: CompanyTrainingActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewCompanyTraining(role)) {
      setError('You do not have permission to view company training');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchCompanyTrainingDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company training data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor, refresh,
    canView: canViewCompanyTraining(role),
    canManage: canManageCompanyTraining(role),
    canConductHrInduction: canConductHrInduction(role),
    canApproveDeptHandover: canApproveDeptHandover(role),
    canManageTni: canManageTni(role),
    canCertifyTrainer: canCertifyTrainer(role),
  };
}

export type { CompanyTrainingDashboard };
