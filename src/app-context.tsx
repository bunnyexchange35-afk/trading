import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ApiError,
  adjustDemoBalance,
  apiMessage,
  approveDepositItem,
  claimDemoCreditsApi,
  convertDemoCredits,
  createOrder,
  getCurrentUser,
  loginUser,
  registerUser,
  releaseFrozenItem,
  setDemoLinkStatus,
  stakeInVault,
  submitDeposit,
} from './api';
import type { AuthProfile, Session, User, UserWallet } from './types';

export type FrozenFundCategory = 'order' | 'deposit' | 'staking' | 'withdrawal';
export type { FrozenFundItem, User, UserWallet, WalletTransaction } from './types';

type AuthMode = 'signin' | 'signup';
type Notice = { id: number; title: string; message: string; tone: 'success' | 'info' | 'warning' };

function sanitizeUser(data: unknown): User | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Partial<User> & { name?: string; email?: string; wallet?: Partial<UserWallet> };
  if (!raw.name || !raw.email) return null;

  const rawWallet: Partial<UserWallet> = raw.wallet || {};
  const wallet: UserWallet = {
    realBalance: typeof rawWallet.realBalance === 'number' ? rawWallet.realBalance : 0,
    realUsdtBalance: typeof rawWallet.realUsdtBalance === 'number' ? rawWallet.realUsdtBalance : 0,
    frozenBalance: typeof rawWallet.frozenBalance === 'number' ? rawWallet.frozenBalance : 0,
    frozenUsdtBalance: typeof rawWallet.frozenUsdtBalance === 'number' ? rawWallet.frozenUsdtBalance : 0,
    demoBalance: typeof rawWallet.demoBalance === 'number' ? rawWallet.demoBalance : 10000,
    demoLinked: rawWallet.demoLinked !== undefined ? Boolean(rawWallet.demoLinked) : true,
    conversionRate: typeof rawWallet.conversionRate === 'number' ? rawWallet.conversionRate : 0.1,
    totalConverted: typeof rawWallet.totalConverted === 'number' ? rawWallet.totalConverted : 0,
    assetHoldings: {
      BTC: 0,
      ETH: 0,
      BNB: 0,
      SOL: 0,
      XRP: 0,
      ETC: 0,
      ADA: 0,
      DOGE: 0,
      ...(rawWallet.assetHoldings || {}),
    },
    frozenItems: Array.isArray(rawWallet.frozenItems) ? rawWallet.frozenItems : [],
    transactions: Array.isArray(rawWallet.transactions) ? rawWallet.transactions : [],
  };

  return {
    name: raw.name,
    email: raw.email,
    phone: raw.phone || '',
    preferredCurrency: raw.preferredCurrency || 'INR',
    registeredAt: raw.registeredAt || new Date().toISOString(),
    wallet,
  };
}

type AppState = {
  user: User | null;
  /** True while a backend request is changing auth state (login/register). */
  syncing: boolean;
  authMode: AuthMode | null;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  /** Registers (isNewUser) or logs in through the backend. Throws on failure (after notifying). */
  authenticate: (userProfile: AuthProfile, isNewUser?: boolean) => Promise<void>;
  signOut: () => void;
  notices: Notice[];
  notify: (title: string, message: string, tone?: Notice['tone']) => void;
  dismiss: (id: number) => void;
  // Wallet operations (all backend-driven):
  convertDemoToReal: (demoCredits: number) => Promise<{ success: boolean; realGain: number; message: string }>;
  addDeposit: (amount: number, rail: 'inr' | 'usdt', method: string, reference?: string) => Promise<boolean>;
  approveDeposit: (id: string) => Promise<void>;
  cancelOrReleaseFrozen: (id: string) => Promise<void>;
  addFrozenOrder: (order: {
    title: string;
    amount: number;
    currency: 'INR' | 'USDT';
    asset?: string;
    side?: 'up' | 'down';
  }) => Promise<boolean>;
  addStakingVault: (asset: string, amount: number, apy: number) => Promise<boolean>;
  claimDemoCredits: (amount?: number) => Promise<void>;
  setDemoLinked: (linked: boolean) => Promise<void>;
  updateDemoBalance: (delta: number) => Promise<void>;
  // Conversion modal:
  isConversionOpen: boolean;
  openConversionModal: () => void;
  closeConversionModal: () => void;
};

const AppContext = createContext<AppState | null>(null);
let noticeId = 0;

function readSession(): Session | null {
  try {
    const stored = localStorage.getItem('mudrexx-session');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<Session>;
    return parsed && typeof parsed.email === 'string' && typeof parsed.token === 'string'
      ? { email: parsed.email, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

function readCachedUser(): User | null {
  try {
    const stored = localStorage.getItem('mudrexx-user');
    if (!stored) return null;
    return sanitizeUser(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Start from the cached copy so persistent sessions render instantly,
  // then re-sync from the backend which is the source of truth.
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [session, setSession] = useState<Session | null>(readSession);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Cache the latest backend state for instant session restore next visit.
  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('mudrexx-user', JSON.stringify(user));
      } catch {
        /* storage safe */
      }
    } else {
      localStorage.removeItem('mudrexx-user');
    }
  }, [user]);

  // Persist the backend session token.
  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem('mudrexx-session', JSON.stringify(session));
      } catch {
        /* storage safe */
      }
    } else {
      localStorage.removeItem('mudrexx-session');
    }
  }, [session]);

  const notify = useCallback((title: string, message: string, tone: Notice['tone'] = 'success') => {
    const id = ++noticeId;
    setNotices((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  /** Re-fetch the account from the backend and apply it as the new state. */
  const refreshFromServer = useCallback(async (email: string) => {
    const res = await getCurrentUser(email);
    if (!res?.success || !res.user) {
      throw new ApiError(res?.error || 'Backend rejected the account refresh.', 502);
    }
    const fresh = sanitizeUser(res.user);
    if (!fresh) throw new ApiError('Backend returned an invalid account payload.', 502);
    setUser(fresh);
    return fresh;
  }, []);

  // On mount (or after sign-in), re-sync the stored session with the backend.
  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      try {
        await refreshFromServer(session.email);
      } catch (error) {
        if (active) {
          notify('Backend unavailable', `${apiMessage(error)} Showing the last synced data.`, 'warning');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [session, refreshFromServer, notify]);

  const authenticate = useCallback(
    async (userProfile: AuthProfile, isNewUser = false) => {
      setSyncing(true);
      try {
        const res = isNewUser
          ? await registerUser(userProfile)
          : await loginUser(userProfile.email, userProfile.name);
        if (!res?.success || !res.user) {
          throw new ApiError(res?.error || 'Authentication failed on the backend.', 401);
        }
        const nextUser = sanitizeUser(res.user);
        if (!nextUser) throw new ApiError('Backend returned an invalid account payload.', 502);
        setUser(nextUser);
        setSession({ email: nextUser.email, token: res.token || `mudrexx_${nextUser.email}` });
        setAuthMode(null);
      } catch (error) {
        notify('Authentication failed', apiMessage(error), 'warning');
        throw error;
      } finally {
        setSyncing(false);
      }
    },
    [notify]
  );

  const signOut = useCallback(() => {
    setUser(null);
    setSession(null);
  }, []);

  // Demo to Real Conversion — backend validates and credits the real wallet.
  const convertDemoToReal = useCallback(
    async (demoCredits: number) => {
      if (!user) {
        return { success: false, realGain: 0, message: 'Please sign in to convert demo balance.' };
      }
      try {
        const res = await convertDemoCredits(user.email, demoCredits);
        if (!res?.success) throw new ApiError(res?.error || 'Conversion failed on the backend.');
        await refreshFromServer(user.email);
        notify(
          'Conversion successful! 🎉',
          res.message ||
            `Credited ₹${(res.realGain ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} into your Real Available balance.`,
          'success'
        );
        return {
          success: true,
          realGain: res.realGain ?? 0,
          message: res.message || 'Demo credits converted to real balance.',
        };
      } catch (error) {
        const message = apiMessage(error);
        notify('Conversion failed', message, 'warning');
        return { success: false, realGain: 0, message };
      }
    },
    [user, refreshFromServer, notify]
  );

  // Add Deposit (backend records it in the Frozen Amount section).
  const addDeposit = useCallback(
    async (amount: number, rail: 'inr' | 'usdt', method: string, reference = '') => {
      if (!user) return false;
      try {
        const res = await submitDeposit({ email: user.email, amount, rail, method, reference });
        if (!res?.success) throw new ApiError(res?.error || 'Deposit could not be submitted.');
        await refreshFromServer(user.email);
        notify('Deposit submitted', res.message || 'Your deposit is recorded in the Frozen Balance pending verification.', 'info');
        return true;
      } catch (error) {
        notify('Deposit failed', apiMessage(error), 'warning');
        return false;
      }
    },
    [user, refreshFromServer, notify]
  );

  // Approve pending deposit (backend moves it from frozen to available).
  const approveDeposit = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await approveDepositItem(user.email, id);
        if (!res?.success) throw new ApiError(res?.error || 'Deposit approval failed.');
        await refreshFromServer(user.email);
        notify('Deposit approved & credited! ✅', res.message || 'Funds moved from Frozen to Available Balance.', 'success');
      } catch (error) {
        notify('Approval failed', apiMessage(error), 'warning');
      }
    },
    [user, refreshFromServer, notify]
  );

  // Cancel or Release any Frozen Item back to Available Balance.
  const cancelOrReleaseFrozen = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const res = await releaseFrozenItem(user.email, id);
        if (!res?.success) throw new ApiError(res?.error || 'Release failed on the backend.');
        await refreshFromServer(user.email);
        notify('Funds released! 🔓', res.message || 'Funds returned to your Available Balance.', 'info');
      } catch (error) {
        notify('Release failed', apiMessage(error), 'warning');
      }
    },
    [user, refreshFromServer, notify]
  );

  // Place a real order (backend escrows the funds in Frozen Amount).
  const addFrozenOrder = useCallback(
    async (order: {
      title: string;
      amount: number;
      currency: 'INR' | 'USDT';
      asset?: string;
      side?: 'up' | 'down';
    }) => {
      if (!user) return false;
      try {
        const res = await createOrder({
          email: user.email,
          symbol: order.asset || 'BTC',
          side: order.side || 'up',
          amount: order.amount,
          currency: order.currency,
          accountType: 'real',
        });
        if (!res?.success) throw new ApiError(res?.error || 'Order could not be placed.');
        await refreshFromServer(user.email);
        notify(
          'Order placed & funds frozen',
          res.message || `${order.currency === 'INR' ? '₹' : '₮'}${order.amount.toLocaleString()} is locked in your Frozen Amount section until executed or cancelled.`,
          'success'
        );
        return true;
      } catch (error) {
        notify('Order failed', apiMessage(error), 'warning');
        return false;
      }
    },
    [user, refreshFromServer, notify]
  );

  // Stake in a flexible vault (backend locks the amount in Frozen Balance).
  const addStakingVault = useCallback(
    async (asset: string, amount: number, apy: number) => {
      if (!user) return false;
      try {
        const res = await stakeInVault({ email: user.email, asset, amount, apy });
        if (!res?.success) throw new ApiError(res?.error || 'Staking failed on the backend.');
        await refreshFromServer(user.email);
        notify('Staking vault active! ✨', res.message || `₹${amount.toLocaleString()} is now accruing daily rewards.`, 'success');
        return true;
      } catch (error) {
        notify('Staking failed', apiMessage(error), 'warning');
        return false;
      }
    },
    [user, refreshFromServer, notify]
  );

  // Claim Practice Demo Credits (backend grant).
  const claimDemoCredits = useCallback(
    async (amount = 5000) => {
      if (!user) return;
      try {
        const res = await claimDemoCreditsApi(user.email, amount);
        if (!res?.success) throw new ApiError(res?.error || 'Demo grant failed.');
        await refreshFromServer(user.email);
        notify('Demo credits claimed! 🎁', `Added ${(res.claimedAmount ?? amount).toLocaleString()} credits to your demo wallet.`, 'success');
      } catch (error) {
        notify('Claim failed', apiMessage(error), 'warning');
      }
    },
    [user, refreshFromServer, notify]
  );

  const setDemoLinked = useCallback(
    async (linked: boolean) => {
      if (!user) return;
      try {
        const res = await setDemoLinkStatus(user.email, linked);
        if (!res?.success) throw new ApiError(res?.error || 'Could not update demo link status.');
        await refreshFromServer(user.email);
        notify(
          linked ? 'Demo Linked to Real Account' : 'Demo Unlinked',
          linked
            ? 'Your demo practice trading rewards can now be converted to real wallet balance.'
            : 'Demo conversion is paused.',
          'info'
        );
      } catch (error) {
        notify('Update failed', apiMessage(error), 'warning');
      }
    },
    [user, refreshFromServer, notify]
  );

  // Update demo balance (Flight Lab wagers/cash-outs) — backend-controlled.
  const updateDemoBalance = useCallback(
    async (delta: number) => {
      if (!user) return;
      try {
        const res = await adjustDemoBalance(user.email, delta);
        if (!res?.success) throw new ApiError(res?.error || 'Demo balance update failed.');
        await refreshFromServer(user.email);
      } catch (error) {
        notify('Demo balance update failed', apiMessage(error), 'warning');
        try {
          await refreshFromServer(user.email);
        } catch {
          /* backend still down — keep local state */
        }
      }
    },
    [user, refreshFromServer, notify]
  );

  const openConversionModal = useCallback(() => setIsConversionOpen(true), []);
  const closeConversionModal = useCallback(() => setIsConversionOpen(false), []);

  const value = useMemo<AppState>(
    () => ({
      user,
      syncing,
      authMode,
      openAuth: setAuthMode,
      closeAuth: () => setAuthMode(null),
      authenticate,
      signOut,
      notices,
      notify,
      dismiss,
      convertDemoToReal,
      addDeposit,
      approveDeposit,
      cancelOrReleaseFrozen,
      addFrozenOrder,
      addStakingVault,
      claimDemoCredits,
      setDemoLinked,
      updateDemoBalance,
      isConversionOpen,
      openConversionModal,
      closeConversionModal,
    }),
    [
      user,
      syncing,
      authMode,
      authenticate,
      signOut,
      notices,
      notify,
      dismiss,
      convertDemoToReal,
      addDeposit,
      approveDeposit,
      cancelOrReleaseFrozen,
      addFrozenOrder,
      addStakingVault,
      claimDemoCredits,
      setDemoLinked,
      updateDemoBalance,
      isConversionOpen,
      openConversionModal,
      closeConversionModal,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}
