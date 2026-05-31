import * as Network from 'expo-network';
import { getApiBaseOverride, setApiBaseOverride } from './apiEndpointStorage';
import { discoverStageStockOnLan, privateSubnetPrefixForIpv4 } from './lanDiscovery';
import { checkServerReachableQuick, getBundledDefaultApiBase } from '../config/stageStockApi';
import { isPairingInProgress } from './pairingSessionGuard';

function isPrivateLanUrl(url: string): boolean {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    const h = u.hostname;
    if (h.startsWith('192.168.')) return true;
    if (h.startsWith('10.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

let lastLanAttemptAt = 0;
const LAN_DISCOVERY_COOLDOWN_MS = 75_000;

/**
 * Si l’URL courante (cloud ou locale) ne répond pas, balaie le LAN et enregistre une URL locale si trouvée.
 * Appelée au démarrage / retour au premier plan ; limitée par cooldown pour ne pas saturer le réseau.
 */
export async function runAutoLanDiscoveryWhenUnreachable(): Promise<void> {
  try {
    if (isPairingInProgress()) return;
    if (await checkServerReachableQuick()) return;

    const now = Date.now();
    if (now - lastLanAttemptAt < LAN_DISCOVERY_COOLDOWN_MS && lastLanAttemptAt > 0) {
      return;
    }
    lastLanAttemptAt = now;

    let preferredSubnetPrefixes: string[] = [];
    try {
      const ip = await Network.getIpAddressAsync();
      if (ip && ip !== '0.0.0.0') {
        const p = privateSubnetPrefixForIpv4(ip);
        if (p) preferredSubnetPrefixes = [p];
      }
    } catch {
      /* ignore */
    }

    const hit = await discoverStageStockOnLan({ preferredSubnetPrefixes });
    if (hit?.baseUrl) {
      await setApiBaseOverride(hit.baseUrl);
      return;
    }

    // Ne pas effacer un jumelage LAN récent (QR /pair) au profit d'une URL cloud du build.
    const currentOverride = await getApiBaseOverride();
    if (currentOverride && getBundledDefaultApiBase() && !isPrivateLanUrl(currentOverride)) {
      await setApiBaseOverride(null);
    }
  } catch {
    /* silencieux */
  }
}

export async function runConsumerAutoConnect(): Promise<void> {
  await runAutoLanDiscoveryWhenUnreachable();
}
