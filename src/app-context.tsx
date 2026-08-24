import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type FrozenFundCategory = 'order' | 'deposit' | 'staking' | 'withdrawal';

export type FrozenFundItem = {
  id: string;
  title: string;
  category: FrozenFundCategory;
  reason: string;
  amount: number;
  currency: 'INR' | 'USDT';
  asset?: string;
  date: string;
  status: 'locked' | 'processing' | 'accruing';
  canRelease?: boolean;
  apy?: number;
};

export type WalletTransaction = {
  id: string;
  title: string;
  description: string;
  time: string;
  amount: number;
  currency: 'INR' | 'USDT' | 'CREDITS';
  type: 'deposit' | 'withdrawal' | 'conversion' | 'trade' | 'reward' | 'stake' | 'release';
  tone: 'up' | 'down' | 'neutral';
  status: 'completed' | 'pending' | 'processing';
};

export type UserWallet = {
  realBalance: number;
  realUsdtBalance: number;
  frozenBalance: number;
  frozenUsdtBalance: number;
  demoBalance: number;
  demoLinked: boolean;
  conversionRate: number; // 100 Demo Credits = 10 INR (0.1 ratio)
  totalConverted: number;
  assetHoldings: Record<string, number>;
  frozenItems: FrozenFundItem[];
  transactions: WalletTransaction[];
};

export type User = {
  name: string;
  email: string;
  phone?: string;
  preferredCurrency?: 'INR' | 'USDT';
  registeredAt: string;
  wallet: UserWallet;
};

type AuthMode = 'signin' | 'signup';
type Notice = { id: number; title: string; message: string; tone: 'success' | 'info' | 'warning' };

export function createInitialWallet(isNewUser = true): UserWallet {
  return {
    realBalance: 0,
    realUsdtBalance: 0,
    frozenBalance: 0,
    frozenUsdtBalance: 0,
    demoBalance: 10000,
    demoLinked: true,
    conversionRate: 0.1, // 100 Demo Credits = ₹10 Real INR
    totalConverted: 0,
    assetHoldings: {
      BTC: 0,
      ETH: 0,
      BNB: 0,
      SOL: 0,
      XRP: 0,
      ETC: 0,
      ADA: 0,
      DOGE: 0,
    },
    frozenItems: [],
    transactions: isNewUser
      ? [
          {
            id: 'tx-welcome',
            title: 'Account Registered',
            description: 'New account initialized with ₹0.00 balance and 10,000 practice credits',
            time: 'Just now',
            amount: 0,
            currency: 'INR',
            type: 'reward',
            tone: 'neutral',
            status: 'completed',
          },
        ]
      : [],
  };
}

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
  authMode: AuthMode | null;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  authenticate: (
    userProfile: { name: string; email: string; phone?: string; preferredCurrency?: 'INR' | 'USDT' },
    isNewUser?: boolean
  ) => void;
  signOut: () => void;
  notices: Notice[];
  notify: (title: string, message: string, tone?: Notice['tone']) => void;
  dismiss: (id: number) => void;
  // Wallet operations:
  convertDemoToReal: (demoCredits: number) => { success: boolean; realGain: number; message: string };
  addDeposit: (amount: number, rail: 'inr' | 'usdt', method: string, reference?: string) => void;
  approveDeposit: (id: string) => void;
  cancelOrReleaseFrozen: (id: string) => void;
  addFrozenOrder: (order: {
    title: string;
    amount: number;
    currency: 'INR' | 'USDT';
    asset?: string;
    side?: 'up' | 'down';
  }) => boolean;
  addStakingVault: (asset: string, amount: number, apy: number) => boolean;
  claimDemoCredits: (amount?: number) => void;
  setDemoLinked: (linked: boolean) => void;
  updateDemoBalance: (delta: number) => void;
  // Conversion modal:
  isConversionOpen: boolean;
  openConversionModal: () => void;
  closeConversionModal: () => void;
};

const AppContext = createContext<AppState | null>(null);
let noticeId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('mudrexx-user');
      if (!stored) return null;
      return sanitizeUser(JSON.parse(stored));
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isConversionOpen, setIsConversionOpen] = useState(false);

  // Keep localStorage updated whenever user object changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('mudrexx-user', JSON.stringify(user));
      try {
        localStorage.setItem(`mudrexx-user-data-${user.email}`, JSON.stringify(user));
      } catch {
        /* storage safe */
      }
    } else {
      localStorage.removeItem('mudrexx-user');
    }
  }, [user]);

  const notify = useCallback((title: string, message: string, tone: Notice['tone'] = 'success') => {
    const id = ++noticeId;
    setNotices((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  const authenticate = useCallback(
    (
      userProfile: { name: string; email: string; phone?: string; preferredCurrency?: 'INR' | 'USDT' },
      isNewUser = false
    ) => {
      // Check if user has an existing saved account in localStorage
      let existing: User | null = null;
      try {
        const storedUserData = localStorage.getItem(`mudrexx-user-data-${userProfile.email}`);
        if (storedUserData) {
          existing = sanitizeUser(JSON.parse(storedUserData));
        }
      } catch {
        /* safe */
      }

      if (existing && !isNewUser) {
        setUser({
          ...existing,
          name: userProfile.name || existing.name,
          phone: userProfile.phone || existing.phone,
          preferredCurrency: userProfile.preferredCurrency || existing.preferredCurrency,
        });
      } else {
        // When a new user is registered, balance is strictly ZERO
        const newUser: User = {
          name: userProfile.name,
          email: userProfile.email,
          phone: userProfile.phone || '',
          preferredCurrency: userProfile.preferredCurrency || 'INR',
          registeredAt: new Date().toISOString(),
          wallet: createInitialWallet(true),
        };
        setUser(newUser);
      }
      setAuthMode(null);
    },
    []
  );

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('mudrexx-user');
  }, []);

  // Demo to Real Conversion
  const convertDemoToReal = useCallback(
    (demoCredits: number) => {
      if (!user) {
        return { success: false, realGain: 0, message: 'Please sign in to convert demo balance.' };
      }
      if (demoCredits <= 0) {
        return { success: false, realGain: 0, message: 'Enter a valid conversion amount.' };
      }
      if (demoCredits > user.wallet.demoBalance) {
        return {
          success: false,
          realGain: 0,
          message: `Insufficient demo credits. Available: ${user.wallet.demoBalance.toLocaleString()}`,
        };
      }

      const rate = user.wallet.conversionRate || 0.1;
      const realGain = Math.round(demoCredits * rate * 100) / 100;

      const updatedWallet: UserWallet = {
        ...user.wallet,
        demoBalance: user.wallet.demoBalance - demoCredits,
        realBalance: user.wallet.realBalance + realGain,
        totalConverted: (user.wallet.totalConverted || 0) + demoCredits,
        transactions: [
          {
            id: `tx-conv-${Date.now()}`,
            title: 'Demo to Real Conversion',
            description: `Converted ${demoCredits.toLocaleString()} Demo Credits at 10:1 ratio`,
            time: 'Just now',
            amount: realGain,
            currency: 'INR',
            type: 'conversion',
            tone: 'up',
            status: 'completed',
          },
          ...user.wallet.transactions,
        ],
      };

      setUser({ ...user, wallet: updatedWallet });
      notify(
        'Conversion successful! 🎉',
        `Credited ₹${realGain.toLocaleString('en-IN', { minimumFractionDigits: 2 })} into your Real Available balance.`,
        'success'
      );

      return {
        success: true,
        realGain,
        message: `Successfully converted ${demoCredits.toLocaleString()} Demo Credits into ₹${realGain.toFixed(2)} Real Balance.`,
      };
    },
    [user, notify]
  );

  // Add Deposit (moves to Frozen balance pending verification)
  const addDeposit = useCallback(
    (amount: number, rail: 'inr' | 'usdt', method: string, reference = '') => {
      if (!user) return;

      const isINR = rail === 'inr';
      const newFrozenItem: FrozenFundItem = {
        id: `dep-${Date.now()}`,
        title: `${rail.toUpperCase()} Deposit (${method.toUpperCase()})`,
        category: 'deposit',
        reason: reference ? `Ref / UTR: ${reference}` : 'Verification in progress (Sandbox review)',
        amount,
        currency: isINR ? 'INR' : 'USDT',
        date: 'Just now',
        status: 'processing',
        canRelease: true,
      };

      const updatedWallet: UserWallet = {
        ...user.wallet,
        frozenBalance: isINR ? user.wallet.frozenBalance + amount : user.wallet.frozenBalance,
        frozenUsdtBalance: !isINR ? user.wallet.frozenUsdtBalance + amount : user.wallet.frozenUsdtBalance,
        frozenItems: [newFrozenItem, ...user.wallet.frozenItems],
        transactions: [
          {
            id: `tx-dep-${Date.now()}`,
            title: `${rail.toUpperCase()} Deposit Submitted`,
            description: `${method.toUpperCase()} deposit in verification (${reference || 'Submitted'})`,
            time: 'Just now',
            amount,
            currency: isINR ? 'INR' : 'USDT',
            type: 'deposit',
            tone: 'up',
            status: 'pending',
          },
          ...user.wallet.transactions,
        ],
      };

      setUser({ ...user, wallet: updatedWallet });
      notify(
        'Deposit submitted',
        `₹${amount.toLocaleString('en-IN')} is recorded in your Frozen Balance pending verification.`,
        'info'
      );
    },
    [user, notify]
  );

  // Approve pending deposit (moves from frozen to available)
  const approveDeposit = useCallback(
    (id: string) => {
      if (!user) return;
      const item = user.wallet.frozenItems.find((f) => f.id === id);
      if (!item) return;

      const isINR = item.currency === 'INR';
      const updatedWallet: UserWallet = {
        ...user.wallet,
        frozenBalance: isINR ? Math.max(0, user.wallet.frozenBalance - item.amount) : user.wallet.frozenBalance,
        frozenUsdtBalance: !isINR
          ? Math.max(0, user.wallet.frozenUsdtBalance - item.amount)
          : user.wallet.frozenUsdtBalance,
        realBalance: isINR ? user.wallet.realBalance + item.amount : user.wallet.realBalance,
        realUsdtBalance: !isINR ? user.wallet.realUsdtBalance + item.amount : user.wallet.realUsdtBalance,
        frozenItems: user.wallet.frozenItems.filter((f) => f.id !== id),
        transactions: [
          {
            id: `tx-app-${Date.now()}`,
            title: 'Deposit Verified & Unlocked',
            description: `${item.currency} ${item.amount.toLocaleString()} moved from Frozen to Available balance`,
            time: 'Just now',
            amount: item.amount,
            currency: item.currency,
            type: 'deposit',
            tone: 'up',
            status: 'completed',
          },
          ...user.wallet.transactions,
        ],
      };

      setUser({ ...user, wallet: updatedWallet });
      notify(
        'Deposit approved & credited! ✅',
        `${item.currency === 'INR' ? '₹' : '₮'}${item.amount.toLocaleString()} is now in your Available Balance.`,
        'success'
      );
    },
    [user, notify]
  );

  // Cancel or Release any Frozen Item back to Available Balance
  const cancelOrReleaseFrozen = useCallback(
    (id: string) => {
      if (!user) return;
      const item = user.wallet.frozenItems.find((f) => f.id === id);
      if (!item) return;

      const isINR = item.currency === 'INR';
      const updatedWallet: UserWallet = {
        ...user.wallet,
        frozenBalance: isINR ? Math.max(0, user.wallet.frozenBalance - item.amount) : user.wallet.frozenBalance,
        frozenUsdtBalance: !isINR
          ? Math.max(0, user.wallet.frozenUsdtBalance - item.amount)
          : user.wallet.frozenUsdtBalance,
        realBalance: isINR ? user.wallet.realBalance + item.amount : user.wallet.realBalance,
        realUsdtBalance: !isINR ? user.wallet.realUsdtBalance + item.amount : user.wallet.realUsdtBalance,
        frozenItems: user.wallet.frozenItems.filter((f) => f.id !== id),
        transactions: [
          {
            id: `tx-rel-${Date.now()}`,
            title: 'Frozen Funds Released',
            description: `${item.title} released back to available balance`,
            time: 'Just now',
            amount: item.amount,
            currency: item.currency,
            type: 'release',
            tone: 'up',
            status: 'completed',
          },
          ...user.wallet.transactions,
        ],
      };

      setUser({ ...user, wallet: updatedWallet });
      notify(
        'Funds released! 🔓',
        `${item.currency === 'INR' ? '₹' : '₮'}${item.amount.toLocaleString()} returned to your Available Balance.`,
        'info'
      );
    },
    [user, notify]
  );

  // Add Frozen Order (moves funds to frozen during active scenario)
  const addFrozenOrder = useCallback(
    (order: {
      title: string;
      amount: number;
      currency: 'INR' | 'USDT';
      asset?: string;
      side?: 'up' | 'down';
    }) => {
      if (!user) return false;
      const isINR = order.currency === 'INR';
      const available = isINR ? user.wallet.realBalance : user.wallet.realUsdtBalance;

      if (order.amount > available) {
        notify(
          'Insufficient real balance',
          `You have ${isINR ? '₹' : '₮'}${available.toLocaleString()} available. Deposit or convert demo credits first.`,
          'warning'
        );
        return false;
      }

      const newFrozenItem: FrozenFundItem = {
        id: `ord-${Date.now()}`,
        title: order.title || `${order.asset || 'Crypto'} ${order.side === 'up' ? 'BUY UP' : 'BUY DOWN'} Order`,
        category: 'order',
        reason: `Active limit order on ${order.asset || 'Market'}`,
        amount: order.amount,
        currency: order.currency,
        asset: order.asset,
        date: 'Just now',
        status: 'locked',
        canRelease: true,
      };

      const updatedWallet: UserWallet = {
        ...user.wallet,
        realBalance: isINR ? user.wallet.realBalance - order.amount : user.wallet.realBalance,
        realUsdtBalance: !isINR ? user.wallet.realUsdtBalance - order.amount : user.wallet.realUsdtBalance,
        frozenBalance: isINR ? user.wallet.frozenBalance + order.amount : user.wallet.frozenBalance,
        frozenUsdtBalance: !isINR ? user.wallet.frozenUsdtBalance + order.amount : user.wallet.frozenUsdtBalance,
        frozenItems: [newFrozenItem, ...user.wallet.frozenItems],
        transactions: [
          {
            id: `tx-ord-${Date.now()}`,
            title: `Order Placed (${order.side?.toUpperCase() || 'TRADE'})`,
            description: `${order.currency} ${order.amount} held in frozen order escrow`,
            time: 'Just now',
            amount: order.amount,
            currency: order.currency,
            type: 'trade',
            tone: 'down',
            status: 'pending',
          },
          ...user.wallet.transactions,
        ],
      };

      setUser({ ...user, wallet: updatedWallet });
      notify(
        'Order placed & funds frozen',
        `${isINR ? '₹' : '₮'}${order.amount.toLocaleString()} is locked in your Frozen Amount section until executed or cancelled.`,
        'success'
      );
      return true;
    },
    [user, notify]
  );

  // Add Staking Vault
  const addStakingVault = useCallback(
    (asset: string, amount: number, apy: number) => {
      if (!user) return false;
      const available = user.wallet.realBalance;
      if (amount > available) {
        notify(
          'Insufficient balance for vault',
          `Available: ₹${available.toLocaleString()}. Convert demo credits or deposit funds.`,
          'warning'
        );
        return false;
      }

      const newFrozenItem: FrozenFundItem = {
        id: `stk-${Date.now()}`,
        title: `Flexible ${asset} Staking Vault`,
        category: 'staking',
        reason: `Earning indicative ${apy}% APY daily rewards`,
        amount,
        currency: 'INR',
        asset,
        date: 'Just now',
        status: 'accruing',
        canRelease: true,
        apy,
      };

      const updatedWallet: UserWallet = {
        ...user.wallet,
        realBalance: user.wallet.realBalance - amount,
        frozenBalance: user.wallet.frozenBalance + amount,
        frozenItems: [newFrozenItem, ...user.wallet.frozenItems],
        transactions: [
          {
            id: `tx-stk-${Date.now()}`,
            title: `Staked in ${asset} Vault`,
            description: `₹${amount} locked in flexible earn earning ${apy}% APY`,
            time: 'Just now',
            amount,
            currency: 'INR',
            type: 'stake',
            tone: 'neutral',
            status: 'completed',
          },
          ...user.wallet.transactions,
        ],
      };

      setUser({ ...user, wallet: updatedWallet });
      notify(
        'Staking vault active! ✨',
        `₹${amount.toLocaleString()} is now accruing daily rewards in the Flexible ${asset} Vault.`,
        'success'
      );
      return true;
    },
    [user, notify]
  );

  // Claim Practice Demo Credits
  const claimDemoCredits = useCallback(
    (amount = 5000) => {
      if (!user) return;
      const updatedWallet: UserWallet = {
        ...user.wallet,
        demoBalance: user.wallet.demoBalance + amount,
        transactions: [
          {
            id: `tx-demo-${Date.now()}`,
            title: 'Demo Practice Grant Claimed',
            description: `Added ${amount.toLocaleString()} credits to demo practice balance`,
            time: 'Just now',
            amount,
            currency: 'CREDITS',
            type: 'reward',
            tone: 'up',
            status: 'completed',
          },
          ...user.wallet.transactions,
        ],
      };
      setUser({ ...user, wallet: updatedWallet });
      notify('Demo credits claimed! 🎁', `Added ${amount.toLocaleString()} credits to your demo wallet.`, 'success');
    },
    [user, notify]
  );

  // Update demo balance (from games / flight lab)
  const updateDemoBalance = useCallback(
    (delta: number) => {
      if (!user) return;
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          wallet: {
            ...prev.wallet,
            demoBalance: Math.max(0, prev.wallet.demoBalance + delta),
          },
        };
      });
    },
    [user]
  );

  const setDemoLinked = useCallback(
    (linked: boolean) => {
      if (!user) return;
      setUser({
        ...user,
        wallet: {
          ...user.wallet,
          demoLinked: linked,
        },
      });
      notify(
        linked ? 'Demo Linked to Real Account' : 'Demo Unlinked',
        linked
          ? 'Your demo practice trading rewards can now be converted to real wallet balance.'
          : 'Demo conversion is paused.',
        'info'
      );
    },
    [user, notify]
  );

  const openConversionModal = useCallback(() => setIsConversionOpen(true), []);
  const closeConversionModal = useCallback(() => setIsConversionOpen(false), []);

  const value = useMemo<AppState>(
    () => ({
      user,
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
