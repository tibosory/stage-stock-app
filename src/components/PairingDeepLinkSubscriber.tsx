import React, { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { applyPairingDeepLink } from '../lib/pairingDeepLink';
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
        Alert.alert(
          language === 'en' ? 'Pairing' : 'Jumelage',
          language === 'en'
            ? 'Local server address has been saved.'
            : 'L’adresse du serveur local a été enregistrée.'
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
