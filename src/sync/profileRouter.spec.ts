import assert from 'node:assert/strict';
import {
  SyncProfileRouter,
  getFileStorageProfile,
  type ProfileRouterDeps,
} from './profileRouter';

/**
 * Couverture S2.0 — SyncProfileRouter.
 *
 * Vérifie la décision déterministe (supabase-first par défaut, docker-first
 * optionnel), le cache TTL, l’anti-ping-pong des probes, et la robustesse face
 * aux dépendances qui throw.
 */

type ProbeCall = { url: string; timeoutMs: number };

function makeDeps(opts: {
  dockerBase?: string | null;
  supabase?: { configured: boolean; url: string | null };
  online?: boolean;
  probeAnswer?: (url: string) => boolean;
  /** Force l’horloge interne. */
  clock?: { now: number };
  /** Capture les events log pour les assertions. */
  logs?: Array<{ level: string; event: string; detail?: unknown }>;
  /** Capture les probes pour vérifier l’anti-ping-pong. */
  probeCalls?: ProbeCall[];
  throwGetDocker?: boolean;
  throwGetSupabase?: boolean;
  throwProbe?: boolean;
  throwIsOnline?: boolean;
}): ProfileRouterDeps {
  return {
    async getDockerBaseUrl() {
      if (opts.throwGetDocker) throw new Error('docker boom');
      return opts.dockerBase ?? null;
    },
    async getSupabaseStatus() {
      if (opts.throwGetSupabase) throw new Error('supabase boom');
      return opts.supabase ?? { configured: false, url: null };
    },
    async isNetworkOnline() {
      if (opts.throwIsOnline) throw new Error('netinfo boom');
      return opts.online ?? true;
    },
    async probeHttp(url, timeoutMs) {
      if (opts.throwProbe) throw new Error('probe boom');
      opts.probeCalls?.push({ url, timeoutMs });
      return opts.probeAnswer ? opts.probeAnswer(url) : false;
    },
    now: () => (opts.clock ? opts.clock.now : Date.now()),
    log: (level, event, detail) => {
      opts.logs?.push({ level, event, detail });
    },
  };
}

async function case_dockerFirst_dockerReachable_winsOverSupabase() {
  const probeCalls: ProbeCall[] = [];
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.10:8091',
      supabase: { configured: true, url: 'https://x.supabase.co' },
      probeAnswer: () => true,
      probeCalls,
    }),
    { primary: 'docker-first' },
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'docker-local');
  if (snap.profile.kind === 'docker-local') {
    assert.equal(snap.profile.baseUrl, 'http://192.168.1.10:8091');
  }
  assert.equal(probeCalls.length, 1);
  assert.equal(probeCalls[0]!.url, 'http://192.168.1.10:8091');
  console.log('  ✓ docker-first : docker joignable gagne contre Supabase');
}

async function case_supabaseFirst_configuredSkipsDockerProbe() {
  const probeCalls: ProbeCall[] = [];
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.10:8091',
      supabase: { configured: true, url: 'https://x.supabase.co' },
      probeAnswer: () => true,
      probeCalls,
    }),
    /** défaut implicite primary: supabase-first */
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'supabase-cloud');
  assert.equal(probeCalls.length, 0, 'aucune probe LAN : Supabase prioritaire');
  console.log('  ✓ supabase-first : Supabase sans probe Docker même si LAN OK');
}

async function case_dockerFirst_unreachable_fallbacksToSupabase() {
  const probeCalls: ProbeCall[] = [];
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.99:8091',
      supabase: { configured: true, url: 'https://x.supabase.co' },
      probeAnswer: () => false,
      probeCalls,
    }),
    { primary: 'docker-first' },
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'supabase-cloud');
  if (snap.profile.kind === 'supabase-cloud') {
    assert.equal(snap.profile.supabaseUrl, 'https://x.supabase.co');
  }
  assert.equal(probeCalls.length, 1);
  console.log('  ✓ docker-first : docker injoignable → supabase-cloud');
}

async function case_supabaseFirst_unreachableDockerStillUsesSupabase() {
  /** Même PC injoignable : supabase-first ne probe pas Docker, choisit le cloud. */
  const probeCalls: ProbeCall[] = [];
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.99:8091',
      supabase: { configured: true, url: 'https://x.supabase.co' },
      probeAnswer: () => false,
      probeCalls,
    }),
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'supabase-cloud');
  assert.equal(probeCalls.length, 0);
  console.log('  ✓ supabase-first : ignore Docker, cloud immédiat');
}

async function case_noBackend_offline() {
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: null,
      supabase: { configured: false, url: null },
    }),
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'offline');
  if (snap.profile.kind === 'offline') {
    assert.equal(snap.profile.reason, 'no-backend-configured');
  }
  console.log('  ✓ aucun backend configuré → offline / no-backend-configured');
}

async function case_dockerOnly_unreachable_offline() {
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.99:8091',
      supabase: { configured: false, url: null },
      probeAnswer: () => false,
    }),
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'offline');
  if (snap.profile.kind === 'offline') {
    assert.equal(snap.profile.reason, 'docker-unreachable-no-supabase');
  }
  console.log('  ✓ docker injoignable + supabase non configuré → offline');
}

async function case_offlineNetwork_shortCircuits() {
  const probeCalls: ProbeCall[] = [];
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.10:8091',
      supabase: { configured: true, url: 'https://x.supabase.co' },
      online: false,
      probeCalls,
    }),
  );
  const snap = await router.refresh();
  assert.equal(snap.profile.kind, 'offline');
  if (snap.profile.kind === 'offline') {
    assert.equal(snap.profile.reason, 'network-down');
  }
  assert.equal(probeCalls.length, 0, 'aucun probe quand réseau down');
  console.log('  ✓ réseau down → offline sans probe (économie batterie)');
}

async function case_ttl_returnsCacheWhenFresh() {
  const probeCalls: ProbeCall[] = [];
  const clock = { now: 1_000 };
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.10:8091',
      probeAnswer: () => true,
      probeCalls,
      clock,
    }),
    { ttlMs: 60_000, primary: 'docker-first' },
  );

  await router.refresh();
  assert.equal(probeCalls.length, 1);
  /** Avance d’à peine 5 s : refresh() doit lire le cache. */
  clock.now += 5_000;
  await router.refresh();
  assert.equal(probeCalls.length, 1, 'cache utilisé, pas de nouvelle probe');
  console.log('  ✓ TTL : refresh ré-utilise le snapshot frais');
}

async function case_ttl_reprobesWhenExpired() {
  const probeCalls: ProbeCall[] = [];
  const clock = { now: 1_000 };
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.10:8091',
      probeAnswer: () => true,
      probeCalls,
      clock,
    }),
    { ttlMs: 10_000, minProbeIntervalMs: 0, primary: 'docker-first' },
  );

  await router.refresh();
  assert.equal(probeCalls.length, 1);
  clock.now += 11_000;
  await router.refresh();
  assert.equal(probeCalls.length, 2, 'TTL expiré → nouvelle probe');
  console.log('  ✓ TTL expiré → nouvelle détection');
}

async function case_antiPingPong_throttlesProbes() {
  const probeCalls: ProbeCall[] = [];
  const clock = { now: 1_000 };
  const router = new SyncProfileRouter(
    makeDeps({
      dockerBase: 'http://192.168.1.10:8091',
      probeAnswer: () => true,
      probeCalls,
      clock,
    }),
    { ttlMs: 10, minProbeIntervalMs: 30_000, primary: 'docker-first' },
  );

  await router.refresh();
  assert.equal(probeCalls.length, 1);
  /** Le TTL expire immédiatement (ttl=10ms) ; mais minProbeIntervalMs=30s
   *  bloque toute nouvelle probe Docker pendant 30 s. Le routeur doit
   *  hériter du profil précédent (docker-local) sans reprobe. */
  clock.now += 1_000;
  const snap2 = await router.refresh({ force: true });
  assert.equal(probeCalls.length, 1, 'probe NON relancée à cause de minProbeIntervalMs');
  assert.equal(snap2.profile.kind, 'docker-local');
  console.log('  ✓ anti-ping-pong : pas de probe < minProbeIntervalMs');
}

async function case_concurrentRefresh_shareInflight() {
  const probeCalls: ProbeCall[] = [];
  let resolveProbe: (v: boolean) => void = () => undefined;

  /** Probe bloquante pour observer l’inflight déduplication. */
  const router = new SyncProfileRouter({
    async getDockerBaseUrl() {
      return 'http://192.168.1.10:8091';
    },
    async getSupabaseStatus() {
      return { configured: false, url: null };
    },
    async isNetworkOnline() {
      return true;
    },
    async probeHttp(url, timeoutMs) {
      probeCalls.push({ url, timeoutMs });
      return new Promise<boolean>((resolve) => {
        resolveProbe = resolve;
      });
    },
    now: () => Date.now(),
  },
  { primary: 'docker-first' },
  );

  const p1 = router.refresh();
  const p2 = router.refresh();
  /** Garantie déterministe : `refresh()` est synchrone jusqu’au `return this.inflight`,
   *  donc les deux appels concurrents retournent EXACTEMENT la même promesse. */
  assert.equal(p1, p2, 'les deux refresh partagent la même promesse (inflight)');

  /** Laisser les micro-tâches avancer pour que probeHttp soit effectivement appelé. */
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(probeCalls.length, 1, 'une seule probe lancée malgré les 2 refresh');
  resolveProbe(true);

  const [s1, s2] = await Promise.all([p1, p2]);
  assert.equal(s1, s2, 'les deux refresh livrent le même snapshot');
  assert.equal(s1.profile.kind, 'docker-local');
  console.log('  ✓ refresh concurrent → une seule probe (inflight partagé)');
}

async function case_safe_handlesThrowingDeps() {
  const logs: Array<{ level: string; event: string; detail?: unknown }> = [];
  const router = new SyncProfileRouter(
    makeDeps({
      throwGetDocker: true,
      throwGetSupabase: true,
      throwIsOnline: true,
      logs,
    }),
  );
  const snap = await router.refresh();
  /** Quand isNetworkOnline jette → fallback online=true (sécurité), puis
   *  docker base = null (jette aussi → null), supabase config = null →
   *  finit en offline / no-backend-configured. */
  assert.equal(snap.profile.kind, 'offline');
  const errorLogs = logs.filter((l) => l.level === 'error' && l.event === 'profile.dep.threw');
  assert.ok(errorLogs.length >= 1, 'au moins un error log pour la dépendance qui jette');
  console.log('  ✓ dépendances qui jettent : fallback offline + log structuré');
}

async function case_getActiveProfile_beforeInit() {
  const router = new SyncProfileRouter(
    makeDeps({ dockerBase: 'http://x:8091' }),
  );
  const before = router.getActiveProfile();
  assert.equal(before.kind, 'offline');
  console.log('  ✓ getActiveProfile() avant init() → offline neutre (pas de throw)');
}

// ─── S2.0bis — FileStorageProfile (storage indépendant du sync data) ─────────

function case_fileStorage_supabaseConfigured() {
  const profile = getFileStorageProfile({
    getSupabaseStatus: () => ({ configured: true, url: 'https://x.supabase.co' }),
  });
  assert.equal(profile.kind, 'supabase');
  if (profile.kind === 'supabase') {
    assert.equal(profile.supabaseUrl, 'https://x.supabase.co');
  }
  console.log('  ✓ Supabase configuré → fileStorage = supabase');
}

function case_fileStorage_notConfigured_localOnly() {
  const profile = getFileStorageProfile({
    getSupabaseStatus: () => ({ configured: false, url: '' }),
  });
  assert.equal(profile.kind, 'local-only');
  if (profile.kind === 'local-only') {
    assert.equal(profile.reason, 'supabase-not-configured');
  }
  console.log('  ✓ Supabase absent → fileStorage = local-only');
}

function case_fileStorage_independentFromSyncData() {
  /** Sans getDataBackendMode, le profil fichier suit uniquement Supabase. */
  const fs = getFileStorageProfile({
    getSupabaseStatus: () => ({ configured: true, url: 'https://x.supabase.co' }),
  });
  assert.equal(fs.kind, 'supabase');
  const local = getFileStorageProfile({
    getSupabaseStatus: () => ({ configured: true, url: 'https://x.supabase.co' }),
    getDataBackendMode: () => 'local_server',
  });
  assert.equal(local.kind, 'local-server');
  console.log('  ✓ fileStorage local-server si mode data local_server (intranet)');
}

async function run() {
  console.log('profile-router.spec — S2.0 + S2.0bis (supabase-first défaut)');
  await case_dockerFirst_dockerReachable_winsOverSupabase();
  await case_supabaseFirst_configuredSkipsDockerProbe();
  await case_dockerFirst_unreachable_fallbacksToSupabase();
  await case_supabaseFirst_unreachableDockerStillUsesSupabase();
  await case_noBackend_offline();
  await case_dockerOnly_unreachable_offline();
  await case_offlineNetwork_shortCircuits();
  await case_ttl_returnsCacheWhenFresh();
  await case_ttl_reprobesWhenExpired();
  await case_antiPingPong_throttlesProbes();
  await case_concurrentRefresh_shareInflight();
  await case_safe_handlesThrowingDeps();
  await case_getActiveProfile_beforeInit();
  case_fileStorage_supabaseConfigured();
  case_fileStorage_notConfigured_localOnly();
  case_fileStorage_independentFromSyncData();
  console.log('profile-router.spec: OK (16/16)');
}

run().catch((e) => {
  console.error('profile-router.spec: FAIL', e);
  process.exit(1);
});
