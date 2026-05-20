import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultSaasFeatureFlags,
  getSaasFeatureFlags,
  type SaaSFeatureFlags,
} from '../featureFlags';

export function useFeatureFlags() {
  const [flags, setFlags] = useState<SaaSFeatureFlags>(getDefaultSaasFeatureFlags());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const next = await getSaasFeatureFlags(forceRefresh);
      setFlags(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return { flags, loading, refresh };
}
