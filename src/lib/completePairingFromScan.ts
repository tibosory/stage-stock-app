import {
  probeStageStockSyncApi,
  getResolvedApiBase,
  invalidateQuickReachabilityCache,
} from '../config/stageStockApi';
import {
  pairingPingHealthBase,
  resolveStageStockBaseFromHealthProbe,
} from './apiBaseResolution';
import { setApiBaseOverride } from './apiEndpointStorage';
import {
  tryApplyPairingFromScan,
  getPairingHostIssue,
  pairingScanHadApiKey,
} from './pairingDeepLink';
import { setServerPairingVerified } from './workspaceOnboardingStorage';
import { toUserFriendlyNetworkMessage } from './userFriendlyNetworkError';
import { hasLocalSyncApiKey } from './serverAuthHeaders';

export type PairingScanResult =
  | { kind: 'not_pairing' }
  | { kind: 'success'; baseUrl: string }
  | { kind: 'error'; title: string; message: string };

function loopbackMessage(language: 'fr' | 'en'): string {
  return language === 'en'
    ? 'The QR code uses 127.0.0.1 (PC only). On the PC, open StageStock Local again — the address under the QR must start with 192.168… or 10…, not 127.0.0.1. Same Wi‑Fi on phone and PC.'
    : 'Le QR utilise 127.0.0.1 (adresse PC seulement). Sur le PC, relancez « StageStock Local » : l’adresse sous le QR doit commencer par 192.168… ou 10…, pas 127.0.0.1. Même Wi‑Fi sur le téléphone et le PC.';
}

function portFromBase(base: string): string {
  try {
    const p = new URL(base).port;
    return p || '8091';
  } catch {
    return '8091';
  }
}

function unreachableMessage(language: 'fr' | 'en', testedBase: string, detail: string): string {
  const port = portFromBase(testedBase);
  const friendly = toUserFriendlyNetworkMessage(detail, language);
  if (language === 'en') {
    return (
      `${friendly}\n\n` +
      `Tested: ${testedBase}/health\n\n` +
      `Same Wi‑Fi as the PC? On the phone browser open ${testedBase}/health (expect status ok). ` +
      `On the PC: StageStock Local running; Docker up if using the full installer. ` +
      `Firewall: backend\\windows\\Fix-StageStockFirewall.ps1 (Administrator).`
    );
  }
  return (
    `${friendly}\n\n` +
    `Test : ${testedBase}/health\n\n` +
    `Même Wi‑Fi que le PC ? Testez dans le navigateur du téléphone : ${testedBase}/health (doit afficher status ok). ` +
    `Sur le PC : « StageStock Local » ouvert, Docker vert si installateur complet. ` +
    `Pare-feu : backend\\windows\\Fix-StageStockFirewall.ps1 (Administrateur).`
  );
}

export async function completePairingFromScan(
  raw: string,
  language: 'fr' | 'en'
): Promise<PairingScanResult> {
  const paired = await tryApplyPairingFromScan(raw);
  if (!paired) {
    return { kind: 'not_pairing' };
  }

  invalidateQuickReachabilityCache();

  let baseUrl = await getResolvedApiBase();
  if (!(await hasLocalSyncApiKey())) {
    const hadKeyInQr = pairingScanHadApiKey(raw);
    return {
      kind: 'error',
      title: language === 'en' ? 'API key required' : 'Clé API requise',
      message:
        language === 'en'
          ? hadKeyInQr
            ? 'Server found but refused the API key from the QR. Restart StageStock Local on the PC, reload /pair, then scan again. If the server was reinstalled, the old QR is invalid.'
            : 'The scanned code has no API key (often the address line under the QR, not the QR itself). In the app: Network → Scan pairing QR, or Scanner tab — aim at the QR on the PC /pair page (message: key included in QR).'
          : hadKeyInQr
            ? 'Serveur trouvé, mais la clé du QR est refusée. Relancez « StageStock Local », rechargez /pair, rescannez. Si le serveur a été réinstallé, l’ancien QR ne fonctionne plus.'
            : 'Le code scanné ne contient pas la clé API (souvent l’adresse affichée sous le QR, pas le QR lui‑même). Dans l’app : Réseau → Scanner le QR d’appairage, ou onglet Scanner — visez le QR de la page /pair du PC (texte « clé incluse dans le QR »).',
    };
  }

  if (getPairingHostIssue(baseUrl) === 'loopback') {
    return {
      kind: 'error',
      title: language === 'en' ? 'Wrong QR address' : 'Mauvaise adresse dans le QR',
      message: loopbackMessage(language),
    };
  }

  // Ping direct puis balayage des ports si le serveur a basculé (8092…) ou démarre encore.
  const pairingPingOpts = { attempts: 3, timeoutMs: 10_000 };
  let ping = await pairingPingHealthBase(baseUrl, pairingPingOpts);
  if (!ping.ok) {
    const probed = await resolveStageStockBaseFromHealthProbe(baseUrl, {
      maxExtraPorts: 20,
      timeoutMs: 4_500,
    });
    if (probed) {
      if (probed !== baseUrl) {
        await setApiBaseOverride(probed);
        invalidateQuickReachabilityCache();
        baseUrl = probed;
      }
      ping = await pairingPingHealthBase(baseUrl, pairingPingOpts);
    }
  }
  if (!ping.ok) {
    return {
      kind: 'error',
      title: language === 'en' ? 'Server not reachable' : 'Serveur injoignable',
      message: unreachableMessage(language, ping.testedBase, 'timeout'),
    };
  }

  invalidateQuickReachabilityCache();
  const sync = await probeStageStockSyncApi();
  if (!sync.ok) {
    const friendly = toUserFriendlyNetworkMessage(sync.message, language);
    const isAuth =
      sync.message.includes('401') ||
      friendly.toLowerCase().includes('session') ||
      friendly.toLowerCase().includes('clé') ||
      friendly.toLowerCase().includes('key');
    return {
      kind: 'error',
      title: isAuth
        ? language === 'en'
          ? 'API key required'
          : 'Clé API requise'
        : language === 'en'
          ? 'Sync not ready'
          : 'Synchronisation indisponible',
      message: isAuth
        ? language === 'en'
          ? 'Server found but sync refused access. Rescan the QR from the PC /pair page (API key must be included). Restart StageStock Local on the PC if needed.'
          : 'Serveur trouvé, mais la synchronisation refuse l’accès. Rescannez le QR de la page /pair du PC (clé API incluse). Relancez « StageStock Local » sur le PC si besoin.'
        : friendly,
    };
  }

  await setServerPairingVerified();
  const finalBase = await getResolvedApiBase();
  return { kind: 'success', baseUrl: finalBase };
}
