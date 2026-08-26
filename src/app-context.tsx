import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACCESS_REQUIRED,
  ApiError,
  type AuthSnapshot,
  type BackendContract,
  adjustDemoBalance,
  apiMessage,
  approveDepositItem,
  claimDemoCreditsApi,
  convertDemoCredits,
  createOrder,
  isAccessRequired,
  loginUser,
  parseAccessInput,
  probeAuth,
  readAccessFromLocation,
  redeemAccessLink,
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
    inviteCode: typeof raw.inviteCode === 'string' ? raw.inviteCode : '',
    invitedBy: typeof raw.invitedBy === 'string' ? raw.invitedBy : '',
    invitedByType: raw.invitedByType === 'admin' || raw.invitedByType === 'user' ? raw.invitedByType : '',
    wallet,
  };
}

type AppState = {
  user: User | null;
  /** True while a backend request is changing auth state (login/register). */
  syncing: boolean;
  /** Detected backend contract. `v2` is the live private-mode mudrexx-control API. */
  backendContract: BackendContract;
  /** True when live mudrexxback is in private mode and this browser has no access grant. */
  accessRequired: boolean;
  accessType: string;
  redeemAccess: (input: string) => Promise<boolean>;
  authMode: AuthMode | null;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  /** Registers (isNewUser) or logs in through the backend. Throws on failure (after notifying). */
  authenticate: (userProfile: AuthProfile, isNewUser?: boolean) => Promise<void>;
  /** Re-syncs the signed-in user (and wallet) from the backend. */
  refreshUser: (email?: string) => Promise<unknown>;
  signOut: () => void;
  notices: Notice[];
  notify: (title: string, message: string, tone?: Notice['tone']) => void;
  dismiss: (id: number) => void;
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
    durationSeconds?: number;
    payoutPercent?: number;
  }) => Promise<boolean>;
  addStakingVault: (asset: string, amount: number, apy: number) => Promise<boolean>;
  claimDemoCredits: (amount?: number) => Promise<void>;
  setDemoLinked: (linked: boolean) => Promise<void>;
  updateDemoBalance: (delta: number) => Promise<void>;
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

function clearLinkPath() {
  if (!window.history.replaceState) return;
  const onLinkPath = /^\/[as]\/[^/]+/.test(window.location.pathname);
  window.history.replaceState({}, '', onLinkPath ? '/' : window.location.pathname);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [session, setSession] = useState<Session | null>(readSession);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backendContract, setBackendContract] = useState<BackendContract>('unknown');
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessType, setAccessType] = useState('unknown');

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

  const applySnapshot = useCallback((snap: AuthSnapshot) => {
    setBackendContract(snap.contract);
    setAccessType(snap.type);
    setAccessRequired(snap.accessRequired);

    if (snap.user) {
      const fresh = sanitizeUser(snap.user) ?? snap.user;
      setUser(fresh);
      if (snap.token) setSession({ email: fresh.email, token: snap.token });
      return fresh;
    }

    if (snap.contract === 'v2' && snap.accessRequired) {
      setUser(null);
      setSession(null);
    }
    return null;
  }, []);

  const refreshFromServer = useCallback(
    async (email?: string) => {
      const snap = await probeAuth(email);
      const fresh = applySnapshot(snap);
      if (snap.contract === 'v2') return fresh;
      if (!fresh) {
        throw new ApiError(
          snap.accessRequired ? ACCESS_REQUIRED : 'Backend rejected the account refresh.',
          snap.accessRequired ? 403 : 502,
          snap.accessRequired ? ACCESS_REQUIRED : undefined
        );
      }
      return fresh;
    },
    [applySnapshot]
  );

  const redeemAccess = useCallback(
    async (input: string) => {
      const parsed = parseAccessInput(input);
      if (!parsed) {
        notify('Access code required', 'Paste a V2 source/access link or code.', 'warning');
        return false;
      }
      setSyncing(true);
      try {
        const snap = await redeemAccessLink(parsed.kind, parsed.code);
        applySnapshot(snap);
        if (snap.accessRequired && !snap.user) {
          notify(
            'Access still required',
            'That link did not grant a session. Confirm it is a live V2 source or access URL.',
            'warning'
          );
          return false;
        }
        notify(
          snap.user ? 'Access granted' : 'Private desk unlocked',
          snap.user
            ? `Signed in as ${snap.user.name}.`
            : 'The live backend accepted this source/access link. Wallet calls still follow the V2 contract.',
          'success'
        );
        return true;
      } catch (error) {
        notify('Access failed', apiMessage(error), 'warning');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [applySnapshot, notify]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const pending = readAccessFromLocation();
      try {
        if (pending) {
          const snap = await redeemAccessLink(pending.kind, pending.code);
          if (!active) return;
          applySnapshot(snap);
          clearLinkPath();
          if (!snap.accessRequired) return;
        }
        const snap = await probeAuth(session?.email);
        if (!active) return;
        // Local Earn `/api/auth/me` without an email fabricates demo@mudrexx.com.
        // Don't treat that as a real login when this browser has no session.
        if (!session && snap.contract === 'earn' && !pending) {
          setBackendContract('earn');
          setAccessRequired(false);
          setAccessType('earn');
          return;
        }
        applySnapshot(snap);
      } catch (error) {
        if (!active) return;
        if (isAccessRequired(error)) {
          setBackendContract('v2');
          setAccessRequired(true);
          setAccessType('anonymous');
          setUser(null);
          setSession(null);
          return;
        }
        notify('Backend unavailable', `${apiMessage(error)} Showing the last synced data.`, 'warning');
      }
    })();
    return () => {
      active = false;
    };
    // Probe once on mount. Later refreshes go through authenticate / wallet mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authenticate = useCallback(
    async (userProfile: AuthProfile, isNewUser = false) => {
      setSyncing(true);
      try {
        const res = isNewUser
          ? await registerUser(userProfile)
          : await loginUser(userProfile.email, userProfile.name);
        if (!res?.success || !res.user) {
          throw new ApiError(
            res?.error || 'Authentication failed on the backend.',
            res?.error === ACCESS_REQUIRED ? 403 : 401,
            res?.error === ACCESS_REQUIRED ? ACCESS_REQUIRED : undefined
          );
        }
        const nextUser = sanitizeUser(res.user);
        if (!nextUser) throw new ApiError('Backend returned an invalid account payload.', 502);
        setUser(nextUser);
        setSession({ email: nextUser.email, token: res.token || `mudrexx_${nextUser.email}` });
        setBackendContract('earn');
        setAccessRequired(false);
        setAccessType('earn');
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

  const addFrozenOrder = useCallback(
    async (order: {
      title: string;
      amount: number;
      currency: 'INR' | 'USDT';
      asset?: string;
      side?: 'up' | 'down';
      durationSeconds?: number;
      payoutPercent?: number;
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
          durationSeconds: order.durationSeconds ?? 60,
          payoutPercent: order.payoutPercent ?? 5,
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
      backendContract,
      accessRequired,
      accessType,
      redeemAccess,
      authMode,
      openAuth: setAuthMode,
      closeAuth: () => setAuthMode(null),
      authenticate,
      refreshUser: refreshFromServer,
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
      backendContract,
      accessRequired,
      accessType,
      redeemAccess,
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
