'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  listSystems, listGxpAssessments, listRiskAssessments, listUrs, listFrs,
  listDesignSpecs, listTestScripts, listTraceability, listPart11Assessments,
  listValidationReports, listPeriodicReviews, computeDashboardMetrics, syncPeriodicReviewDue,
} from '@/lib/csv-mgmt-service';
import type {
  CsvSystem, GxpAssessment, CsvRiskAssessment, UrsRecord, FrsRecord,
  DesignSpecRecord, TestScript, TraceabilityRow, Part11Assessment,
  CsvValidationReport, PeriodicReview, CsvFilters, CsvDashboardMetrics,
} from '@/lib/csv-mgmt-types';
import { normalizeRole } from '@/lib/permissions';

export function useCsvSystems(filters?: CsvFilters) {
  const [systems, setSystems] = useState<CsvSystem[]>([]);
  const [gxpAssessments, setGxpAssessments] = useState<GxpAssessment[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<CsvRiskAssessment[]>([]);
  const [urs, setUrs] = useState<UrsRecord[]>([]);
  const [frs, setFrs] = useState<FrsRecord[]>([]);
  const [designSpecs, setDesignSpecs] = useState<DesignSpecRecord[]>([]);
  const [testScripts, setTestScripts] = useState<TestScript[]>([]);
  const [traceability, setTraceability] = useState<TraceabilityRow[]>([]);
  const [part11, setPart11] = useState<Part11Assessment[]>([]);
  const [validationReports, setValidationReports] = useState<CsvValidationReport[]>([]);
  const [periodicReviews, setPeriodicReviews] = useState<PeriodicReview[]>([]);
  const [metrics, setMetrics] = useState<CsvDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncPeriodicReviewDue();
      const [sys, gxp, risk, u, f, ds, tests, trace, p11, vr, pr] = await Promise.all([
        listSystems(filters), listGxpAssessments(), listRiskAssessments(), listUrs(), listFrs(),
        listDesignSpecs(), listTestScripts(), listTraceability(), listPart11Assessments(),
        listValidationReports(), listPeriodicReviews(),
      ]);
      setSystems(sys);
      setGxpAssessments(gxp);
      setRiskAssessments(risk);
      setUrs(u);
      setFrs(f);
      setDesignSpecs(ds);
      setTestScripts(tests);
      setTraceability(trace);
      setPart11(p11);
      setValidationReports(vr);
      setPeriodicReviews(pr);
      setMetrics(computeDashboardMetrics(sys, tests, p11));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CSV data');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);
  return {
    systems, gxpAssessments, riskAssessments, urs, frs, designSpecs, testScripts,
    traceability, part11, validationReports, periodicReviews, metrics, loading, error, refresh,
  };
}

export function useCsvSystem(id: string) {
  const [system, setSystem] = useState<CsvSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { getSystemById } = await import('@/lib/csv-mgmt-service');
      setSystem(await getSystemById(id));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);
  return { system, loading, refresh };
}

export function useCsvActor() {
  const { user, profile } = useAuth();
  return { id: user?.uid || 'anonymous', name: profile?.full_name || profile?.email || 'Unknown', role: normalizeRole(profile?.role) };
}
