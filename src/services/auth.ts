import { Linking } from 'react-native';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

/** Doit correspondre au scheme Expo (`stagestock`) + chemin ; ajoutez-la dans Supabase Auth > URL Configuration. */
export const AUTH_CALLBACK_URL = 'stagestock://auth/callback';

export function getEmailRedirectTo(): string {
  return AUTH_CALLBACK_URL;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ session: Session | null; user: User | null; error: AuthError | null }> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { session: data.session, user: data.user ?? null, error };
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ session: Session | null; user: User | null; error: AuthError | null }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: getEmailRedirectTo(),
    },
  });
  return { session: data.session, user: data.user ?? null, error };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await getSupabase().auth.signOut();
  return { error };
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session ?? null;
}

export async function parseAuthCallbackAndSetSession(
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!url.includes('auth/callback')) return { ok: false };

  const codeMatch = url.match(/[?&]code=([^&#]+)/);
  const code = codeMatch ? decodeURIComponent(codeMatch[1]) : undefined;
  if (code) {
    const { error } = await getSupabase().auth.exchangeCodeForSession(code);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const q = url.indexOf('?');
  const h = url.indexOf('#');
  if (q >= 0) {
    const queryOnly = h > q ? url.slice(q + 1, h) : url.slice(q + 1);
    const search = new URLSearchParams(queryOnly);
    const at = search.get('access_token');
    const rt = search.get('refresh_token');
    if (at && rt) {
      const { error } = await getSupabase().auth.setSession({ access_token: at, refresh_token: rt });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
  }

  if (h >= 0) {
    const fragment = url.slice(h + 1);
    const search = new URLSearchParams(fragment);
    const at = search.get('access_token');
    const rt = search.get('refresh_token');
    if (at && rt) {
      const { error } = await getSupabase().auth.setSession({ access_token: at, refresh_token: rt });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
  }

  return { ok: false, error: 'Session introuvable dans le lien.' };
}

export function assertSupabase(): { ok: true } | { ok: false; message: string } {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message:
        'Supabase non configuré : renseignez l’URL et la clé anon (Paramètres → Projet Supabase) ou au build (EXPO_PUBLIC_*).',
    };
  }
  return { ok: true };
}

export function subscribeAuthDeepLinks(
  onUrl: (url: string) => void
): { remove: () => void } {
  const sub = Linking.addEventListener('url', ev => onUrl(ev.url));
  return { remove: () => sub.remove() };
}

export function getInitialUrl(): Promise<string | null> {
  return Linking.getInitialURL();
}
