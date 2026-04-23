import { getResolvedApiBase, stageStockApiHeadersAsync } from '../config/stageStockApi';
import { setAccessToken } from './apiEndpointStorage';

export type AssistantJsonPayload = {
  version: number;
  intent: string;
  title: string;
  summary: string;
  details: string[];
  execute_action: null | { action: string; payload?: Record<string, unknown> };
  install_steps: string[];
  diagnostic_hints: string[];
  caveats: string[];
};

export type AssistantAskSuccess = {
  provider: string;
  model: string;
  response: AssistantJsonPayload;
  userId: string | null;
  time: string;
};

export type AssistantAskError = {
  error: string;
  detail?: string;
  hint?: string;
  provider?: string;
  message?: string;
};

/** Délai max côté app (réponse IA + Ollama). Réduit pour feedback plus rapide en cas de blocage ; côté serveur : OLLAMA_TIMEOUT_MS. */
const ASSISTANT_FETCH_TIMEOUT_MS = 120_000;

/**
 * POST /ask — même base URL et clé API que la sync (Réseau / .env).
 */
export async function postAssistantAsk(
  message: string,
  opts?: { userId?: string | null; context?: string }
): Promise<{ ok: true; data: AssistantAskSuccess } | { ok: false; status: number; body: AssistantAskError | string }> {
  const base = await getResolvedApiBase();
  const headers = await stageStockApiHeadersAsync();
  headers['Content-Type'] = 'application/json';
  if (opts?.userId) {
    headers['X-User-Id'] = opts.userId;
  }
  const url = `${base.replace(/\/+$/, '')}/ask`;
  const body: Record<string, string> = { message };
  if (opts?.context?.trim()) {
    body.context = opts.context.trim().slice(0, 5000);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ASSISTANT_FETCH_TIMEOUT_MS);
  const doFetch = (h: Record<string, string>) =>
    fetch(url, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  let res: Response;
  try {
    res = await doFetch(headers);
    /** Jeton cloud périmé : une seconde tentative sans JWT, avec la clé API seule. */
    if (res.status === 401) {
      await setAccessToken(null);
      const headers2 = await stageStockApiHeadersAsync();
      headers2['Content-Type'] = 'application/json';
      if (opts?.userId) {
        headers2['X-User-Id'] = opts.userId;
      }
      res = await doFetch(headers2);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted =
      (e instanceof Error && e.name === 'AbortError') ||
      /abort/i.test(msg);
    if (aborted) {
      return {
        ok: false,
        status: 0,
        body:
          'Délai dépassé (~2 min). Ollama sur le PC peut être lent (CPU, premier chargement du modèle). Vérifiez Ollama, un modèle plus léger (ex. llama3.2:3b dans .env), /diagnostic sur le serveur, ou une question plus courte.',
      };
    }
    return { ok: false, status: 0, body: msg };
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, status: res.status, body: text.slice(0, 500) };
  }
  if (!res.ok) {
    const err = parsed as AssistantAskError;
    return { ok: false, status: res.status, body: err?.error ? err : (parsed as string) };
  }
  const data = parsed as AssistantAskSuccess;
  if (!data?.response || typeof data.response !== 'object') {
    return { ok: false, status: res.status, body: 'Réponse serveur invalide' };
  }
  return { ok: true, data };
}
