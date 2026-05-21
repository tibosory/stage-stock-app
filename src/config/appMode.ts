import Constants from 'expo-constants';

/**
 * Mode « grand public » : pas d’URL/IP/port visibles, connexion et diagnostics automatiques.
 * Build : EXPO_PUBLIC_CONSUMER_APP=1 ou app.json → expo.extra.consumerApp
 */
/** Mode LAN V1 : connexion PIN locale, pas de compte cloud/Supabase sur l’écran d’accueil. */
export function isV1LanMode(): boolean {
  const v = process.env.EXPO_PUBLIC_V1_LAN?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  const extra = Constants.expoConfig?.extra as { v1Lan?: boolean; consumerApp?: boolean } | undefined;
  if (extra?.v1Lan === true) return true;
  if (extra?.v1Lan === false) return false;
  return extra?.consumerApp === true;
}

export function isConsumerApp(): boolean {
  const v = process.env.EXPO_PUBLIC_CONSUMER_APP?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  const extra = Constants.expoConfig?.extra as { consumerApp?: boolean } | undefined;
  return extra?.consumerApp === true;
}

