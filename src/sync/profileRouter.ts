/**
 * SyncProfileRouter — S2.0
 *
 * Sélectionne UN backend cible (single-target) au boot de l’app et en cours
 * d’exécution. Aligne sur les arbitrages :
 *   - choose-runtime : par défaut **Supabase d’abord** si projet configuré et
 *     réseau OK, sinon serveur Docker local si joignable, sinon offline.
 *   - `primary: 'docker-first'` reste disponible pour les installateurs 100 % LAN.
 *   - jamais les deux à la fois (interdiction du mode C historique).
 *
 * Ce module est :
 *   - PURE et TESTABLE : dépendances injectées (NetInfo, AsyncStorage,
 *     probe HTTP, horloge). Aucun import React Native ici.
 *   - INERTE en production : `getActiveProfile()` ne déclenche aucun comportement
 *     côté inventoryApiSync.ts ou syncToSupabase tant que S2.4 ne branche pas
 *     ces appelants. Permet de tester sans risque.
 *
 * Public API :
 *   - `class SyncProfileRouter` : moteur de décision.
 *   - `type SyncProfile`        : résultat narratif (utilisable en UI).
 *   - `type SyncProfileSnapshot`: cache interne avec TTL.
 *
 * Cycle :
 *   1. `init()` lit la config (Docker base + Supabase configured?), probe Docker.
 *   2. `getActiveProfile()` retourne le snapshot courant (synchrone).
 *   3. `refresh()` force une nouvelle détection (sur reconnexion réseau, écran
 *      Paramètres modifié, navigation foreground, etc.).
 *
 * Stratégie déterministe (`primary`, défaut `supabase-first`) :
 *   - **supabase-first** : si Supabase configuré + en ligne → supabase-cloud
 *     (pas de probe HTTP Docker, économie réseau / batterie).
 *     Sinon si Docker configuré + probe OK → docker-local.
 *     Sinon si Supabase configuré → supabase-cloud (branche secours).
 *   - **docker-first** : probe Docker d’abord ; si OK → docker-local ; sinon
 *     Supabase si configuré ; sinon offline.
 *
 * Pour éviter le ping-pong rapide :
 *   - TTL configurable (60 s par défaut).
 *   - `refresh()` ne reprobe pas Docker si la dernière tentative remonte à
 *     moins de `minProbeIntervalMs` (5 s par défaut), sauf `force: true`.
 */

export type SyncProfileKind = 'docker-local' | 'supabase-cloud' | 'offline';

export type SyncProfile =
  | { kind: 'docker-local'; baseUrl: string; lastProbeAt: number }
  | { kind: 'supabase-cloud'; supabaseUrl: string; lastProbeAt: number }
  | { kind: 'offline'; reason: OfflineReason; lastProbeAt: number };

export type OfflineReason =
  | 'no-backend-configured'
  | 'docker-unreachable-no-supabase'
  | 'network-down';

export type SyncProfileSnapshot = {
  profile: SyncProfile;
  detectedAt: number;
  expiresAt: number;
};

export interface ProfileRouterDeps {
  /** Lit l’URL Docker locale active (AsyncStorage override + .env build). Null si inconnu. */
  readonly getDockerBaseUrl: () => Promise<string | null>;
  /** Lit la config Supabase active (override utilisateur ou .env). */
  readonly getSupabaseStatus: () => Promise<{ configured: boolean; url: string | null }>;
  /** Probe HTTP léger (GET base/health). Doit respecter le timeout. */
  readonly probeHttp: (baseUrl: string, timeoutMs: number) => Promise<boolean>;
  /** État réseau global : connecté à internet ou un LAN. */
  readonly isNetworkOnline: () => Promise<boolean>;
  /** Horloge injectable pour les tests. */
  readonly now: () => number;
  /** Log structuré injectable (ne loggue PAS d’URL complète en prod, pas de secrets). */
  readonly log?: (
    level: 'info' | 'warn' | 'error',
    event: string,
    detail?: Record<string, unknown>,
  ) => void;
}

/** Ordre de préférence quand **les deux** backends sont disponibles. */
export type SyncProfilePrimary = 'supabase-first' | 'docker-first';

export type ProfileRouterConfig = {
  /**
   * Quelle cible data est essayée en premier si PC + Supabase sont tous deux
   * en jeu. Défaut : `supabase-first` (offre SaaS / sauvegarde cloud prioritaire).
   */
  primary?: SyncProfilePrimary;
  /** Durée pendant laquelle le snapshot reste valide sans nouvelle détection. */
  ttlMs?: number;
  /** Délai mini entre deux probes Docker (anti-ping-pong). */
  minProbeIntervalMs?: number;
  /** Timeout de la probe Docker. */
  probeTimeoutMs?: number;
};

const DEFAULT_CONFIG: Required<ProfileRouterConfig> = {
  primary: 'supabase-first',
  ttlMs: 60_000,
  minProbeIntervalMs: 5_000,
  probeTimeoutMs: 900,
};

const NEVER = Number.NEGATIVE_INFINITY;

export class SyncProfileRouter {
  private snapshot: SyncProfileSnapshot | null = null;
  private lastProbeAt: number = NEVER;
  private inflight: Promise<SyncProfileSnapshot> | null = null;
  private readonly cfg: Required<ProfileRouterConfig>;

  constructor(
    private readonly deps: ProfileRouterDeps,
    config: ProfileRouterConfig = {},
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /** Snapshot courant. Si jamais détecté, retourne `offline / network-down` neutre. */
  getActiveProfile(): SyncProfile {
    if (this.snapshot) return this.snapshot.profile;
    return {
      kind: 'offline',
      reason: 'network-down',
      lastProbeAt: NEVER,
    };
  }

  /** TTL atteint ? Retourne `true` si la prochaine consultation devrait `refresh()`. */
  isStale(now: number = this.deps.now()): boolean {
    if (!this.snapshot) return true;
    return now >= this.snapshot.expiresAt;
  }

  /**
   * Force ou demande une nouvelle détection.
   * - Si `force: false` ET snapshot frais → retourne le snapshot existant.
   * - Sinon → exécute la détection ; tout appel concurrent rejoint la même promesse.
   *
   * Note : NON marquée `async` à dessein. Une `async function` retourne toujours
   * une nouvelle promesse enveloppe, ce qui casse la déduplication par référence
   * (`p1 === p2`). Ici on renvoie explicitement `this.inflight` pour garantir
   * que tous les appels concurrents partagent la même Promise.
   */
  refresh(opts: { force?: boolean } = {}): Promise<SyncProfileSnapshot> {
    const now = this.deps.now();
    if (!opts.force && this.snapshot && !this.isStale(now)) {
      return Promise.resolve(this.snapshot);
    }
    if (this.inflight) return this.inflight;

    const p = this.detectInternal(now).finally(() => {
      this.inflight = null;
    });
    this.inflight = p;
    return p;
  }

  private async detectInternal(now: number): Promise<SyncProfileSnapshot> {
    let profile: SyncProfile;

    const online = await this.safe(() => this.deps.isNetworkOnline(), true);

    if (!online) {
      profile = { kind: 'offline', reason: 'network-down', lastProbeAt: now };
      this.log('warn', 'profile.offline.network');
      return this.commit(profile, now);
    }

    const sb = await this.safe(
      () => this.deps.getSupabaseStatus(),
      { configured: false, url: null } as { configured: boolean; url: string | null },
    );

    if (this.cfg.primary === 'supabase-first' && sb.configured && sb.url) {
      profile = { kind: 'supabase-cloud', supabaseUrl: sb.url, lastProbeAt: now };
      this.log('info', 'profile.active', { kind: 'supabase-cloud', primary: 'supabase-first' });
      return this.commit(profile, now);
    }

    const dockerBase = (await this.safe(() => this.deps.getDockerBaseUrl(), null))?.trim() ?? '';

    let dockerReachable = false;
    if (dockerBase) {
      const dueForProbe = now - this.lastProbeAt >= this.cfg.minProbeIntervalMs;
      if (dueForProbe) {
        this.lastProbeAt = now;
        dockerReachable = await this.safe(
          () => this.deps.probeHttp(dockerBase, this.cfg.probeTimeoutMs),
          false,
        );
        this.log('info', 'profile.probe.docker', { reachable: dockerReachable });
      } else {
        /** Probe sautée pour éviter le ping-pong : on hérite du snapshot précédent
         *  si on était déjà sur docker-local. Sinon on considère injoignable. */
        dockerReachable =
          this.snapshot?.profile.kind === 'docker-local' &&
          (this.snapshot.profile.baseUrl ?? '').trim() === dockerBase;
      }
    }

    if (dockerBase && dockerReachable) {
      profile = { kind: 'docker-local', baseUrl: dockerBase, lastProbeAt: now };
      this.log('info', 'profile.active', { kind: 'docker-local' });
      return this.commit(profile, now);
    }

    if (sb.configured && sb.url) {
      profile = { kind: 'supabase-cloud', supabaseUrl: sb.url, lastProbeAt: now };
      this.log('info', 'profile.active', { kind: 'supabase-cloud' });
      return this.commit(profile, now);
    }

    profile = {
      kind: 'offline',
      reason: dockerBase ? 'docker-unreachable-no-supabase' : 'no-backend-configured',
      lastProbeAt: now,
    };
    this.log('warn', 'profile.offline', { reason: profile.reason });
    return this.commit(profile, now);
  }

  private commit(profile: SyncProfile, now: number): SyncProfileSnapshot {
    const snap: SyncProfileSnapshot = {
      profile,
      detectedAt: now,
      expiresAt: now + this.cfg.ttlMs,
    };
    this.snapshot = snap;
    return snap;
  }

  private async safe<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      this.log('error', 'profile.dep.threw', {
        detail: e instanceof Error ? e.message : String(e),
      });
      return fallback;
    }
  }

  private log(
    level: 'info' | 'warn' | 'error',
    event: string,
    detail?: Record<string, unknown>,
  ): void {
    if (!this.deps.log) return;
    try {
      this.deps.log(level, event, detail);
    } catch {
      /* on n’ajoute pas de console.log de secours pour éviter de leaker en prod */
    }
  }

  /** Test/diagnostic : remet l’état à zéro (utile entre cas de test). */
  _resetForTests(): void {
    this.snapshot = null;
    this.lastProbeAt = NEVER;
    this.inflight = null;
  }
}

// ─── S2.0bis — File Storage Profile (orthogonal à la sync data) ──────────────
//
// Les photos matériel et PDF notices sont uploadés vers Supabase Storage. Cette
// couche EST INDÉPENDANTE du SyncProfile data ci-dessus. Conséquence pratique :
//   - En mode `docker-local`, la data va vers Express PG MAIS les fichiers
//     binaires continuent de transiter par Supabase Storage (URL conservée
//     dans la colonne `photo_url` / `notice_pdf_url` des entités).
//   - Couper Supabase casse uniquement la couche fichiers, pas la data.
//
// Cette séparation est intentionnelle : Supabase Storage offre un CDN public
// qu’aucune install Docker locale ne fournit out-of-the-box. Si Supabase n’est
// pas configuré, l’upload retourne `null` et seuls les chemins locaux du device
// sont conservés (`photo_local`).

export type FileStorageProfile =
  | { kind: 'supabase'; supabaseUrl: string }
  | { kind: 'local-only'; reason: 'supabase-not-configured' };

export interface FileStorageProfileDeps {
  /** Réutilise `isSupabaseConfigured()` + URL effective côté lib/supabase.ts. */
  readonly getSupabaseStatus: () => { configured: boolean; url: string };
}

/**
 * Lit l’état runtime de Supabase Storage. Stateless et synchrone, on lit
 * directement le client courant : il est garanti initialisé au boot par
 * `initSupabaseFromStorage()` dans `App.tsx`.
 */
export function getFileStorageProfile(deps: FileStorageProfileDeps): FileStorageProfile {
  const { configured, url } = deps.getSupabaseStatus();
  if (configured && url) {
    return { kind: 'supabase', supabaseUrl: url };
  }
  return { kind: 'local-only', reason: 'supabase-not-configured' };
}
