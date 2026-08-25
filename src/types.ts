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
  invitedByType?: 'admin' | 'user' | '';
  wallet: UserWallet;
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
