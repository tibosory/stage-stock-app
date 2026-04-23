import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { isConsumerApp } from '../config/appMode';
import { checkServerReachableQuick } from '../config/stageStockApi';
import { runAutoLanDiscoveryWhenUnreachable } from '../lib/consumerAutoConnect';
import { runSilentServerDiagnostics } from '../lib/silentHealthCheck';

export type ConnectionStatus = 'checking' | 'ok' | 'offline';

type Ctx = {
  status: ConnectionStatus;
  refresh: () => Promise<void>;
};

const ConnectionContext = createContext<Ctx>({
  status: 'checking',
  refresh: async () => {},
});

const MIN_REFRESH_GAP_MS = 25_000;

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(() => (isConsumerApp() ? 'checking' : 'ok'));
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(async () => {
    await runAutoLanDiscoveryWhenUnreachable();

    if (!isConsumerApp()) {
      setStatus('ok');
      return;
    }
    const now = Date.now();
    if (now - lastRefreshAt.current < MIN_REFRESH_GAP_MS && lastRefreshAt.current > 0) {
      return;
    }
    lastRefreshAt.current = now;
    setStatus('checking');
    const ok = await checkServerReachableQuick();
    setStatus(ok ? 'ok' : 'offline');
    if (ok) {
      void runSilentServerDiagnostics();
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): Ctx {
  return useContext(ConnectionContext);
}
