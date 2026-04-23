import * as Network from 'expo-network';
import { setApiBaseOverride } from './apiEndpointStorage';
import { discoverStageStockOnLan, privateSubnetPrefixForIpv4 } from './lanDiscovery';
import { checkServerReachableQuick } from '../config/stageStockApi';

let lastLanAttemptAt = 0;
const LAN_DISCOVERY_COOLDOWN_MS = 75_000;

/**
 * Si l’URL courante (cloud ou locale) ne répond pas, balaie le LAN et enregistre une URL locale si trouvée.
 * Appelée au démarrage / retour au premier plan ; limitée par cooldown pour ne pas saturer le réseau.
 */
export async function runAutoLanDiscoveryWhenUnreachable(): Promise<void> {
  try {
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
    }
  } catch {
    /* silencieux */
  }
}

export async function runConsumerAutoConnect(): Promise<void> {
  await runAutoLanDiscoveryWhenUnreachable();
}
