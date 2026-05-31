import React, { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { applyPairingDeepLink } from '../lib/pairingDeepLink';
import { setServerPairingVerified } from '../lib/workspaceOnboardingStorage';
import { pingStageStockApi } from '../config/stageStockApi';
import { useConnection } from '../context/ConnectionContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Applique stagestock://pair?base=...&key=... (page /pair du serveur local).
 */
export function PairingDeepLinkSubscriber() {
  const { refresh } = useConnection();
  const { language } = useLanguage();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const run = async (url: string | null) => {
      if (!url || seen.current.has(url)) return;
      seen.current.add(url);
      const ok = await applyPairingDeepLink(url);
      if (ok) {
        await refresh();
        const ping = await pingStageStockApi();
        if (ping.ok) {
          await setServerPairingVerified();
        }
        Alert.alert(
          language === 'en' ? 'Pairing' : 'Jumelage',
          language === 'en'
            ? ping.ok
              ? 'Local server connected. You can continue in the app.'
              : 'Server address saved. Check Wi‑Fi and tap Verify connection in setup.'
            : ping.ok
              ? 'Serveur local connecté. Vous pouvez continuer dans l’app.'
              : 'Adresse enregistrée. Vérifiez le Wi‑Fi puis « Scanner le QR d’appairage » dans l’assistant.'
        );
      } else {
        seen.current.delete(url);
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });

    void Linking.getInitialURL().then(initial => void run(initial));

    return () => sub.remove();
  }, [refresh, language]);

  return null;
}
