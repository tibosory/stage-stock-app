import { Platform } from 'react-native';
import { isV1LanMode } from '../config/appMode';
import { getAccessToken, getApiKeyOverride } from './apiEndpointStorage';

/**
 * En-têtes d’auth pour le serveur CATRACK Pro (inventaire + Accueil Pro).
 * La clé API de jumelage (/pair) prime sur le JWT « compte cloud » local.
 */
export async function buildServerAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-StageStock-Client': `StageStock-${Platform.OS}`,
  };

  const apiKey =
    (await getApiKeyOverride())?.trim() || process.env.EXPO_PUBLIC_API_KEY?.trim() || '';

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  // V1 LAN : sans clé de jumelage, n’envoie pas un JWT cloud périmé (sinon HTTP 401 ambigu).
  if (!isV1LanMode()) {
    const jwt = (await getAccessToken())?.trim();
    if (jwt) {
      headers.Authorization = `Bearer ${jwt}`;
    }
  }

  return headers;
}

export async function hasLocalSyncApiKey(): Promise<boolean> {
  const key =
    (await getApiKeyOverride())?.trim() || process.env.EXPO_PUBLIC_API_KEY?.trim() || '';
  return key.length > 0;
}
