import Constants from 'expo-constants';

function trimHttpsUrl(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  if (!/^https:\/\//i.test(t)) return null;
  return t;
}

/**
 * URL publique (HTTPS) de la politique de confidentialité — exigée par les stores.
 * `EXPO_PUBLIC_PRIVACY_POLICY_URL` (build) ou `expo.extra.privacyPolicyUrl` dans app.json.
 */
export function getPrivacyPolicyUrl(): string | null {
  const fromEnv = trimHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { privacyPolicyUrl?: string } | undefined;
  return trimHttpsUrl(extra?.privacyPolicyUrl);
}

/**
 * URL publique (HTTPS) des conditions générales d’utilisation (optionnel).
 * `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` ou `expo.extra.termsOfServiceUrl`.
 */
export function getTermsOfServiceUrl(): string | null {
  const fromEnv = trimHttpsUrl(process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL);
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { termsOfServiceUrl?: string } | undefined;
  return trimHttpsUrl(extra?.termsOfServiceUrl);
}
