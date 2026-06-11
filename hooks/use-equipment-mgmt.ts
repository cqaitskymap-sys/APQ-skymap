'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listEquipment, listCalibrations, listPmRecords, listBreakdowns,
  computeDashboardMetrics, syncEquipmentDueDates,
} from '@/lib/equipment-mgmt-service';
import type {
  EquipmentRecord, CalibrationRecord, PmRecord, BreakdownRecord,
  EquipmentFilters, EquipmentDashboardMetrics,
} from '@/lib/equipment-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useEquipment(filters?: EquipmentFilters) {
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);
  const [pmRecords, setPmRecords] = useState<PmRecord[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownRecord[]>([]);
  const [metrics, setMetrics] = useState<EquipmentDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncEquipmentDueDates();
      const [eq, cal, pm, bd] = await Promise.all([
        listEquipment(filters), listCalibrations(), listPmRecords(), listBreakdowns(),
      ]);
      setEquipment(eq);
      setCalibrations(cal);
      setPmRecords(pm);
      setBreakdowns(bd);
      setMetrics(computeDashboardMetrics(eq, bd));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { equipment, calibrations, pmRecords, breakdowns, metrics, loading, error, refresh };
}

export function useEquipmentItem(id: string) {
  const [record, setRecord] = useState<EquipmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { getEquipmentById } = await import('@/lib/equipment-mgmt-service');
      setRecord(await getEquipmentById(id));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useEquipmentActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown', role: normalizeRole(profile?.role) };
}
