/**
 * Typed endpoint surface — the ONLY place backend paths appear.
 *
 * Two rules enforced structurally:
 *
 * 1. Identity. Every route under `/api/{wallet,orders,deposit,withdraw,staking,
 *    user,account}` is token-gated by a prefix mount (server.mjs:681), and
 *    `requireAuth` refuses an email that is not the token owner with 403. So
 *    the session's own email is injected here and no caller can pass an
 *    arbitrary one. The bearer token is attached by `client.ts` on every
 *    request, including the public ones.
 *
 * 2. Forbidden routes are simply not exported, so no page can reach them:
 *      POST /api/wallet/deposit/approve  — staff-only (admin code). It used to
 *                                          accept the account holder's own
 *                                          session (audit F10, fixed on this
 *                                          branch); it remains excluded from
 *                                          the user surface regardless
 *      POST /api/wallet/demo/adjust      — arbitrary demo delta, no role check
 *      POST /api/staking/unstake         — does not exist (F3)
 *      /api/admin/*                      — separate app (F12)
 *    Unstaking is `wallet.releaseFrozen(vaultId)`.
 */

import { get, post, put, readSession, ApiError } from './client';
import type {
  AccountResponse,
  AgreementResponse,
  AuthResponse,
  CreditHistoryResponse,
  CreditScoreResponse,
  DepositRail,
  DepositSubmitResponse,
  DocumentsResponse,
  FrozenResponse,
  HealthResponse,
  InvoiceResponse,
  KlinesResponse,
  MarketAnalysisResponse,
  MarketDetailResponse,
  MarketsResponse,
  MeResponse,
  NotificationsResponse,
  NovaChatResponse,
  NovaStatusResponse,
  OhlcvResponse,
  OrderConfigResponse,
  OrderCreateInput,
  OrderCreateResponse,
  OrderListResponse,
  OrderStatusResponse,
  ProfileUpdate,
  ProofResponse,
  ReleaseResponse,
  StakeResponse,
  StatementResponse,
  SupportCreateResponse,
  SupportListResponse,
  TasksResponse,
  TransactionsResponse,
  User,
  WalletSummaryResponse,
  WithdrawalSupportResponse,
} from './responses';

export * from './client';
export * from './responses';

/** The session's own email, or a typed failure. Never caller-supplied. */
function ownEmail(): string {
  const email = readSession()?.email;
  if (!email) {
    throw new ApiError('You need to sign in before doing that.', 401, 'auth');
  }
  return email;
}

/* ------------------------------------------------------------------ health */

export const getHealth = () => get<HealthResponse>('/api/health');

/* -------------------------------------------------------------------- auth */

export type RegisterInput = {
  name: string;
  email: string;
  phone?: string;
  preferredCurrency?: 'INR' | 'USDT';
  /** Optional referral or admin code; registration also works without one. */
  inviteCode?: string;
};

export const register = (input: RegisterInput) => post<AuthResponse>('/api/auth/register', input);

/**
 * Credential model (honest version): the backend has NO password check, so no
 * password parameter exists here — accepting one would be fake authentication.
 * Two related facts, both verified live:
 *
 *  - FIXED (security commit on this branch): login no longer creates accounts.
 *    It is a lookup — unknown emails get 404, so the invitation-only gate on
 *    `/api/auth/register` actually holds end to end.
 *  - STILL OPEN: sign-in verifies no credential. Knowing a registered email is
 *    enough to open its session. The sign-in form discloses this instead of
 *    hiding it behind a decorative password field.
 */
export const login = (email: string) => post<AuthResponse>('/api/auth/login', { email });

export const getMe = () => get<MeResponse>('/api/auth/me');

export const updateProfile = (patch: ProfileUpdate) =>
  put<User & { success?: boolean }>('/api/user/profile', { email: ownEmail(), ...patch });

export const getAccount = () => get<AccountResponse>('/api/user/account');

/* ----------------------------------------------------------------- markets */

export const getMarkets = () => get<MarketsResponse>('/api/markets');

export const getKlines = (symbol: string, interval: string) =>
  get<KlinesResponse>('/api/market/klines', { symbol, interval });

export const getMarketDetail = (symbol: string) =>
  get<MarketDetailResponse>(`/api/markets/${encodeURIComponent(symbol)}`);

export const getOhlcv = (symbol: string) =>
  get<OhlcvResponse>(`/api/markets/${encodeURIComponent(symbol)}/ohlcv`);

export const getMarketAnalysis = (symbol: string) =>
  get<MarketAnalysisResponse>(`/api/markets/${encodeURIComponent(symbol)}/analysis`);

/* ------------------------------------------------------------- desk config */

export const getOrderConfig = () => get<OrderConfigResponse>('/api/order/config');

/* ------------------------------------------------------------------ wallet */

export const getWalletSummary = () =>
  get<WalletSummaryResponse>('/api/wallet/summary', { email: ownEmail() });

export const getTransactions = () =>
  get<TransactionsResponse>('/api/wallet/transactions', { email: ownEmail() });

export const getFrozen = () => get<FrozenResponse>('/api/wallet/frozen', { email: ownEmail() });

/**
 * The universal release: unstakes a vault, cancels an open order hold, or
 * releases a pending deposit back out. `id` is a frozenItems id.
 */
export const releaseFrozen = (id: string) =>
  post<ReleaseResponse>('/api/wallet/frozen/release', { email: ownEmail(), id });

/** Convert demo credits to real INR at the wallet's server-set rate. */
export const convertDemo = (demoCredits: number) =>
  post<{ success: true; message?: string; converted?: number; newRealBalance?: number }>(
    '/api/wallet/convert-demo',
    { email: ownEmail(), demoCredits },
  );

/* ----------------------------------------------------------------- deposit */

export const submitDeposit = (input: {
  amount: number;
  rail: DepositRail;
  method?: string;
  reference?: string;
}) =>
  post<DepositSubmitResponse>('/api/deposit/submit', {
    email: ownEmail(),
    amount: input.amount,
    rail: input.rail,
    method: input.method ?? (input.rail === 'inr' ? 'upi' : 'trc20'),
    reference: input.reference ?? '',
  });

/* ------------------------------------------------------- withdrawal  (S1) */

/**
 * Files a withdrawal review with support. Does NOT debit the balance and does
 * NOT execute a payout — the backend never executes payouts (F8).
 */
export const requestWithdrawal = (input: {
  currency: 'INR' | 'USDT';
  amount?: number;
  note?: string;
}) => post<WithdrawalSupportResponse>('/api/withdrawal/support', input);

/* ------------------------------------------------------------------ orders */

export const createOrder = (input: OrderCreateInput) =>
  post<OrderCreateResponse>('/api/orders/create', { email: ownEmail(), ...input });

/** Fetching this list is also what triggers lazy settlement (F13). */
export const listOrders = () =>
  get<OrderListResponse>('/api/orders/list', { email: ownEmail() });

export const getOrderStatus = (orderId: string) =>
  get<OrderStatusResponse>('/api/orders/status', { orderId, email: ownEmail() });

/** Cancel = release the order's frozen hold (no dedicated endpoint exists). */
export const cancelOrder = (orderId: string) => releaseFrozen(orderId);

/* ----------------------------------------------------------------- staking */

/**
 * INR-denominated. `apy` is not validated server-side, so it is always taken
 * from the backend's own market data (`stakingApy`), never typed by a user (F4).
 */
export const stake = (input: { asset: string; amount: number; apy: number }) =>
  post<StakeResponse>('/api/staking/stake', { email: ownEmail(), ...input });

/** Unstake. `/api/staking/unstake` does not exist (F3). */
export const unstake = (vaultId: string) => releaseFrozen(vaultId);

/* ------------------------------------------------------- student desk area */

export const getTasks = () => get<TasksResponse>('/api/tasks');

export const getCreditScore = () => get<CreditScoreResponse>('/api/credit-score');

export const getCreditHistory = () => get<CreditHistoryResponse>('/api/credit-score/history');

/** `unread` is hardcoded to 0 by the backend — see F6. */
export const getNotifications = () => get<NotificationsResponse>('/api/notifications');

export const getSupportTickets = () => get<SupportListResponse>('/api/support/tickets');

export const createSupportTicket = (input: {
  category: string;
  subject: string;
  message: string;
}) => post<SupportCreateResponse>('/api/support/tickets', input);

export const getDocuments = () => get<DocumentsResponse>('/api/documents');

export const getStatement = () =>
  get<StatementResponse>('/api/account/statement', { email: ownEmail() });

export const getProof = () => get<ProofResponse>('/api/account/proof', { email: ownEmail() });

export const getAgreement = (type?: 'account' | 'payout') =>
  get<AgreementResponse>('/api/account/agreement', {
    email: ownEmail(),
    ...(type === 'payout' ? { type: 'payout' } : {}),
  });

export const getInvoice = () => get<InvoiceResponse>('/api/account/invoice', { email: ownEmail() });

/* -------------------------------------------------------------------- nova */

export const getNovaStatus = () => get<NovaStatusResponse>('/api/nova/status');

export const askNova = (message: string) => post<NovaChatResponse>('/api/nova/chat', { message });
