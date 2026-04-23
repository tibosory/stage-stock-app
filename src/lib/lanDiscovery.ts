import { getBundledDefaultApiBase, getResolvedApiBase } from '../config/stageStockApi';

type DiscoverResult = { baseUrl: string; healthUrl: string; note: string };

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return null;
  }
}

function isIpv4Host(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function privatePrefix(host: string): string | null {
  if (!isIpv4Host(host)) return null;
  const p = host.split('.').map(v => Number(v));
  if (p.length !== 4) return null;
  if (p[0] === 10) return `${p[0]}.${p[1]}.${p[2]}`;
  if (p[0] === 192 && p[1] === 168) return `${p[0]}.${p[1]}.${p[2]}`;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return `${p[0]}.${p[1]}.${p[2]}`;
  return null;
}

/** Faux réseau local /24 (192.168.x, 10.x, 172.16–31) pour prioriser le balayage. */
export function privateSubnetPrefixForIpv4(host: string): string | null {
  return privatePrefix(host);
}

export type LanDiscoveryOptions = {
  /** Sous-réseaux à tester en premier (ex. Wi‑Fi de l’appareil via expo-network). */
  preferredSubnetPrefixes?: string[];
};

function candidatePrefixes(extra?: string | null): string[] {
  const out = new Set<string>();
  if (extra) out.add(extra);
  out.add('192.168.1');
  out.add('192.168.0');
  out.add('10.0.0');
  out.add('10.0.1');
  out.add('172.16.0');
  return [...out];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function probe(baseUrl: string, timeoutMs: number): Promise<DiscoverResult | null> {
  const healthUrl = `${stripTrailingSlash(baseUrl)}/health`;
  try {
    const res = await fetchWithTimeout(healthUrl, timeoutMs);
    if (!res.ok) return null;
    const text = await res.text();
    const low = text.toLowerCase();
    if (low.includes('stagestock') || low.includes('"ok":true') || low.includes('"ok": true')) {
      return {
        baseUrl: stripTrailingSlash(baseUrl),
        healthUrl,
        note: text.slice(0, 140),
      };
    }
    return {
      baseUrl: stripTrailingSlash(baseUrl),
      healthUrl,
      note: 'health endpoint reachable',
    };
  } catch {
    return null;
  }
}

async function firstSuccessInPool(
  targets: string[],
  timeoutMs: number,
  concurrency: number
): Promise<DiscoverResult | null> {
  let i = 0;
  let found: DiscoverResult | null = null;
  async function worker() {
    while (!found && i < targets.length) {
      const idx = i++;
      const res = await probe(targets[idx], timeoutMs);
      if (res && !found) {
        found = res;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return found;
}

export async function discoverStageStockOnLan(
  options?: LanDiscoveryOptions
): Promise<DiscoverResult | null> {
  const resolved = await getResolvedApiBase();
  const bundled = getBundledDefaultApiBase();
  const currentHost = hostFromUrl(resolved) ?? hostFromUrl(bundled) ?? '';
  const pref = privatePrefix(currentHost);
  const devicePrefs = (options?.preferredSubnetPrefixes ?? []).filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );
  const prefixes = [...new Set([...devicePrefs, ...candidatePrefixes(pref)])];
  const ports = [3847, 3000];

  const directCandidates = [resolved, bundled]
    .map(stripTrailingSlash)
    .filter((v, idx, arr) => !!v && arr.indexOf(v) === idx);
  const direct = await firstSuccessInPool(directCandidates, 900, 2);
  if (direct) return direct;

  for (const pr of prefixes) {
    const targets: string[] = [];
    for (let host = 1; host <= 254; host++) {
      for (const port of ports) {
        targets.push(`http://${pr}.${host}:${port}`);
      }
    }
    const hit = await firstSuccessInPool(targets, 350, 24);
    if (hit) return hit;
  }
  return null;
}
