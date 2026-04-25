import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDoubleBackendRuntime,
  loadDoubleBackendRuntimeFromStorage,
  persistDoubleBackendRuntime,
} from '../lib/doubleBackendRuntime';

type SyncSettingsCtx = {
  doubleBackendEnabled: boolean;
  setDoubleBackendEnabled: (enabled: boolean) => Promise<void>;
  ready: boolean;
};

const SyncSettingsContext = createContext<SyncSettingsCtx | null>(null);

export function SyncSettingsProvider({ children }: { children: React.ReactNode }) {
  const [doubleBackendEnabled, setDoubleBackendEnabledState] = useState<boolean>(getDoubleBackendRuntime());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const v = await loadDoubleBackendRuntimeFromStorage();
      if (!cancel) {
        setDoubleBackendEnabledState(v);
        setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const setDoubleBackendEnabled = useCallback(async (enabled: boolean) => {
    setDoubleBackendEnabledState(enabled);
    await persistDoubleBackendRuntime(enabled);
  }, []);

  const value = useMemo(
    () => ({ doubleBackendEnabled, setDoubleBackendEnabled, ready }),
    [doubleBackendEnabled, setDoubleBackendEnabled, ready]
  );

  return <SyncSettingsContext.Provider value={value}>{children}</SyncSettingsContext.Provider>;
}

export function useSyncSettings(): SyncSettingsCtx {
  const v = useContext(SyncSettingsContext);
  if (!v) throw new Error('useSyncSettings doit être utilisé sous SyncSettingsProvider');
  return v;
}
