'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listReceipts, listSamplings, listReleases, listDispensing,
  listInventory, listFinishedGoods, computeDashboardMetrics, syncInventoryExpiry,
} from '@/lib/warehouse-mgmt-service';
import type {
  MaterialReceipt, QcSampling, MaterialRelease, MaterialDispensing,
  InventoryStock, FinishedGoods, WarehouseFilters, WarehouseDashboardMetrics,
} from '@/lib/warehouse-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useWarehouse(filters?: WarehouseFilters) {
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [samplings, setSamplings] = useState<QcSampling[]>([]);
  const [releases, setReleases] = useState<MaterialRelease[]>([]);
  const [dispensing, setDispensing] = useState<MaterialDispensing[]>([]);
  const [inventory, setInventory] = useState<InventoryStock[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoods[]>([]);
  const [metrics, setMetrics] = useState<WarehouseDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncInventoryExpiry();
      const [rec, smp, rel, dsp, inv, fg] = await Promise.all([
        listReceipts(filters), listSamplings(), listReleases(),
        listDispensing(), listInventory(filters), listFinishedGoods(),
      ]);
      setReceipts(rec);
      setSamplings(smp);
      setReleases(rel);
      setDispensing(dsp);
      setInventory(inv);
      setFinishedGoods(fg);
      setMetrics(computeDashboardMetrics(inv, rec, dsp, fg));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load warehouse data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return { receipts, samplings, releases, dispensing, inventory, finishedGoods, metrics, loading, error, refresh };
}

export function useWarehouseActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown', role: normalizeRole(profile?.role) };
}
