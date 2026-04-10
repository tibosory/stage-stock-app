import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser } from '../types';
import { verifyAppUserPin, listAppUsersForLogin } from '../db/database';
import { can, Permission } from '../auth/permissions';

const SESSION_KEY = 'stagestock_session_user_id';

type AuthCtx = {
  user: AppUser | null;
  loading: boolean;
  login: (userId: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  can: (p: Permission) => boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) {
      setUser(null);
      setLoading(false);
      return;
    }
    const users = await listAppUsersForLogin();
    const stub = users.find(u => u.id === id);
    if (!stub) {
      await AsyncStorage.removeItem(SESSION_KEY);
      setUser(null);
      setLoading(false);
      return;
    }
    setUser({
      id: stub.id,
      nom: stub.nom,
      role: stub.role,
      pin_hash: '',
      actif: true,
      created_at: '',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (userId: string, pin: string) => {
    const u = await verifyAppUserPin(userId, pin);
    if (!u) return false;
    await AsyncStorage.setItem(SESSION_KEY, u.id);
    setUser({ ...u, pin_hash: '' });
    return true;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const canFn = useCallback((p: Permission) => can(user?.role, p), [user?.role]);

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refreshSession, can: canFn }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
