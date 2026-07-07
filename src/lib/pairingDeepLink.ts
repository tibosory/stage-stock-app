import { setApiBaseOverride, setApiKeyOverride, setCapiBridgeBaseOverride } from './apiEndpointStorage';
export {
  parsePairingDeepLink,
  parseHttpPairingTarget,
  isLoopbackHost,
  getPairingHostIssue,
  pairingScanHadApiKey,
} from './pairingDeepLinkParse';
export type { PairingParsed } from './pairingDeepLinkParse';

export async function tryApplyPairingFromScan(raw: string): Promise<boolean> {
  const { parsePairingDeepLink, parseHttpPairingTarget } = await import('./pairingDeepLinkParse');
  const fromDeep = parsePairingDeepLink(raw);
  const parsed = fromDeep ?? parseHttpPairingTarget(raw);
  if (!parsed) return false;
  await setApiBaseOverride(parsed.baseUrl);
  if (parsed.apiKey?.trim()) {
    await setApiKeyOverride(parsed.apiKey.trim());
  }
  if (parsed.capiBaseUrl) {
    await setCapiBridgeBaseOverride(parsed.capiBaseUrl);
  }
  const { setDataBackendMode } = await import('./backendMode');
  await setDataBackendMode('local_server');
  return true;
}

export async function applyPairingDeepLink(url: string): Promise<boolean> {
  const { parsePairingDeepLink, parseHttpPairingTarget } = await import('./pairingDeepLinkParse');
  const parsed = parsePairingDeepLink(url) ?? parseHttpPairingTarget(url);
  if (!parsed) return false;
  await setApiBaseOverride(parsed.baseUrl);
  if (parsed.apiKey?.trim()) {
    await setApiKeyOverride(parsed.apiKey.trim());
  }
  if (parsed.capiBaseUrl) {
    await setCapiBridgeBaseOverride(parsed.capiBaseUrl);
  }
  const { setDataBackendMode } = await import('./backendMode');
  await setDataBackendMode('local_server');
  return true;
}
