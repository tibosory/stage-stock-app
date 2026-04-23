import Constants from 'expo-constants';

/**
 * Mode « grand public » : pas d’URL/IP/port visibles, connexion et diagnostics automatiques.
 * Build : EXPO_PUBLIC_CONSUMER_APP=1 ou app.json → expo.extra.consumerApp
 */
export function isConsumerApp(): boolean {
  const v = process.env.EXPO_PUBLIC_CONSUMER_APP?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  const extra = Constants.expoConfig?.extra as { consumerApp?: boolean } | undefined;
  return extra?.consumerApp === true;
}

