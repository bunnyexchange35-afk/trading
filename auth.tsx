import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken } from './api';
import type { Staff } from './types';

interface AuthState {
  staff: Staff | null;
  lockdown: boolean;
  maintenance: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ mfaRequired?: boolean; tempToken?: string }>;
  verifyMfa: (tempToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (perm: string) => boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [lockdown, setLockdown] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setStaff(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ data: { staff: Staff; lockdown: boolean; maintenance: boolean } }>('/auth/me');
      setStaff(res.data.staff);
      setLockdown(res.data.lockdown);
      setMaintenance(res.data.maintenance);
    } catch {
      setToken(null);
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token?: string; mfaRequired?: boolean; tempToken?: string; staff?: Staff }>('/auth/login', { username, password });
    if (res.mfaRequired) {
      return { mfaRequired: true, tempToken: res.tempToken };
    }
    if (res.token) {
      setToken(res.token);
      await refresh();
    }
    return {};
  }, [refresh]);

  const verifyMfa = useCallback(
    async (tempToken: string, code: string) => {
      const res = await api.post<{ token: string }>('/auth/mfa/verify', { tempToken, code });
      setToken(res.token);
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setToken(null);
    setStaff(null);
  }, []);

  const can = useCallback(
    (perm: string) => {
      if (!staff) return false;
      if (staff.role === 'master_admin') return true;
      return !!staff.permissions[perm];
    },
    [staff]
  );

  const value = useMemo<AuthState>(
    () => ({ staff, lockdown, maintenance, loading, login, verifyMfa, logout, refresh, can }),
    [staff, lockdown, maintenance, loading, login, verifyMfa, logout, refresh, can]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
