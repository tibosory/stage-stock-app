import React, { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { applyPairingDeepLink } from '../lib/pairingDeepLink';
import { useConnection } from '../context/ConnectionContext';

/**
 * Applique stagestock://pair?base=...&key=... (page /pair du serveur local).
 */
export function PairingDeepLinkSubscriber() {
  const { refresh } = useConnection();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const run = async (url: string | null) => {
      if (!url || seen.current.has(url)) return;
      seen.current.add(url);
      const ok = await applyPairingDeepLink(url);
      if (ok) {
        await refresh();
        Alert.alert('Jumelage', 'L’adresse du serveur local a été enregistrée.');
      } else {
        seen.current.delete(url);
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });

    void Linking.getInitialURL().then(initial => void run(initial));

    return () => sub.remove();
  }, [refresh]);

  return null;
}
