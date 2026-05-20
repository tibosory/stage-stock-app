import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';

const WINDOWS_INSTALLER_FILENAME = 'Stagestock-Installer.exe';
const WINDOWS_INSTALLER_NAME_HINTS = ['stagestock', 'serveur', 'oneclick', 'setup', 'installer'];
const DEFAULT_INSTALLER_REPO = { owner: 'tibosory', repo: 'stage-stock-app' };

type Extra = {
  windowsInstallerUrl?: string;
  /** "owner/name" — URL dérivée : https://github.com/owner/name/releases/latest/download/Stagestock-Installer.exe */
  installerGitHubRepo?: string;
};

/**
 * Dépôt GitHub public dont la dernière **release** contient `Stagestock-Installer.exe` (souvent stage-stock-app).
 * Surchargé par `expo.extra.installerGitHubRepo` ou `EXPO_PUBLIC_INSTALLER_GITHUB_REPO` (forme "owner/name").
 */
function getInstallerGitHubOwnerRepo(): { owner: string; repo: string } | null {
  const fromEnv = process.env.EXPO_PUBLIC_INSTALLER_GITHUB_REPO?.trim();
  const raw = fromEnv || (Constants.expoConfig?.extra as Extra | undefined)?.installerGitHubRepo?.trim();
  if (!raw || !raw.includes('/')) return DEFAULT_INSTALLER_REPO;
  const [owner, ...rest] = raw.split('/').map((s: string) => s.trim());
  const repo = rest.join('/').replace(/\/+$/, '');
  if (!owner || !repo) return DEFAULT_INSTALLER_REPO;
  return { owner, repo };
}

function buildGitHubLatestDownloadUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/releases/latest/download/${WINDOWS_INSTALLER_FILENAME}`;
}

function buildGitHubLatestReleasePageUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/releases/latest`;
}

function buildGitHubTagDownloadUrl(owner: string, repo: string, tag: string): string {
  return `https://github.com/${owner}/${repo}/releases/download/${encodeURIComponent(tag)}/${WINDOWS_INSTALLER_FILENAME}`;
}

function githubApiHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    // Certains environnements RN obtiennent des réponses plus fiables avec un User-Agent explicite.
    'User-Agent': 'StageStock-App',
  };
}

async function tryFetchJson(url: string, timeoutMs: number): Promise<any | null> {
  try {
    const r = await fetchWithTimeout(url, { method: 'GET', headers: githubApiHeaders() }, timeoutMs);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function normalizeGitHubHref(href: string): string {
  const h = href.replace(/&amp;/g, '&').trim();
  if (!h) return '';
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('/')) return `https://github.com${h}`;
  return '';
}

function pickExeDownloadUrlFromReleaseHtml(html: string): string | null {
  const byAssetPath = html.match(/href="([^"]*\/releases\/download\/[^"]*\.exe[^"]*)"/i)?.[1];
  if (byAssetPath) {
    const n = normalizeGitHubHref(byAssetPath);
    if (n) return n;
  }
  const byNameHint = html.match(/href="([^"]*\.exe[^"]*)"/i)?.[1];
  if (byNameHint) {
    const n = normalizeGitHubHref(byNameHint);
    if (n) return n;
  }
  return null;
}

/**
 * @deprecated Préférez getWindowsServerInstallerUrl(). Conservé pour compat d'import.
 */
export const GITHUB_WINDOWS_INSTALLER_RELEASE_URL = (() => {
  const p = getInstallerGitHubOwnerRepo();
  if (p) return buildGitHubLatestDownloadUrl(p.owner, p.repo);
  return '';
})();

export type WindowsInstallerResolved = {
  url: string;
  source: 'custom' | 'version-matched' | 'latest-fallback';
  appVersion: string | null;
  releaseTag?: string;
};

/**
 * URL HTTPS de l'installateur Windows. Priorité :
 * 1) EXPO_PUBLIC_WINDOWS_INSTALLER_URL
 * 2) expo.extra.windowsInstallerUrl (URL complète)
 * 3) dérivé de EXPO_PUBLIC_INSTALLER_GITHUB_REPO ou extra.installerGitHubRepo
 * 4) chaîne vide (le flux « Téléchargement » doit proposer l'envoi PC / autre hébergeur)
 */
export function getWindowsServerInstallerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WINDOWS_INSTALLER_URL?.trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const fromExtra = extra?.windowsInstallerUrl?.trim();
  if (fromExtra) return fromExtra;
  const gh = getInstallerGitHubOwnerRepo();
  if (gh) return buildGitHubLatestReleasePageUrl(gh.owner, gh.repo);
  return buildGitHubLatestReleasePageUrl(DEFAULT_INSTALLER_REPO.owner, DEFAULT_INSTALLER_REPO.repo);
}

function detectAppVersion(): string | null {
  const fromNative = Application.nativeApplicationVersion?.trim();
  if (fromNative) return fromNative;
  const fromExpoConfig = Constants.expoConfig?.version?.trim();
  if (fromExpoConfig) return fromExpoConfig;
  return null;
}

function normalizeVersionKeys(v: string | null): string[] {
  if (!v) return [];
  const t = v.trim();
  if (!t) return [];
  const parts = t.split('.');
  const majorMinor = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : t;
  const out = [t, majorMinor].filter(Boolean);
  return Array.from(new Set(out));
}

function pickReleaseAssetUrl(
  releases: any[],
  versionKeys: string[]
): { url: string; tag: string; matched: boolean } | null {
  const findAsset = (rel: any): string | null => {
    const assets = Array.isArray(rel?.assets) ? rel.assets : [];
    const exact = assets.find((a: any) => a?.name === WINDOWS_INSTALLER_FILENAME);
    if (exact?.browser_download_url) return String(exact.browser_download_url);
    const preferredExe = assets.find((a: any) => {
      const n = String(a?.name || '').toLowerCase();
      if (!n.endsWith('.exe')) return false;
      return WINDOWS_INSTALLER_NAME_HINTS.some(h => n.includes(h));
    });
    if (preferredExe?.browser_download_url) return String(preferredExe.browser_download_url);
    const anyExe = assets.find((a: any) => String(a?.name || '').toLowerCase().endsWith('.exe'));
    return anyExe?.browser_download_url ? String(anyExe.browser_download_url) : null;
  };

  if (versionKeys.length > 0) {
    for (const rel of releases) {
      const tag = String(rel?.tag_name || '');
      const name = String(rel?.name || '');
      const body = String(rel?.body || '');
      const hay = `${tag}\n${name}\n${body}`.toLowerCase();
      const matched = versionKeys.some(k => hay.includes(k.toLowerCase()));
      if (!matched) continue;
      const url = findAsset(rel);
      if (url) return { url, tag, matched: true };
    }
  }

  for (const rel of releases) {
    const tag = String(rel?.tag_name || '');
    const url = findAsset(rel);
    if (url) return { url, tag, matched: false };
  }
  return null;
}

/**
 * Tente l'URL directe d'un release asset ; sinon l'URL "latest/download" cohérente avec le dépôt configuré.
 */
export async function resolveWindowsServerInstallerUrl(): Promise<WindowsInstallerResolved> {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const explicit = process.env.EXPO_PUBLIC_WINDOWS_INSTALLER_URL?.trim() || extra?.windowsInstallerUrl?.trim() || '';
  const appVersion = detectAppVersion();
  if (explicit) {
    return { url: explicit, source: 'custom', appVersion };
  }

  const gh = getInstallerGitHubOwnerRepo();
  if (!gh) {
    return {
      url: buildGitHubLatestDownloadUrl(DEFAULT_INSTALLER_REPO.owner, DEFAULT_INSTALLER_REPO.repo),
      source: 'latest-fallback',
      appVersion,
    };
  }
  const latestReleaseApi = `https://api.github.com/repos/${gh.owner}/${gh.repo}/releases/latest`;
  const releasesApi = `https://api.github.com/repos/${gh.owner}/${gh.repo}/releases?per_page=30`;
  try {
    // Retry léger API GitHub (mobile/réseau lent)
    for (let i = 0; i < 2; i += 1) {
      const latestJson = await tryFetchJson(latestReleaseApi, 15000);
      if (latestJson) {
        const pickedLatest = pickReleaseAssetUrl([latestJson], normalizeVersionKeys(appVersion));
        if (pickedLatest) {
          return {
            url: pickedLatest.url,
            source: pickedLatest.matched ? 'version-matched' : 'latest-fallback',
            appVersion,
            releaseTag: pickedLatest.tag || undefined,
          };
        }
      }
      const json = await tryFetchJson(releasesApi, 15000);
      if (Array.isArray(json)) {
        const picked = pickReleaseAssetUrl(json, normalizeVersionKeys(appVersion));
        if (picked) {
          return {
            url: picked.url,
            source: picked.matched ? 'version-matched' : 'latest-fallback',
            appVersion,
            releaseTag: picked.tag || undefined,
          };
        }
      }
    }
  } catch {
    // fallback
  }

  // Fallback HTML: récupère la page release et extrait un lien .exe réel.
  try {
    const latestHtml = await fetchWithTimeout(
      buildGitHubLatestReleasePageUrl(gh.owner, gh.repo),
      { method: 'GET' },
      15000
    );
    if (latestHtml.ok) {
      const html = await latestHtml.text();
      const exeUrl = pickExeDownloadUrlFromReleaseHtml(html);
      if (exeUrl) {
        return {
          url: exeUrl,
          source: 'latest-fallback',
          appVersion,
        };
      }
    }
  } catch {
    // fallback
  }

  // Fallback robuste: "latest/download" peut répondre 404 sur certains contextes GitHub.
  // On résout alors d'abord le tag réel via la page /releases/latest, puis on construit /releases/download/<tag>/...
  try {
    const latestPage = await fetchWithTimeout(
      buildGitHubLatestReleasePageUrl(gh.owner, gh.repo),
      { method: 'GET' },
      7000
    );
    const finalUrl = String((latestPage as any)?.url || '');
    const m = finalUrl.match(/\/releases\/tag\/([^/?#]+)/i);
    if (m?.[1]) {
      const tag = decodeURIComponent(m[1]);
      return {
        url: buildGitHubTagDownloadUrl(gh.owner, gh.repo, tag),
        source: 'latest-fallback',
        appVersion,
        releaseTag: tag,
      };
    }
  } catch {
    // fallback final
  }

  return {
    url: buildGitHubLatestDownloadUrl(gh.owner, gh.repo),
    source: 'latest-fallback',
    appVersion,
  };
}
