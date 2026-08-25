/**
 * Mudrexx Earn Backend API Client
 * Every frontend control resolves through these functions so the backend
 * remains the single source of truth for all trading, wallet and account state.
 */

import type { AuthProfile, FrozenFundItem, User, WalletTransaction } from './types';
import type { MarketQuote } from './data';

/**
 * Base URL for the backend API. Defaults to same-origin (Express serves the
 * built frontend, and Vite proxies /api to :8080 in dev). Point it at a
 * deployed backend with VITE_API_URL when hosting the frontend separately.
 */
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError('Backend is unreachable. Check your connection and try again.');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON response */
  }

  const errorText =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : '';

  if (!response.ok) {
    throw new ApiError(errorText || `Backend request failed (${response.status}).`, response.status);
  }
  return body as T;
}

const post = <T>(path: string, payload: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(payload) });

// ---------------------------------------------------------------------------
// Response payload types (mirror server.mjs responses)
// ---------------------------------------------------------------------------

export type HealthResponse = {
  ok: boolean;
  service: string;
  status: string;
  timestamp: string;
  uptime: number;
};

export type MarketsResponse = {
  data: MarketQuote[];
  source: 'binance' | 'fallback';
  cached?: boolean;
  message?: string;
};

export type Kline = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type KlinesResponse = {
  data: Kline[];
  source: string;
};

export type AuthResponse = {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
  error?: string;
};

export type MeResponse = {
  success: boolean;
  user?: User;
  error?: string;
};

export type WalletSummaryResponse = {
  success: boolean;
  summary?: {
    realBalance: number;
    realUsdtBalance: number;
    frozenBalance: number;
    frozenUsdtBalance: number;
    totalNetRealBalance: number;
    demoBalance: number;
    demoLinked: boolean;
    conversionRate: number;
    totalConverted: number;
    assetHoldings: Record<string, number>;
    frozenItemsCount: number;
  };
  error?: string;
};

export type TransactionsResponse = {
  success: boolean;
  transactions?: WalletTransaction[];
  error?: string;
};

export type FrozenResponse = {
  success: boolean;
  frozenBalance?: number;
  frozenUsdtBalance?: number;
  items?: FrozenFundItem[];
  error?: string;
};

export type ReleaseResponse = {
  success: boolean;
  message?: string;
  releasedAmount?: number;
  newRealBalance?: number;
  newFrozenBalance?: number;
  error?: string;
};

export type ApproveDepositResponse = {
  success: boolean;
  message?: string;
  approvedAmount?: number;
  newRealBalance?: number;
  newFrozenBalance?: number;
  error?: string;
};

export type ConvertDemoResponse = {
  success: boolean;
  message?: string;
  convertedCredits?: number;
  realGain?: number;
  newDemoBalance?: number;
  newRealBalance?: number;
  error?: string;
};

export type ClaimDemoResponse = {
  success: boolean;
  claimedAmount?: number;
  newDemoBalance?: number;
  error?: string;
};

export type LinkDemoResponse = {
  success: boolean;
  demoLinked?: boolean;
  message?: string;
  error?: string;
};

export type AdjustDemoResponse = {
  success: boolean;
  message?: string;
  delta?: number;
  newDemoBalance?: number;
  error?: string;
};

export type DepositResponse = {
  success: boolean;
  message?: string;
  depositId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  newFrozenBalance?: number;
  error?: string;
};

export type WithdrawResponse = {
  success: boolean;
  message?: string;
  amount?: number;
  remainingAvailable?: number;
  error?: string;
};

export type OrderResponse = {
  success: boolean;
  message?: string;
  orderId?: string;
  status?: string;
  newAvailable?: number;
  newFrozen?: number;
  error?: string;
};

export type StakeResponse = {
  success: boolean;
  message?: string;
  vaultId?: string;
  newAvailable?: number;
  newFrozen?: number;
  error?: string;
};

export type ProfileResponse = {
  success: boolean;
  message?: string;
  user?: User;
  error?: string;
};

export type AdminInvitedUser = {
  name: string;
  email: string;
  phone?: string;
  registeredAt: string;
  invitedBy: string;
  invitedByType?: 'admin' | 'user' | '';
  realBalance: number;
  demoBalance: number;
  lastActivity?: string;
};

export type AdminInvitedUsersResponse = {
  success: boolean;
  code?: string;
  users?: AdminInvitedUser[];
  error?: string;
};

// ---------------------------------------------------------------------------
// 1. Health & Markets
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health');
}

export async function getMarkets(): Promise<MarketsResponse> {
  return request<MarketsResponse>('/api/markets');
}

export async function getKlines(symbol = 'BTC', interval = '1m'): Promise<KlinesResponse> {
  return request<KlinesResponse>(`/api/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`);
}

// ---------------------------------------------------------------------------
// 2. Authentication & Profile
// ---------------------------------------------------------------------------

export async function registerUser(profile: AuthProfile): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/register', profile);
}

export async function loginUser(email: string, name?: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/login', { email, name });
}

export async function getCurrentUser(email: string): Promise<MeResponse> {
  return request<MeResponse>(`/api/auth/me?email=${encodeURIComponent(email)}`);
}

/** List every account that registered with the given admin invitation code. */
export async function getAdminInvitedUsers(code: string): Promise<AdminInvitedUsersResponse> {
  return request<AdminInvitedUsersResponse>(`/api/admin/invited-users?code=${encodeURIComponent(code)}`);
}

export async function updateProfile(data: {
  email: string;
  name?: string;
  phone?: string;
  preferredCurrency?: 'INR' | 'USDT';
}): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// 3. Wallet & Balance
// ---------------------------------------------------------------------------

export async function getWalletSummary(email: string): Promise<WalletSummaryResponse> {
  return request<WalletSummaryResponse>(`/api/wallet/summary?email=${encodeURIComponent(email)}`);
}

export async function getTransactions(email: string): Promise<TransactionsResponse> {
  return request<TransactionsResponse>(`/api/wallet/transactions?email=${encodeURIComponent(email)}`);
}

// ---------------------------------------------------------------------------
// 4. Frozen Amount & Escrow
// ---------------------------------------------------------------------------

export async function getFrozenItems(email: string): Promise<FrozenResponse> {
  return request<FrozenResponse>(`/api/wallet/frozen?email=${encodeURIComponent(email)}`);
}

export async function releaseFrozenItem(email: string, id: string): Promise<ReleaseResponse> {
  return post<ReleaseResponse>('/api/wallet/frozen/release', { email, id });
}

export async function approveDepositItem(email: string, id: string): Promise<ApproveDepositResponse> {
  return post<ApproveDepositResponse>('/api/wallet/deposit/approve', { email, id });
}

// ---------------------------------------------------------------------------
// 5. Demo to Real Conversion
// ---------------------------------------------------------------------------

export async function convertDemoCredits(email: string, demoCredits: number): Promise<ConvertDemoResponse> {
  return post<ConvertDemoResponse>('/api/wallet/convert-demo', { email, demoCredits });
}

export async function claimDemoCreditsApi(email: string, amount = 5000): Promise<ClaimDemoResponse> {
  return post<ClaimDemoResponse>('/api/wallet/claim-demo', { email, amount });
}

export async function setDemoLinkStatus(email: string, linked: boolean): Promise<LinkDemoResponse> {
  return post<LinkDemoResponse>('/api/wallet/link-demo', { email, linked });
}

/** Backend-controlled demo balance changes (Flight Lab wagers & cash-outs). */
export async function adjustDemoBalance(email: string, delta: number): Promise<AdjustDemoResponse> {
  return post<AdjustDemoResponse>('/api/wallet/demo/adjust', { email, delta });
}

// ---------------------------------------------------------------------------
// 6. Deposits & Withdrawals
// ---------------------------------------------------------------------------

export async function submitDeposit(data: {
  email: string;
  amount: number;
  rail: 'inr' | 'usdt';
  method: string;
  reference?: string;
}): Promise<DepositResponse> {
  return post<DepositResponse>('/api/deposit/submit', data);
}

export async function submitWithdrawal(data: {
  email: string;
  amount: number;
  destination: string;
}): Promise<WithdrawResponse> {
  return post<WithdrawResponse>('/api/withdraw/submit', data);
}

// ---------------------------------------------------------------------------
// 7. Orders & Staking
// ---------------------------------------------------------------------------

export async function createOrder(data: {
  email: string;
  symbol: string;
  side: 'up' | 'down';
  amount: number;
  currency: 'INR' | 'USDT';
  accountType: 'real' | 'demo';
}): Promise<OrderResponse> {
  return post<OrderResponse>('/api/orders/create', data);
}

export async function stakeInVault(data: {
  email: string;
  asset: string;
  amount: number;
  apy: number;
}): Promise<StakeResponse> {
  return post<StakeResponse>('/api/staking/stake', data);
}
