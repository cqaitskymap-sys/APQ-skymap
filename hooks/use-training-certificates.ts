'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { fetchCertificateDashboard } from '@/lib/training-certificate-service';
import {
  canViewCertificates, canManageCertificates, canApproveCertificates,
  isCertificateReadOnly, isEmployeeCertificateView,
  type CertificateFilters, type CertificateDashboardData, type CertificateActor,
} from '@/lib/training-certificate-types';

export function useTrainingCertificates(filters?: CertificateFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);

  const [data, setData] = useState<CertificateDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actor: CertificateActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || profile?.email || '',
    role,
    department: profile?.department,
  }), [user?.uid, profile?.full_name, profile?.email, profile?.department, role]);

  const refresh = useCallback(async () => {
    if (!canViewCertificates(role)) {
      setError('You do not have permission to view certificates');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      setData(await fetchCertificateDashboard({
        role, userId: user?.uid, userDepartment: profile?.department, filters,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user?.uid, profile?.department, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    data, loading, refreshing, error, role, actor,
    selectedIds, setSelectedIds, refresh,
    canView: canViewCertificates(role),
    canManage: canManageCertificates(role),
    canApprove: canApproveCertificates(role),
    isReadOnly: isCertificateReadOnly(role),
    isEmployeeView: isEmployeeCertificateView(role),
  };
}

export type { CertificateFilters, CertificateDashboardData };
