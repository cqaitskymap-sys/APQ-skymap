'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listVendors, listAvl, listAgreements, listPerformance, listQualifications, listSupplierAudits,
  computeDashboardMetrics, syncVendorStatuses,
} from '@/lib/vendor-mgmt-service';
import type { VendorRecord, AvlRecord, TechnicalAgreement, VendorPerformance, VendorQualification, SupplierAuditRecord, VendorFilters, VendorDashboardMetrics } from '@/lib/vendor-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useVendors(filters?: VendorFilters) {
  const hasFilters = filters !== undefined;
  const approvalStatus = filters?.approval_status;
  const vendorType = filters?.vendor_type;
  const riskCategory = filters?.risk_category;
  const vendorStatus = filters?.vendor_status;
  const search = filters?.search;
  const stableFilters = useMemo<VendorFilters | undefined>(
    () => hasFilters ? {
      approval_status: approvalStatus,
      vendor_type: vendorType,
      risk_category: riskCategory,
      vendor_status: vendorStatus,
      search,
    } : undefined,
    [hasFilters, approvalStatus, vendorType, riskCategory, vendorStatus, search],
  );
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [avl, setAvl] = useState<AvlRecord[]>([]);
  const [agreements, setAgreements] = useState<TechnicalAgreement[]>([]);
  const [performance, setPerformance] = useState<VendorPerformance[]>([]);
  const [qualifications, setQualifications] = useState<VendorQualification[]>([]);
  const [supplierAudits, setSupplierAudits] = useState<SupplierAuditRecord[]>([]);
  const [metrics, setMetrics] = useState<VendorDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncVendorStatuses();
      const [v, a, ag, perf, qual, audits] = await Promise.all([
        listVendors(stableFilters), listAvl(), listAgreements(), listPerformance(),
        listQualifications(), listSupplierAudits(),
      ]);
      setVendors(v);
      setAvl(a);
      setAgreements(ag);
      setPerformance(perf);
      setQualifications(qual);
      setSupplierAudits(audits);
      setMetrics(computeDashboardMetrics(v, a, ag));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => { refresh(); }, [refresh]);
  return { vendors, avl, agreements, performance, qualifications, supplierAudits, metrics, loading, error, refresh };
}

export function useVendor(id: string) {
  const [record, setRecord] = useState<VendorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { getVendorById } = await import('@/lib/vendor-mgmt-service');
      setRecord(await getVendorById(id));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { record, loading, refresh };
}

export function useVendorActor() {
  const { user, profile } = useAuth();
  const id = user?.uid || 'anonymous';
  const name = profile?.full_name || profile?.email || 'Unknown';
  const role = normalizeRole(profile?.role);
  return useMemo(() => ({ id, name, role }), [id, name, role]);
}
