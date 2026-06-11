'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CpvConfigBundle } from '@/lib/cpv-config';
import { loadCpvConfig } from '@/lib/cpv-config-service';

const EMPTY_CONFIG: CpvConfigBundle = {
  products: [],
  cppMaster: [],
  cqaMaster: [],
  limits: [],
  controlLimits: [],
  targets: [],
  sampling: [],
  alerts: [],
  review: [],
  workflow: [],
};

export function useCpvConfig() {
  const [config, setConfig] = useState<CpvConfigBundle>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(await loadCpvConfig());
    } catch {
      setConfig(EMPTY_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { config, loading, reload };
}
