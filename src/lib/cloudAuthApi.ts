import { getResolvedApiBase } from '../config/stageStockApi';
import { getAccessToken, setAccessToken } from './apiEndpointStorage';

export type CloudUser = {
  id: string;
  email: string;
  displayName: string | null;
  plan: 'free' | 'premium';
  premiumUntil: string | null;
};

type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    plan: string;
    premiumUntil: string | null;
  };
};

function mapUser(u: AuthResponse['user']): CloudUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    plan: u.plan === 'premium' ? 'premium' : 'free',
    premiumUntil: u.premiumUntil,
  };
}

export async function registerCloud(
  email: string,
  password: string,
  displayName?: string
): Promise<{ ok: true; user: CloudUser } | { ok: false; message: string }> {
  const base = await getResolvedApiBase();
  const url = `${base.replace(/\/+$/, '')}/auth/register`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        displayName: displayName?.trim() || undefined,
      }),
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, message: text.slice(0, 200) || 'Erreur serveur' };
    }
    if (!res.ok) {
      const msg = (body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error;
      return { ok: false, message: msg || `Erreur ${res.status}` };
    }
    const data = body as AuthResponse;
    if (!data.token || !data.user) {
      return { ok: false, message: 'Réponse invalide' };
    }
    await setAccessToken(data.token);
    return { ok: true, user: mapUser(data.user) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function loginCloud(
  email: string,
  password: string
): Promise<{ ok: true; user: CloudUser } | { ok: false; message: string }> {
  const base = await getResolvedApiBase();
  const url = `${base.replace(/\/+$/, '')}/auth/login`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, message: text.slice(0, 200) || 'Erreur serveur' };
    }
    if (!res.ok) {
      const msg = (body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error;
      return { ok: false, message: msg || `Erreur ${res.status}` };
    }
    const data = body as AuthResponse;
    if (!data.token || !data.user) {
      return { ok: false, message: 'Réponse invalide' };
    }
    await setAccessToken(data.token);
    return { ok: true, user: mapUser(data.user) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchCloudUser(): Promise<CloudUser | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const base = await getResolvedApiBase();
  const url = `${base.replace(/\/+$/, '')}/auth/me`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        await setAccessToken(null);
      }
      return null;
    }
    const body = (await res.json()) as { user: AuthResponse['user'] };
    if (!body?.user) return null;
    return mapUser(body.user);
  } catch {
    return null;
  }
}

export async function logoutCloud(): Promise<void> {
  await setAccessToken(null);
}
