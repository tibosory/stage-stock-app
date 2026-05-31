import { fetchWithTimeout } from './fetchWithTimeout';
import { buildServerAuthHeaders } from './serverAuthHeaders';
import { normalizeHttpBaseUrl, stripStageStockServerRootSuffix } from './apiEndpointStorage';

const PROBE_MS = 3_500;
const PAIRING_HEALTH_MS = 2_500;
const PAIRING_PING_MS = 4_000;

export function isStageStockHealthJson(text: string): boolean {
  try {
    const j = JSON.parse(text) as { status?: string };
    return j.status === 'ok';
  } catch {
    return false;
  }
}

export async function probeStageStockHealth(
  baseUrl: string,
  timeoutMs: number = PROBE_MS
): Promise<boolean> {
  const base = stripStageStockServerRootSuffix(baseUrl.trim());
  if (!base) return false;
  try {
    const res = await fetchWithTimeout(`${base}/health`, { method: 'GET' }, timeoutMs);
    if (!res.ok) return false;
    return isStageStockHealthJson(await res.text());
  } catch {
    return false;
  }
}

function pairingPortCandidates(seedPort: number): number[] {
  return [
    ...new Set([
      seedPort,
      8091,
      8095,
      3847,
      ...Array.from({ length: 21 }, (_, i) => 8090 + i),
    ]),
  ].filter(p => Number.isFinite(p) && p > 0);
}

export type HealthProbeOpts = {
  /** Limite le balayage de ports alternatifs (appairage QR : évite ~15 s d’attente). */
  maxExtraPorts?: number;
  timeoutMs?: number;
};

/** Détection rapide du port StageStock (health seul, sans clé API). */
export async function resolveStageStockBaseFromHealthProbe(
  seedBase: string,
  opts?: HealthProbeOpts
): Promise<string | null> {
  const timeoutMs = opts?.timeoutMs ?? PAIRING_HEALTH_MS;
  const normalized = normalizeHttpBaseUrl(seedBase) ?? stripStageStockServerRootSuffix(seedBase.trim());
  if (!normalized) return null;
  let host = '';
  let protocol = 'http:';
  try {
    const u = new URL(normalized);
    host = u.hostname;
    protocol = u.protocol;
  } catch {
    return null;
  }
  if (!host) return null;

  const seedPort = (() => {
    try {
      const p = new URL(normalized).port;
      return p ? Number(p) : 8091;
    } catch {
      return 8091;
    }
  })();

  const seedUrl = `${protocol}//${host}:${seedPort}`;
  if (await probeStageStockHealth(seedUrl, timeoutMs)) return seedUrl;

  let otherPorts = pairingPortCandidates(seedPort).filter(p => p !== seedPort);
  if (opts?.maxExtraPorts != null) {
    otherPorts = otherPorts.slice(0, Math.max(0, opts.maxExtraPorts));
  }
  for (let i = 0; i < otherPorts.length; i += 6) {
    const batch = otherPorts.slice(i, i + 6);
    const hits = await Promise.all(
      batch.map(async port => {
        const base = `${protocol}//${host}:${port}`;
        return (await probeStageStockHealth(base, timeoutMs)) ? base : null;
      })
    );
    const found = hits.find(Boolean);
    if (found) return found;
  }
  return null;
}

type PairingPingOpts = { attempts?: number; timeoutMs?: number };

/** Ping court pour l’appairage QR (essais sur /health uniquement). */
export async function pairingPingHealthBase(
  baseUrl: string,
  opts?: PairingPingOpts
): Promise<{ ok: boolean; testedBase: string }> {
  const base = stripStageStockServerRootSuffix(baseUrl.trim());
  if (!base) return { ok: false, testedBase: baseUrl.trim() };
  const attempts = opts?.attempts ?? 3;
  const timeoutMs = opts?.timeoutMs ?? PAIRING_PING_MS;
  for (let i = 0; i < attempts; i += 1) {
    if (await probeStageStockHealth(base, timeoutMs)) {
      return { ok: true, testedBase: base };
    }
    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }
  return { ok: false, testedBase: base };
}

export async function probeStageStockSnapshotJson(
  baseUrl: string
): Promise<{ ok: boolean; detail: string }> {
  const base = stripStageStockServerRootSuffix(baseUrl.trim());
  if (!base) return { ok: false, detail: 'URL vide' };
  const url = `${base}/api/sync/snapshot`;
  try {
    const headers = await buildServerAuthHeaders();
    const res = await fetchWithTimeout(url, { method: 'GET', headers }, 12_000);
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status} — ${text.slice(0, 160)}` };
    }
    if (text.trim().startsWith('<')) {
      return { ok: false, detail: 'Page HTML reçue (mauvaise URL, mauvais port, ou pas StageStock Local)' };
    }
    JSON.parse(text);
    return { ok: true, detail: 'JSON OK' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 200) || 'JSON invalide' };
  }
}

/** Cherche le bon port StageStock sur l’hôte (8091, 8092…) quand le QR ou le .env est décalé. */
export async function resolveStageStockBaseWithPortProbe(seedBase: string): Promise<string | null> {
  const normalized = normalizeHttpBaseUrl(seedBase) ?? stripStageStockServerRootSuffix(seedBase.trim());
  if (!normalized) return null;
  let host = '';
  let protocol = 'http:';
  try {
    const u = new URL(normalized);
    host = u.hostname;
    protocol = u.protocol;
  } catch {
    return null;
  }
  if (!host) return null;

  const seedPort = (() => {
    try {
      const p = new URL(normalized).port;
      return p ? Number(p) : 8091;
    } catch {
      return 8091;
    }
  })();

  const ports = pairingPortCandidates(seedPort);

  for (const port of ports) {
    const base = `${protocol}//${host}:${port}`;
    if (!(await probeStageStockHealth(base))) continue;
    const snap = await probeStageStockSnapshotJson(base);
    if (snap.ok) return base;
  }
  return null;
}
