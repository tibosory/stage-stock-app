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

import NetInfo from '@react-native-community/netinfo';

import { isConsumerApp } from '../config/appMode';
import { getDataBackendMode } from '../lib/backendMode';

import { checkServerReachableQuick } from '../config/stageStockApi';

import { runAutoLanDiscoveryWhenUnreachable } from '../lib/consumerAutoConnect';
import { isPairingInProgress } from '../lib/pairingSessionGuard';

import { hasLocalSyncApiKey } from '../lib/serverAuthHeaders';

import { runSilentServerDiagnostics } from '../lib/silentHealthCheck';

import { runForegroundInventorySync } from '../lib/foregroundInventorySync';



export type ConnectionStatus = 'checking' | 'ok' | 'offline' | 'needs_pairing';



type Ctx = {

  status: ConnectionStatus;

  refresh: () => Promise<void>;

};



const ConnectionContext = createContext<Ctx>({

  status: 'checking',

  refresh: async () => {},

});



const MIN_REFRESH_GAP_MS = 25_000;

const PERIODIC_REFRESH_MS = 60_000;



export function ConnectionProvider({ children }: { children: ReactNode }) {

  const [status, setStatus] = useState<ConnectionStatus>(() => (isConsumerApp() ? 'checking' : 'ok'));

  const lastRefreshAt = useRef(0);

  const wasOnlineRef = useRef(true);



  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    if (!isPairingInProgress()) {
      await runAutoLanDiscoveryWhenUnreachable();
    }



    if (!isConsumerApp()) {

      setStatus('ok');

      return;

    }

    const now = Date.now();

    if (!opts?.force && now - lastRefreshAt.current < MIN_REFRESH_GAP_MS && lastRefreshAt.current > 0) {

      return;

    }

    lastRefreshAt.current = now;

    setStatus('checking');

    const backendMode = await getDataBackendMode();
    if (backendMode === 'supabase') {
      const net = await NetInfo.fetch();
      const online = net.isConnected !== false && net.isInternetReachable !== false;
      setStatus(online ? 'ok' : 'offline');
      return;
    }

    const ok = await checkServerReachableQuick();

    if (!ok) {

      setStatus('offline');

      return;

    }

    if (!(await hasLocalSyncApiKey())) {

      setStatus('needs_pairing');

      return;

    }

    setStatus('ok');

    void runSilentServerDiagnostics();

  }, []);



  useEffect(() => {

    void refresh({ force: true });

    const sub = AppState.addEventListener('change', s => {

      if (s === 'active') void refresh({ force: true });

    });

    return () => sub.remove();

  }, [refresh]);



  useEffect(() => {

    if (!isConsumerApp()) return;

    const id = setInterval(() => void refresh(), PERIODIC_REFRESH_MS);

    return () => clearInterval(id);

  }, [refresh]);



  useEffect(() => {

    if (!isConsumerApp()) return;

    const unsub = NetInfo.addEventListener(state => {

      const online = state.isConnected !== false && state.isInternetReachable !== false;

      const prev = wasOnlineRef.current;

      wasOnlineRef.current = online;

      if (!prev && online) {

        void refresh({ force: true });

        void runForegroundInventorySync();

      } else if (!online) {

        setStatus('offline');

      }

    });

    return () => unsub();

  }, [refresh]);



  const value = useMemo(

    () => ({

      status,

      refresh: () => refresh({ force: true }),

    }),

    [refresh, status]

  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;

}



export function useConnection(): Ctx {

  return useContext(ConnectionContext);

}


