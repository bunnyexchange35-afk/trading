/**
 * Session provider — the single source of identity for the app.
 *
 * Notes from the verified contract:
 *  - `POST /api/auth/login` rotates `user.auth.token`, so signing in on a
 *    second device invalidates the first. There is exactly one session.
 *  - There is NO logout endpoint. `signOut` is client-side only: it drops the
 *    token and local state. The backend keeps the token valid until the next
 *    login rotates it.
 *  - The backend does not verify a password (audit F11/login handler), so no
 *    credential other than the email is ever transmitted.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getMe,
  getWalletSummary,
  login as apiLogin,
  register as apiRegister,
  type RegisterInput,
  type WalletSummary,
} from '../api';
import { ApiError, errorMessage, readSession, writeSession } from '../api/client';
import type { User } from '../types';

type SessionValue = {
  user: User | null;
  email: string | null;
  token: string | null;
  wallet: WalletSummary | null;
  /** True until the initial `GET /api/auth/me` has resolved. */
  booting: boolean;
  signIn: (email: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  sessionError: string | null;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readSession()?.token ?? null);
  const [email, setEmail] = useState<string | null>(() => readSession()?.email ?? null);
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [booting, setBooting] = useState<boolean>(() => Boolean(readSession()?.token));
  const [sessionError, setSessionError] = useState<string | null>(null);

  const adopt = useCallback((nextEmail: string, nextToken: string, nextUser: User) => {
    writeSession({ email: nextEmail, token: nextToken, name: nextUser.name });
    setToken(nextToken);
    setEmail(nextEmail);
    setUser(nextUser);
    setSessionError(null);
  }, []);

  const clear = useCallback(() => {
    writeSession(null);
    setToken(null);
    setEmail(null);
    setUser(null);
    setWallet(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      if (me.user) {
        setUser(me.user);
        if (me.user.email) setEmail(me.user.email);
      } else {
        // Token was not recognised — the session is gone.
        clear();
      }
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'auth') clear();
    }
  }, [clear]);

  const refreshWallet = useCallback(async () => {
    if (!readSession()?.email) return;
    try {
      const response = await getWalletSummary();
      setWallet(response.summary);
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'auth') clear();
    }
  }, [clear]);

  // Restore the session on load.
  useEffect(() => {
    let active = true;
    const boot = async () => {
      const stored = readSession();
      if (!stored?.token) {
        setBooting(false);
        return;
      }
      try {
        const me = await getMe();
        if (!active) return;
        if (me.user) {
          setUser(me.user);
          setEmail(me.user.email);
        } else {
          clear();
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.kind === 'auth') clear();
        else setSessionError(errorMessage(error));
      } finally {
        if (active) setBooting(false);
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, [clear]);

  // Keep the wallet snapshot in step with the session.
  useEffect(() => {
    if (!email || !token) {
      setWallet(null);
      return;
    }
    void refreshWallet();
  }, [email, token, refreshWallet]);

  const signIn = useCallback(
    async (nextEmail: string) => {
      const trimmed = nextEmail.trim().toLowerCase();
      if (!trimmed) throw new ApiError('Enter the email on your account.', 422, 'validation');
      const response = await apiLogin(trimmed);
      adopt(response.user.email || trimmed, response.token, response.user);
    },
    [adopt],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      const response = await apiRegister({
        ...input,
        email: input.email.trim().toLowerCase(),
        ...(input.inviteCode?.trim() ? { inviteCode: input.inviteCode.trim() } : {}),
      });
      adopt(response.user.email || input.email.trim().toLowerCase(), response.token, response.user);
    },
    [adopt],
  );

  const signOut = useCallback(() => clear(), [clear]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      email,
      token,
      wallet,
      booting,
      signIn,
      signUp,
      signOut,
      refreshUser,
      refreshWallet,
      sessionError,
    }),
    [user, email, token, wallet, booting, signIn, signUp, signOut, refreshUser, refreshWallet, sessionError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>.');
  return context;
}

export const useIsSignedIn = (): boolean => Boolean(useSession().token);
