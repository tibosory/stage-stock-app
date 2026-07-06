const ABSOLUTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const HOST_WITH_OPTIONAL_PORT_RE =
  /^(localhost|(\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\]|[a-z0-9.-]+)(:\d+)?(\/.*)?$/i;

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

/**
 * Supprime un suffixe `/api` ou page d'appairage en fin d'URL serveur.
 */
export function stripStageStockServerRootSuffix(url: string): string {
  const t = url.trim();
  if (!t) return '';
  const candidate = ABSOLUTE_SCHEME_RE.test(t) ? t : `http://${t}`;
  try {
    const u = new URL(candidate);
    let path = u.pathname.replace(/\/+$/, '') || '/';
    if (/^\/api$/i.test(path)) {
      path = '/';
    } else if (/^\/(pair\.html|pair|serveur\.html|diagnostic)$/i.test(path)) {
      path = '/';
    }
    const port = u.port ? `:${u.port}` : '';
    const root = `${u.protocol}//${u.hostname}${port}`;
    if (path === '/') return root;
    return trimSlash(`${root}${path}`);
  } catch {
    let legacy = t.replace(/\/+$/, '');
    if (/\/api$/i.test(legacy)) {
      legacy = legacy.replace(/\/api$/i, '').replace(/\/+$/, '');
    }
    legacy = legacy.replace(/\/(pair\.html|pair|serveur\.html|diagnostic)$/i, '').replace(/\/+$/, '');
    return legacy;
  }
}

export function normalizeHttpBaseUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  let candidate = t;
  if (!ABSOLUTE_SCHEME_RE.test(candidate)) {
    if (!HOST_WITH_OPTIONAL_PORT_RE.test(candidate)) return null;
    candidate = `http://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname) return null;
    return stripStageStockServerRootSuffix(trimSlash(u.toString()));
  } catch {
    return null;
  }
}

/** Validation minimale : schéma http(s) et au moins une autorité. */
export function looksLikeHttpUrl(s: string): boolean {
  return normalizeHttpBaseUrl(s) !== null;
}
