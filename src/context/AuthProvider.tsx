import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Linking } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import {
  getSupabase,
  isSupabaseConfigured,
  onSupabaseClientReplaced,
} from '../lib/supabase';
import { fetchSupabaseProfile, type SupabaseProfileRow } from '../lib/supabaseProfile';
import * as authService from '../services/auth';

type AuthState = {
  loading: boolean;
  error: string | null;
  session: Session | null;
  user: User | null;
  profile: SupabaseProfileRow | null;
};

type AuthContextValue = AuthState & {
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOutSupabase: () => Promise<{ ok: boolean; message?: string }>;
  clearError: () => void;
};

const Ctx = createContext<AuthContextValue | null>(null);

async function hydrateFromDeepLink(url: string): Promise<boolean> {
  const r = await authService.parseAuthCallbackAndSetSession(url);
  return r.ok;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SupabaseProfileRow | null>(null);
  const [supabaseClientGeneration, setSupabaseClientGeneration] = useState(0);

  useEffect(() => {
    return onSupabaseClientReplaced(() => {
      setSupabaseClientGeneration(g => g + 1);
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await getSupabase().auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const p = await fetchSupabaseProfile(uid);
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const boot = async () => {
      const initialUrl = await authService.getInitialUrl();
      if (initialUrl && initialUrl.includes('auth/callback')) {
        const ok = await hydrateFromDeepLink(initialUrl);
        if (!ok) setError("Impossible d'ouvrir la session depuis le lien.");
      }

      const { data: { session: s } } = await getSupabase().auth.getSession();
      if (cancelled) return;
      setSession(s);
      if (s?.user?.id) {
        fetchSupabaseProfile(s.user.id).then(p => {
          if (!cancelled) setProfile(p);
        });
      }
      setLoading(false);
    };

    void boot();

    const sub = Linking.addEventListener('url', ({ url }) => {
      void (async () => {
        if (!url.includes('auth/callback')) return;
        setError(null);
        const ok = await hydrateFromDeepLink(url);
        if (!ok) {
          setError('Échec du jumelage du lien de confirmation.');
          return;
        }
        await refreshProfile();
      })();
    });

    const { data: authSub } = getSupabase().auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        const p = await fetchSupabaseProfile(s.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      authSub.subscription.unsubscribe();
    };
  }, [refreshProfile, supabaseClientGeneration]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const gate = authService.assertSupabase();
      if (!gate.ok) return { ok: false as const, message: gate.message };
      const { error: err } = await authService.signInWithEmail(email, password);
      if (err) return { ok: false as const, message: err.message };
      await refreshProfile();
      return { ok: true as const };
    },
    [refreshProfile]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const gate = authService.assertSupabase();
      if (!gate.ok) return { ok: false as const, message: gate.message };
      const { error: err } = await authService.signUpWithEmail(email, password);
      if (err) return { ok: false as const, message: err.message };
      await refreshProfile();
      return { ok: true as const };
    },
    [refreshProfile]
  );

  const signOutSupabase = useCallback(async () => {
    setError(null);
    const { error: err } = await authService.signOut();
    if (err) return { ok: false as const, message: err.message };
    setSession(null);
    setProfile(null);
    return { ok: true as const };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      error,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signOutSupabase,
      clearError,
    }),
    [
      loading,
      error,
      session,
      profile,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signOutSupabase,
      clearError,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export function useSupabaseAuth(): AuthContextValue {
  return useAuth();
}
