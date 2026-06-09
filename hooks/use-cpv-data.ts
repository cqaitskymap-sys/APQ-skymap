'use client';

import { useEffect, useState } from 'react';
import { CPV_COLLECTIONS, CppRecord, CqaRecord, RiskRecord } from '@/lib/cpv';
import { listCpvRecords, loadIntegrationSnapshot } from '@/lib/cpv-service';

export function useCpvData(includeIntegrations = false) {
  const [loading, setLoading] = useState(true);
  const [cpp, setCpp] = useState<CppRecord[]>([]);
  const [cqa, setCqa] = useState<CqaRecord[]>([]);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof loadIntegrationSnapshot>> | null>(null);

  const reload = async () => {
    setLoading(true);
    const [cppData, cqaData, riskData, integrationData] = await Promise.all([
      listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
      listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
      listCpvRecords<RiskRecord>(CPV_COLLECTIONS.risk),
      includeIntegrations ? loadIntegrationSnapshot() : Promise.resolve(null),
    ]);
    setCpp(cppData);
    setCqa(cqaData);
    setRisks(riskData);
    setIntegrations(integrationData);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [includeIntegrations]);
  return { loading, cpp, cqa, risks, integrations, reload };
}
