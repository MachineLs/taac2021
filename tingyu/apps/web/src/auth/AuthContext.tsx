// Session state. Owned by the lead.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, User } from '@tingyu/shared';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client';
import { takeRefCode } from '../lib/ref';

interface AuthState {
  user: User | null;
  ready: boolean;                       // initial /me check finished
  login: (phone: string, code: string) => Promise<{ user: User; isNew: boolean }>;
  logout: () => void;
  refresh: () => Promise<void>;
  hasRole: (r: Role) => boolean;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return; }
    try { setUser(await api.me()); } catch { tokenStore.set(null); setUser(null); }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { tokenStore.set(null); setUser(null); });
    refresh().finally(() => setReady(true));
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(async (phone: string, code: string) => {
    const res = await api.login({ phone, code, refCode: takeRefCode() ?? undefined });
    tokenStore.set(res.token);
    setUser(res.user);
    return { user: res.user, isNew: res.isNew };
  }, []);

  const logout = useCallback(() => { tokenStore.set(null); setUser(null); }, []);
  const hasRole = useCallback((r: Role) => !!user?.roles.includes(r), [user]);

  const value = useMemo(() => ({ user, ready, login, logout, refresh, hasRole }), [user, ready, login, logout, refresh, hasRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
