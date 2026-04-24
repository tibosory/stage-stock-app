import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';

const WINDOWS_INSTALLER_FILENAME = 'Stagestock-Installer.exe';

type Extra = {
  windowsInstallerUrl?: string;
  /** "owner/name" — URL dérivée : https://github.com/owner/name/releases/latest/download/Stagestock-Installer.exe */
  installerGitHubRepo?: string;
};

/**
 * Dépôt GitHub public où le workflow `release-windows-local-installer` publie l'EXE.
 * Surchargé par `expo.extra.installerGitHubRepo` ou `EXPO_PUBLIC_INSTALLER_GITHUB_REPO` (même forme "owner/name").
 */
function getInstallerGitHubOwnerRepo(): { owner: string; repo: string } | null {
  const fromEnv = process.env.EXPO_PUBLIC_INSTALLER_GITHUB_REPO?.trim();
  const raw = fromEnv || (Constants.expoConfig?.extra as Extra | undefined)?.installerGitHubRepo?.trim();
  if (!raw || !raw.includes('/')) return null;
  const [owner, ...rest] = raw.split('/').map((s: string) => s.trim());
  const repo = rest.join('/').replace(/\/+$/, '');
  if (!owner || !repo) return null;
  return { owner, repo };
}

function buildGitHubLatestDownloadUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/releases/latest/download/${WINDOWS_INSTALLER_FILENAME}`;
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
  if (gh) return buildGitHubLatestDownloadUrl(gh.owner, gh.repo);
  return '';
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
    return { url: '', source: 'latest-fallback', appVersion };
  }
  const releasesApi = `https://api.github.com/repos/${gh.owner}/${gh.repo}/releases?per_page=30`;
  const fallback = buildGitHubLatestDownloadUrl(gh.owner, gh.repo);

  try {
    const r = await fetchWithTimeout(
      releasesApi,
      { method: 'GET', headers: { Accept: 'application/vnd.github+json' } },
      7000
    );
    if (r.ok) {
      const json = await r.json();
      const releases = Array.isArray(json) ? json : [];
      const picked = pickReleaseAssetUrl(releases, normalizeVersionKeys(appVersion));
      if (picked) {
        return {
          url: picked.url,
          source: picked.matched ? 'version-matched' : 'latest-fallback',
          appVersion,
          releaseTag: picked.tag || undefined,
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    url: fallback,
    source: 'latest-fallback',
    appVersion,
  };
}
