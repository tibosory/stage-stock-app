import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { getIsOnlineRuntime, setIsOnlineRuntime } from '../lib/networkRuntime';
import { syncOnNetworkBack } from '../../services/syncService';

type NetworkStatusCtx = {
  isOnline: boolean;
  ready: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusCtx | null>(null);

function toOnlineState(
  state: { isConnected: boolean | null; isInternetReachable: boolean | null } | null
): boolean {
  if (!state) return true;
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(getIsOnlineRuntime());
  const [ready, setReady] = useState(false);
  const lastOnlineRef = useRef<boolean>(getIsOnlineRuntime());

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const current = await NetInfo.fetch();
      const next = toOnlineState(current);
      setIsOnlineRuntime(next);
      lastOnlineRef.current = next;
      if (mounted) {
        setIsOnline(next);
        setReady(true);
      }
      console.log(next ? 'ONLINE' : 'OFFLINE');
    })();

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const next = toOnlineState(state);
      const prev = lastOnlineRef.current;
      setIsOnlineRuntime(next);
      lastOnlineRef.current = next;
      if (mounted) setIsOnline(next);
      console.log(next ? 'ONLINE' : 'OFFLINE');
      if (!prev && next) {
        void syncOnNetworkBack();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ isOnline, ready }), [isOnline, ready]);
  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus(): NetworkStatusCtx {
  const v = useContext(NetworkStatusContext);
  if (!v) throw new Error('useNetworkStatus doit être utilisé sous NetworkStatusProvider');
  return v;
}
