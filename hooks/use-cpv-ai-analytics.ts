'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CPV_COLLECTIONS, CppRecord, CqaRecord, RiskRecord, UtilityRecord, YieldRecord,
} from '@/lib/cpv';
import { listCpvRecords, loadIntegrationSnapshot } from '@/lib/cpv-service';
import { runCpvAiAnalytics, type AiAnalyticsReport, type AiAnalyticsFilters } from '@/lib/cpv-ai-analytics';

export function useCpvAiAnalytics(filters: AiAnalyticsFilters = {}) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AiAnalyticsReport | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cpp, cqa, yields, utilities, risks, integrations] = await Promise.all([
        listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
        listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
        listCpvRecords<YieldRecord>(CPV_COLLECTIONS.yield),
        listCpvRecords<UtilityRecord>(CPV_COLLECTIONS.utility),
        listCpvRecords<RiskRecord>(CPV_COLLECTIONS.risk),
        loadIntegrationSnapshot(),
      ]);

      let equipment: Record<string, unknown>[] = [];
      try {
        const { loadAnnualReviewSourceData } = await import('@/lib/cpv-annual-review-service');
        const source = await loadAnnualReviewSourceData(new Date().getFullYear(), filters.product || 'all');
        equipment = source.raw?.equipment || [];
      } catch {
        equipment = [];
      }

      setReport(runCpvAiAnalytics({
        cpp,
        cqa,
        yields,
        utilities,
        equipment,
        deviations: integrations.deviations,
        risks,
        filters,
      }));
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [filters.product]);

  useEffect(() => { void reload(); }, [reload]);

  return { loading, report, reload };
}
