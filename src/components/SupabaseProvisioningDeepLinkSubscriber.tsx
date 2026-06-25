import React, { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { tryApplySupabaseProvisioningFromScan } from '../lib/supabaseProvisioningDeepLink';
import { useSupabaseAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { getEffectiveSupabaseUrlForDisplay } from '../lib/supabase';

/**
 * Applique stagestock://supabase?url=…&key=… (QR ou lien d’invitation).
 */
export function SupabaseProvisioningDeepLinkSubscriber() {
  const { refreshProfile } = useSupabaseAuth();
  const { t } = useLanguage();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const run = async (url: string | null) => {
      if (!url || seen.current.has(url)) return;
      seen.current.add(url);
      const ok = await tryApplySupabaseProvisioningFromScan(url);
      if (ok) {
        await refreshProfile();
        Alert.alert(
          t('network.supabaseProvision.doneTitle'),
          t('network.supabaseProvision.doneBody', { url: getEffectiveSupabaseUrlForDisplay() })
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
  }, [refreshProfile, t]);

  return null;
}
