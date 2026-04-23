import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser } from '../types';
import { verifyAppUserPin, listAppUsersForLogin } from '../db/database';
import { can, Permission } from '../auth/permissions';
import { registerStaffExpoPushToken } from '../lib/registerStaffExpoPushToken';
import { fetchCloudUser, loginCloud, registerCloud, logoutCloud, type CloudUser } from '../lib/cloudAuthApi';

const SESSION_KEY = 'stagestock_session_user_id';

type AuthCtx = {
  user: AppUser | null;
  cloudUser: CloudUser | null;
  loading: boolean;
  login: (userId: string, pin: string) => Promise<boolean>;
  loginWithCloud: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  registerWithCloud: (email: string, password: string, displayName?: string) => Promise<{ ok: boolean; message?: string }>;
  logoutCloudOnly: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  can: (p: Permission) => boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const cu = await fetchCloudUser();
    setCloudUser(cu);
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
    const fullUser: AppUser = {
      id: stub.id,
      nom: stub.nom,
      role: stub.role,
      pin_hash: '',
      actif: true,
      created_at: '',
    };
    setUser(fullUser);
    void registerStaffExpoPushToken(fullUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (userId: string, pin: string) => {
    const u = await verifyAppUserPin(userId, pin);
    if (!u) return false;
    await AsyncStorage.setItem(SESSION_KEY, u.id);
    const logged = { ...u, pin_hash: '' };
    setUser(logged);
    void registerStaffExpoPushToken(logged);
    return true;
  }, []);

  const loginWithCloud = useCallback(async (email: string, password: string) => {
    const r = await loginCloud(email, password);
    if (!r.ok) {
      return { ok: false as const, message: r.message };
    }
    setCloudUser(r.user);
    return { ok: true as const };
  }, []);

  const registerWithCloud = useCallback(async (email: string, password: string, displayName?: string) => {
    const r = await registerCloud(email, password, displayName);
    if (!r.ok) {
      return { ok: false as const, message: r.message };
    }
    setCloudUser(r.user);
    return { ok: true as const };
  }, []);

  const logoutCloudOnly = useCallback(async () => {
    await logoutCloud();
    setCloudUser(null);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    await logoutCloud();
    setUser(null);
    setCloudUser(null);
  }, []);

  const canFn = useCallback((p: Permission) => can(user?.role, p), [user?.role]);

  return (
    <Ctx.Provider
      value={{
        user,
        cloudUser,
        loading,
        login,
        loginWithCloud,
        registerWithCloud,
        logoutCloudOnly,
        logout,
        refreshSession,
        can: canFn,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppAuth outside AppAuthProvider');
  return v;
}
