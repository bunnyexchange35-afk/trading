/**
 * Mudrexx Earn Backend API Client
 *
 * Speaks two contracts:
 *   - Earn (local `server.mjs`): `{ success, user, error }`
 *   - V2 mudrexx-control (live `mudrexxback`, private mode):
 *       GET /api/auth/me → `{ ok: true, type: "anonymous" | "access" | ... }`
 *       protected calls  → `ACCESS_REQUIRED`
 *
 * Requests always send cookies (`credentials: include`) so V2 source/access
 * links can grant a session. Bearer tokens from localStorage are attached
 * when present.
 */

import type { AuthProfile, FrozenFundItem, TradeOrder, User, UserWallet, WalletTransaction } from './types';
import type { MarketQuote } from './data';

export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const ACCESS_REQUIRED = 'ACCESS_REQUIRED';
export const SESSION_TOKEN_KEY = 'mudrexx-session';

export type BackendContract = 'earn' | 'v2' | 'unknown';
export type V2AuthType = 'anonymous' | 'access' | 'source' | 'staff' | 'user' | 'session' | string;

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isAccessRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === ACCESS_REQUIRED;
}

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === ACCESS_REQUIRED) {
      return 'This live desk is in private mode. Open a V2 source or access link, or paste an access code.';
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

function readStoredToken(): string | null {
  try {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { token?: string };
    return typeof parsed.token === 'string' && parsed.token ? parsed.token : null;
  } catch {
    return null;
  }
}

function extractErrorCode(body: unknown, fallbackStatus = 0): { message: string; code?: string } {
  if (!body || typeof body !== 'object') {
    return { message: fallbackStatus ? `Backend request failed (${fallbackStatus}).` : 'Backend request failed.' };
  }
  const record = body as Record<string, unknown>;
  const raw =
    (typeof record.error === 'string' && record.error) ||
    (typeof record.code === 'string' && record.code) ||
    (typeof record.message === 'string' && record.message) ||
    '';
  const upper = raw.toUpperCase();
  if (upper === ACCESS_REQUIRED || upper.includes(ACCESS_REQUIRED)) {
    return { message: raw || ACCESS_REQUIRED, code: ACCESS_REQUIRED };
  }
  return { message: raw };
}

type RequestOptions = {
  allowAccessRequired?: boolean;
};

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const hasBody = init?.body !== undefined && init?.body !== null;
  if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const token = readStoredToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiError('Backend is unreachable. Check your connection and try again.');
  }

  let body: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  } else {
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
  }

  const extracted = extractErrorCode(body, response.status);
  const accessDenied = extracted.code === ACCESS_REQUIRED;

  if (accessDenied && options?.allowAccessRequired) {
    return (body ?? { ok: false, error: ACCESS_REQUIRED }) as T;
  }

  if (!response.ok || accessDenied) {
    throw new ApiError(
      extracted.message || `Backend request failed (${response.status}).`,
      response.status,
      extracted.code
    );
  }
  return body as T;
}

const post = <T>(path: string, payload: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(payload) });

export type HealthResponse = {
  ok: boolean;
  service: string;
  status: string;
  timestamp: string;
  uptime: number;
};

export type MarketsResponse = {
  data: MarketQuote[];
  source: 'coinbase' | 'fallback';
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
    depositCredited?: number;
    depositCreditedUsdt?: number;
    creditTotal?: number;
    totalBalance?: number;
    totalUsdtBalance?: number;
    frozenTotal?: number;
    frozenTotalUsdt?: number;
    openOrders?: number;
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
  order?: TradeOrder;
  newAvailable?: number;
  newFrozen?: number;
  newDemoBalance?: number;
  wallet?: WalletState;
  error?: string;
};

/** Balance state snapshot (deposit / credit / total / frozen). */
export type WalletState = {
  realBalance: number;
  realUsdtBalance: number;
  frozenBalance: number;
  frozenUsdtBalance: number;
  totalBalance: number;
  totalUsdtBalance: number;
  creditTotal: number;
  depositCredited: number;
  depositCreditedUsdt: number;
};

export type OrdersListResponse = {
  success: boolean;
  orders?: TradeOrder[];
  total?: number;
  wallet?: WalletState;
  error?: string;
};

export type AdminRoleResponse = {
  success: boolean;
  role?: 'admin' | 'super';
  error?: string;
};

export type AdminControlResponse = {
  success: boolean;
  role?: 'admin' | 'super';
  order?: TradeOrder;
  wallet?: WalletState;
  message?: string;
  changes?: string[];
  error?: string;
};

export type AdminAllOrdersResponse = {
  success: boolean;
  role?: 'admin' | 'super';
  orders?: TradeOrder[];
  total?: number;
  error?: string;
};

export type AdminAdjustResponse = {
  success: boolean;
  field?: string;
  delta?: number;
  wallet?: WalletState;
  error?: string;
};

export type OrderStatusResponse = {
  success: boolean;
  order?: FrozenFundItem;
  orders?: FrozenFundItem[];
  status?: string;
  total?: number;
  userEmail?: string;
  error?: string;
};

export type AdminOrder = FrozenFundItem & {
  userId: string;
  userName?: string;
  userPhone?: string;
};

export type AdminOrdersResponse = {
  success: boolean;
  orders?: AdminOrder[];
  total?: number;
  error?: string;
};

export type VerifyResponse = {
  ok: boolean;
  status: string;
  timestamp: string;
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

/** Read-only admin user directory. This is additive to the legacy invited-users endpoint. */
export type AdminUser = AdminInvitedUser;
export type AdminUsersResponse = {
  success: boolean;
  code?: string;
  users?: AdminUser[];
  total?: number;
  error?: string;
};

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health');
}

export async function getMarkets(): Promise<MarketsResponse> {
  return request<MarketsResponse>('/api/markets');
}

export async function getKlines(symbol = 'BTC', interval = '1m'): Promise<KlinesResponse> {
  return request<KlinesResponse>(`/api/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`);
}

export type AuthSnapshot = {
  contract: BackendContract;
  type: V2AuthType | 'earn';
  accessRequired: boolean;
  user: User | null;
  token?: string;
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function emptyWallet(): UserWallet {
  return {
    realBalance: 0,
    realUsdtBalance: 0,
    frozenBalance: 0,
    frozenUsdtBalance: 0,
    demoBalance: 0,
    demoLinked: false,
    conversionRate: 0.1,
    totalConverted: 0,
    assetHoldings: { BTC: 0, ETH: 0, BNB: 0, SOL: 0, XRP: 0, ETC: 0, ADA: 0, DOGE: 0 },
    frozenItems: [],
    transactions: [],
  };
}

export function mapBackendUser(data: unknown): User | null {
  const root = asRecord(data);
  if (!root) return null;

  const nested =
    asRecord(root.user) ||
    asRecord(root.profile) ||
    asRecord(root.account) ||
    asRecord(root.staff) ||
    root;

  const email = pickString(nested.email, nested.username).toLowerCase();
  const name = pickString(nested.name, nested.full_name, nested.fullName, nested.username, email.split('@')[0]);
  if (!email || !name) return null;

  const rawWallet = asRecord(nested.wallet) || asRecord(root.wallet) || {};
  const holdings = asRecord(rawWallet.assetHoldings) || {};
  const wallet: UserWallet = {
    ...emptyWallet(),
    realBalance: pickNumber(rawWallet.realBalance, pickNumber(nested.balance)),
    realUsdtBalance: pickNumber(rawWallet.realUsdtBalance),
    frozenBalance: pickNumber(rawWallet.frozenBalance),
    frozenUsdtBalance: pickNumber(rawWallet.frozenUsdtBalance),
    demoBalance: pickNumber(rawWallet.demoBalance, 0),
    demoLinked: rawWallet.demoLinked !== undefined ? Boolean(rawWallet.demoLinked) : false,
    conversionRate: pickNumber(rawWallet.conversionRate, 0.1),
    totalConverted: pickNumber(rawWallet.totalConverted),
    assetHoldings: {
      BTC: 0,
      ETH: 0,
      BNB: 0,
      SOL: 0,
      XRP: 0,
      ETC: 0,
      ADA: 0,
      DOGE: 0,
      ...Object.fromEntries(
        Object.entries(holdings).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      ),
    },
    frozenItems: Array.isArray(rawWallet.frozenItems) ? (rawWallet.frozenItems as UserWallet['frozenItems']) : [],
    transactions: Array.isArray(rawWallet.transactions) ? (rawWallet.transactions as UserWallet['transactions']) : [],
  };

  return {
    name,
    email,
    phone: pickString(nested.phone),
    preferredCurrency: nested.preferredCurrency === 'USDT' ? 'USDT' : 'INR',
    registeredAt: pickString(nested.registeredAt, nested.created_at, nested.createdAt) || new Date().toISOString(),
    inviteCode: pickString(nested.inviteCode),
    invitedBy: pickString(nested.invitedBy),
    invitedByType: nested.invitedByType === 'admin' || nested.invitedByType === 'user' ? nested.invitedByType : '',
    wallet,
  };
}

export function interpretAuthBody(body: unknown): AuthSnapshot {
  const record = asRecord(body) ?? {};
  const extracted = extractErrorCode(body);
  const token = pickString(record.token, asRecord(record.data)?.token);

  if (extracted.code === ACCESS_REQUIRED) {
    return { contract: 'v2', type: 'anonymous', accessRequired: true, user: null, token: token || undefined, raw: body };
  }

  if (record.success === true && (record.user || asRecord(record.data)?.user)) {
    return {
      contract: 'earn',
      type: 'earn',
      accessRequired: false,
      user: mapBackendUser(record.user ?? asRecord(record.data)?.user),
      token: token || undefined,
      raw: body,
    };
  }

  if (record.ok === true || typeof record.type === 'string') {
    const type = pickString(record.type) || 'anonymous';
    const gated = type === 'anonymous';
    return {
      contract: 'v2',
      type,
      accessRequired: gated,
      user: mapBackendUser(body),
      token: token || undefined,
      raw: body,
    };
  }

  const mapped = mapBackendUser(body);
  if (mapped) {
    return { contract: 'unknown', type: 'user', accessRequired: false, user: mapped, token: token || undefined, raw: body };
  }

  return { contract: 'unknown', type: 'anonymous', accessRequired: false, user: null, token: token || undefined, raw: body };
}

export async function probeAuth(email?: string): Promise<AuthSnapshot> {
  const path = email ? `/api/auth/me?email=${encodeURIComponent(email)}` : '/api/auth/me';
  try {
    const body = await request<unknown>(path, undefined, { allowAccessRequired: true });
    return interpretAuthBody(body);
  } catch (error) {
    if (isAccessRequired(error)) {
      return { contract: 'v2', type: 'anonymous', accessRequired: true, user: null, raw: { error: ACCESS_REQUIRED } };
    }
    throw error;
  }
}

export type AccessKind = 'access' | 'source';

export type ParsedAccessInput = {
  kind: AccessKind;
  code: string;
};

export function parseAccessInput(raw: string): ParsedAccessInput | null {
  const value = raw.trim();
  if (!value) return null;

  const tryUrl = (input: string): ParsedAccessInput | null => {
    try {
      const url = new URL(input, 'https://mudrexx.local');
      const access = url.searchParams.get('access') || url.searchParams.get('a') || url.searchParams.get('token');
      const source = url.searchParams.get('src') || url.searchParams.get('source') || url.searchParams.get('s');
      const segments = url.pathname.split('/').filter(Boolean);
      const marker = segments.findIndex((part) => part === 'a' || part === 's');
      if (marker >= 0 && segments[marker + 1]) {
        return { kind: segments[marker] === 's' ? 'source' : 'access', code: decodeURIComponent(segments[marker + 1]) };
      }
      if (source) return { kind: 'source', code: source };
      if (access) return { kind: 'access', code: access };
    } catch {
      return null;
    }
    return null;
  };

  if (value.includes('://') || value.startsWith('/') || value.includes('?')) {
    const parsed = tryUrl(value);
    if (parsed) return parsed;
  }

  return { kind: 'access', code: value };
}

export function readAccessFromLocation(location: { pathname: string; search: string } = window.location): ParsedAccessInput | null {
  return parseAccessInput(`${location.pathname}${location.search}`);
}

async function followLink(path: string): Promise<unknown> {
  try {
    const token = readStoredToken();
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      headers: {
        Accept: 'application/json, text/html;q=0.8',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function redeemAccessLink(kind: AccessKind, code: string): Promise<AuthSnapshot> {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new ApiError('Access code is required.', 400);
  }

  const linkPath = kind === 'source' ? `/s/${encodeURIComponent(trimmed)}` : `/a/${encodeURIComponent(trimmed)}`;
  const linkBody = await followLink(linkPath);
  if (linkBody) {
    const fromLink = interpretAuthBody(linkBody);
    if (!fromLink.accessRequired || fromLink.user) return fromLink;
  }

  // Detect the backend contract before attempting the POST redemption endpoints.
  // The live V2 mudrexx-control API grants sessions through the GET link/cookie
  // and returns 405 (Method Not Allowed) for these POSTs — probing first keeps
  // that console noise out of the V2 private-mode flow.
  let probe: AuthSnapshot;
  try {
    probe = await probeAuth();
  } catch {
    probe = { contract: 'unknown', type: 'anonymous', accessRequired: false, user: null, raw: null };
  }
  if (probe.contract === 'v2') {
    return probe;
  }

  const payloads = [
    { path: '/api/auth/access', body: { code: trimmed, kind } },
    { path: '/api/access/redeem', body: { code: trimmed, token: trimmed, kind } },
    { path: '/api/auth/source', body: { code: trimmed, source: trimmed } },
  ];

  for (const attempt of payloads) {
    try {
      const body = await request<unknown>(
        attempt.path,
        { method: 'POST', body: JSON.stringify(attempt.body) },
        { allowAccessRequired: true }
      );
      const snap = interpretAuthBody(body);
      if (!snap.accessRequired || snap.user) return snap;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) continue;
      if (isAccessRequired(error)) continue;
    }
  }

  return probeAuth();
}

export async function registerUser(profile: AuthProfile): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/register', profile);
}

export async function loginUser(email: string, name?: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/login', { email, name });
}

export async function getCurrentUser(email?: string): Promise<MeResponse> {
  const snap = await probeAuth(email);
  if (snap.contract === 'v2' && snap.accessRequired) {
    return { success: false, error: ACCESS_REQUIRED };
  }
  if (snap.user) return { success: true, user: snap.user };
  return { success: false, error: snap.accessRequired ? ACCESS_REQUIRED : 'No authenticated account on this backend.' };
}

export async function getAdminInvitedUsers(code: string): Promise<AdminInvitedUsersResponse> {
  return request<AdminInvitedUsersResponse>(`/api/admin/invited-users?code=${encodeURIComponent(code)}`);
}

export async function getAdminUsers(code: string): Promise<AdminUsersResponse> {
  return request<AdminUsersResponse>(`/api/admin/users?code=${encodeURIComponent(code)}`);
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

export async function getWalletSummary(email: string): Promise<WalletSummaryResponse> {
  return request<WalletSummaryResponse>(`/api/wallet/summary?email=${encodeURIComponent(email)}`);
}

export async function getTransactions(email: string): Promise<TransactionsResponse> {
  return request<TransactionsResponse>(`/api/wallet/transactions?email=${encodeURIComponent(email)}`);
}

export async function getFrozenItems(email: string): Promise<FrozenResponse> {
  return request<FrozenResponse>(`/api/wallet/frozen?email=${encodeURIComponent(email)}`);
}

export async function releaseFrozenItem(email: string, id: string): Promise<ReleaseResponse> {
  return post<ReleaseResponse>('/api/wallet/frozen/release', { email, id });
}

export async function approveDepositItem(email: string, id: string): Promise<ApproveDepositResponse> {
  return post<ApproveDepositResponse>('/api/wallet/deposit/approve', { email, id });
}

export async function convertDemoCredits(email: string, demoCredits: number): Promise<ConvertDemoResponse> {
  return post<ConvertDemoResponse>('/api/wallet/convert-demo', { email, demoCredits });
}

export async function claimDemoCreditsApi(email: string, amount = 5000): Promise<ClaimDemoResponse> {
  return post<ClaimDemoResponse>('/api/wallet/claim-demo', { email, amount });
}

export async function setDemoLinkStatus(email: string, linked: boolean): Promise<LinkDemoResponse> {
  return post<LinkDemoResponse>('/api/wallet/link-demo', { email, linked });
}

export async function adjustDemoBalance(email: string, delta: number): Promise<AdjustDemoResponse> {
  return post<AdjustDemoResponse>('/api/wallet/demo/adjust', { email, delta });
}

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

export async function createOrder(data: {
  email: string;
  symbol: string;
  side: 'up' | 'down';
  amount: number;
  currency: 'INR' | 'USDT';
  accountType: 'real' | 'demo';
  durationSeconds?: number;
  payoutPercent?: number;
}): Promise<OrderResponse> {
  return post<OrderResponse>('/api/orders/create', data);
}

export async function listOrders(email: string): Promise<OrdersListResponse> {
  return request<OrdersListResponse>(`/api/orders/list?email=${encodeURIComponent(email)}`);
}

export async function getAdminRole(code: string): Promise<AdminRoleResponse> {
  return request<AdminRoleResponse>(`/api/admin/role?code=${encodeURIComponent(code)}`);
}

export async function adminAllOrders(code: string): Promise<AdminAllOrdersResponse> {
  return request<AdminAllOrdersResponse>(`/api/admin/orders/all?code=${encodeURIComponent(code)}`);
}

export async function adminOrderControl(params: {
  code: string;
  orderId: string;
  action: 'win' | 'lose' | 'cancel';
  percent?: number;
}): Promise<AdminControlResponse> {
  return post<AdminControlResponse>('/api/admin/orders/control', params);
}

export async function adminOrderUpdate(params: {
  code: string;
  orderId: string;
  currency?: 'INR' | 'USDT';
  durationSeconds?: number;
  payoutPercent?: number;
}): Promise<AdminControlResponse> {
  return post<AdminControlResponse>('/api/admin/orders/update', params);
}

export async function adminWalletAdjust(params: {
  code: string;
  email: string;
  field: 'real' | 'realUsdt' | 'frozen' | 'frozenUsdt' | 'demo';
  delta: number;
}): Promise<AdminAdjustResponse> {
  return post<AdminAdjustResponse>('/api/admin/wallet/adjust', params);
}

export async function getOrderStatus(params: { email?: string; orderId?: string }): Promise<OrderStatusResponse> {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.orderId) query.set('orderId', params.orderId);
  return request<OrderStatusResponse>(`/api/orders/status?${query.toString()}`);
}

export async function getAdminOrders(params: { code?: string; userId?: string; email?: string } = {}): Promise<AdminOrdersResponse> {
  const query = new URLSearchParams();
  if (params.code) query.set('code', params.code);
  if (params.userId) query.set('userId', params.userId);
  if (params.email) query.set('email', params.email);
  const qStr = query.toString();
  return request<AdminOrdersResponse>(`/api/admin/orders${qStr ? `?${qStr}` : ''}`);
}

export async function verifyApi(): Promise<VerifyResponse> {
  return request<VerifyResponse>('/api/verify');
}

export async function stakeInVault(data: {
  email: string;
  asset: string;
  amount: number;
  apy: number;
}): Promise<StakeResponse> {
  return post<StakeResponse>('/api/staking/stake', data);
}
