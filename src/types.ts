/**
 * Shared domain types for the Mudrexx Earn backend integration.
 * These shapes mirror what server.mjs returns so the frontend can trust
 * the backend as the single source of truth.
 */

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
  inviteCode?: string;
  invitedBy?: string;
  invitedByType?: 'admin' | 'user' | '' | string;
  /** Backend account identifier (e.g. USR-…). */
  id?: string;
  /** Backend-assigned username. */
  username?: string;
  /** Backend account status (active / restricted / …). */
  status?: string;
  /** Backend-computed user category badge (New / Active / VIP / …). */
  category?: string;
  /** Backend-computed credit score snapshot. */
  creditScore?: CreditSnapshot;
  /** Admin relationship code, only present when the backend permits it. */
  adminUserCode?: string;
  /** Last activity timestamp reported by the backend. */
  lastActivityAt?: string;
  wallet: UserWallet;
};

/** Credit score snapshot — always computed by the backend. */
export type CreditSnapshot = {
  score: number;
  status: string;
  updatedAt?: string;
};

export type CreditHistoryPoint = CreditSnapshot & { at: string };

/** Student task owned by the signed-in account (backend-controlled). */
export type StudentTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'overdue' | string;
  createdAt?: string;
  dueDate?: string;
  completedAt?: string | null;
};

export type TasksSummary = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  overdue: number;
};

/** Customer support ticket (withdrawals route through here). */
export type SupportTicket = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  response?: string | null;
  request?: { currency?: string; amount?: number } | null;
};

/** Backend notification derived from the student's own data. */
export type StudentNotification = {
  id: string;
  kind: 'order' | 'task' | 'support' | string;
  title: string;
  message: string;
  at: string;
};

/** Backend-controlled Instant Order desk configuration. */
export type OrderDeskConfig = {
  enabled: boolean;
  accountTypes: string[];
  assets: Array<{ symbol: string; name: string; enabled: boolean }>;
  currencies: Array<{
    code: 'INR' | 'USDT' | string;
    enabled: boolean;
    minAmount: number;
    maxAmount: number;
    quickAmounts: number[];
  }>;
  durations: number[];
  payoutPercents: number[];
  defaultDuration: number;
  defaultPayoutPercent: number;
  settlement: {
    mode: string;
    description: string;
    frozenUntilSettlement?: boolean;
  };
};

/** Technical analysis payload — every field is computed by the backend. */
export type MarketAnalysis = {
  price: number;
  trend: string;
  volatilityPercent: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  momentumPercent: number | null;
  support: number;
  resistance: number;
};

export type MarketDetail = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
  rank?: number;
  marketCap?: number | null;
  status?: string;
  source?: string;
  lastUpdated?: string;
  providerMessage?: string;
};

/** Backend document catalog entry. */
export type DocumentCatalogItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  endpoint: string;
};

/** NOVA copilot status from the backend. */
export type NovaStatus = {
  online: boolean;
  assistant: string;
  model: string;
  grounded?: boolean;
  topics?: string[];
  at?: string;
};

export type AuthProfile = {
  name: string;
  email: string;
  phone?: string;
  preferredCurrency?: 'INR' | 'USDT';
  inviteCode?: string;
};

export type Session = {
  email: string;
  token: string;
};

/** Live order record shown on the Instant Order page board. */
export type TradeOrder = {
  id: string;
  symbol: string;
  side: 'up' | 'down';
  amount: number;
  currency: 'INR' | 'USDT';
  accountType: 'real' | 'demo';
  status: 'open' | 'won' | 'lost' | 'cancelled';
  payoutPercent: number;
  durationSeconds: number;
  createdAt: number;
  expiresAt: number;
  entryPrice: number;
  exitPrice?: number;
  payout?: number;
  profit?: number;
  settledPercent?: number;
  settledAt?: string;
  settledBy?: string;
  userEmail?: string;
  userName?: string;
};
