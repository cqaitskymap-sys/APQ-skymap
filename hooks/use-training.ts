'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listTrainingMaster, listAssignments, getTrainingMatrix, listEffectiveness,
  listCompetency, computeDashboardMetrics, syncOverdueAssignments, syncDmsTrainingLinks,
  buildTrainingMatrix,
} from '@/lib/training-service';
import type {
  TrainingMaster, TrainingAssignment, TrainingMatrixRow, TrainingEffectiveness,
  CompetencyRecord, TmsFilters, TmsDashboardMetrics,
} from '@/lib/training-types';
import { normalizeRole } from '@/lib/permissions';

export function useTrainingDashboard(filters?: TmsFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor = { id: user?.uid || '', name: profile?.full_name || '', role };

  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [matrix, setMatrix] = useState<TrainingMatrixRow[]>([]);
  const [effectiveness, setEffectiveness] = useState<TrainingEffectiveness[]>([]);
  const [competency, setCompetency] = useState<CompetencyRecord[]>([]);
  const [metrics, setMetrics] = useState<TmsDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncOverdueAssignments();
      if (actor.id) await syncDmsTrainingLinks({ id: actor.id, name: actor.name || 'System', role });
      const [m, a, mx, eff, comp] = await Promise.all([
        listTrainingMaster(filters),
        listAssignments(filters),
        getTrainingMatrix(),
        listEffectiveness(),
        listCompetency(),
      ]);
      setMasters(m);
      setAssignments(a);
      setMatrix(mx);
      setEffectiveness(eff);
      setCompetency(comp);
      setMetrics(computeDashboardMetrics(mx, a, eff));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters), actor.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { masters, assignments, matrix, effectiveness, competency, metrics, loading, error, refresh, role };
}

export function useTrainingMatrix() {
  const [matrix, setMatrix] = useState<TrainingMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMatrix(await buildTrainingMatrix());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { matrix, loading, refresh };
}

export function useTmsActor() {
  const { user, profile } = useAuth();
  return {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'Unknown User',
    role: normalizeRole(profile?.role),
  };
}
