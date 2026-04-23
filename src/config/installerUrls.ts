import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';

/**
 * Dépôt où le workflow `.github/workflows/release-windows-local-installer.yml` publie
 * `Stagestock-Installer.exe` (sans `.git` dans l’URL de téléchargement).
 */
export const GITHUB_WINDOWS_INSTALLER_RELEASE_URL =
  'https://github.com/tibosory/stage-stock-app/releases/latest/download/Stagestock-Installer.exe';

const GITHUB_OWNER = 'tibosory';
const GITHUB_REPO = 'stage-stock-app';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=30`;
const WINDOWS_INSTALLER_FILENAME = 'Stagestock-Installer.exe';

export type WindowsInstallerResolved = {
  url: string;
  source: 'custom' | 'version-matched' | 'latest-fallback';
  appVersion: string | null;
  releaseTag?: string;
};

/**
 * URL HTTPS vers l’installateur Windows (`Stagestock-Installer.exe`) ou page de téléchargement.
 * Définir `EXPO_PUBLIC_WINDOWS_INSTALLER_URL` au build (EAS / .env) ou `expo.extra.windowsInstallerUrl` dans app.json.
 */
export function getWindowsServerInstallerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WINDOWS_INSTALLER_URL?.trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { windowsInstallerUrl?: string } | undefined;
  const fromExtra = extra?.windowsInstallerUrl?.trim();
  if (fromExtra) return fromExtra;
  return GITHUB_WINDOWS_INSTALLER_RELEASE_URL;
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
 * Tente de récupérer l’installateur Windows compatible avec la version de l’APK.
 * Fallback robuste vers l’URL "latest/download".
 */
export async function resolveWindowsServerInstallerUrl(): Promise<WindowsInstallerResolved> {
  const explicit = process.env.EXPO_PUBLIC_WINDOWS_INSTALLER_URL?.trim()
    || ((Constants.expoConfig?.extra as { windowsInstallerUrl?: string } | undefined)?.windowsInstallerUrl?.trim() ?? '');
  const appVersion = detectAppVersion();
  if (explicit) {
    return { url: explicit, source: 'custom', appVersion };
  }

  try {
    const r = await fetchWithTimeout(
      GITHUB_RELEASES_API,
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
    // fallback silencieux
  }

  return {
    url: GITHUB_WINDOWS_INSTALLER_RELEASE_URL,
    source: 'latest-fallback',
    appVersion,
  };
}
