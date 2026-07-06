const GET_RETRY_DELAY_MS = 400;

export function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === 'AbortError' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  );
}

/**
 * fetch avec délai d'annulation (évite les attentes infinies sur réseau capricieux).
 * Les GET échouant pour cause réseau sont retentés une fois après un court délai.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  attempt = 0,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET' && attempt === 0 && isRetryableFetchError(err)) {
      await new Promise((r) => setTimeout(r, GET_RETRY_DELAY_MS));
      return fetchWithTimeout(url, init, timeoutMs, attempt + 1);
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Délai dépassé — vérifiez la connexion réseau.');
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}
