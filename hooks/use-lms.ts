'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchLmsDashboard, listConnections,
} from '@/lib/lms-service';
import { runLmsSync, retryFailedSync, detectConflicts } from '@/lib/lms-sync-service';
import type { LmsDashboardData, LmsFilters, LmsActor, ConflictRecord } from '@/lib/lms-types';
import { canViewLmsIntegration } from '@/lib/lms-types';

export function useLmsIntegration(filters?: LmsFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor: LmsActor = { id: user?.uid || '', name: profile?.full_name || '', role };

  const [data, setData] = useState<LmsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);

  const refresh = useCallback(async () => {
    if (!canViewLmsIntegration(role)) {
      setError('You do not have permission to view LMS Integration');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const dashboard = await fetchLmsDashboard(filters);
      setData(dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load LMS data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, actor.id, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  const triggerSync = useCallback(async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      await runLmsSync(connectionId, actor, 'Manual');
      await refresh();
    } finally {
      setSyncing(null);
    }
  }, [actor, refresh]);

  const retrySync = useCallback(async (jobDocId: string) => {
    setSyncing(jobDocId);
    try {
      await retryFailedSync(jobDocId, actor);
      await refresh();
    } finally {
      setSyncing(null);
    }
  }, [actor, refresh]);

  const loadConflicts = useCallback(async (connectionId: string) => {
    const c = await detectConflicts(connectionId);
    setConflicts(c);
    return c;
  }, []);

  return {
    data,
    loading,
    refreshing,
    error,
    role,
    actor,
    syncing,
    conflicts,
    refresh,
    triggerSync,
    retrySync,
    loadConflicts,
    canView: canViewLmsIntegration(role),
    canSync: ['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(role),
    canManage: ['super_admin', 'admin'].includes(role),
    isReadOnly: ['auditor', 'viewer'].includes(role),
  };
}

export function useLmsConnections() {
  const [connections, setConnections] = useState<Awaited<ReturnType<typeof listConnections>>>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConnections(await listConnections());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { connections, loading, refresh };
}
