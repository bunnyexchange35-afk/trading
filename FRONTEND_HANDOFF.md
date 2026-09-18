# Frontend Handoff — `trading` repo (edge gateway + client)

Read top to bottom. Every response shape below was read out of `server.mjs`
(the contract owner) and cross-checked against `trading-worker/src/index.ts`
and `src/api/*`. Where this doc disagrees with an earlier assumption, the code
wins — deviations are marked **⚠ VERIFIED**.

## §0 — The surface (envelope rules)

Three rules, no exceptions:

| # | Rule | Detail |
|---|------|--------|
| 1 | Success envelope | `{ "success": true, ...payload }`, HTTP 200 (201 for ticket creates) |
| 2 | Failure envelope | `{ "error": "<human string>" }` + non-2xx status. No `success:false`+200 anywhere in this backend (the client still defends against it) |
| 3 | Raw endpoints (no `success` key) | **Only these two**: `GET /api/markets` → `{ data, source, cached?, message? }` and `GET /api/market/klines` → `{ data, source, pair? }`. Everything else, including `/api/markets/:symbol`, uses the envelope |

Endpoint groups (base = same origin, `/api`):

- System: `GET /health`, `GET /verify` (+ `/api/verify`), `GET /` (catalog)
- Markets (raw): `GET /markets`, `GET /market/klines?symbol=BTC&interval=1m|5m|15m|1h`
- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /user/profile`, `GET /user/account`
- Wallet: `GET /wallet/{summary,transactions,frozen}`, `POST /wallet/{frozen/release,deposit/approve,convert-demo,claim-demo,link-demo,demo/adjust}`
- Money: `POST /deposit/submit`, `POST /withdraw/submit`, `POST /withdrawal/support`
- Orders: `POST /orders/create`, `GET /orders/{list,status}`
- Staking: `POST /staking/stake` (⚠ no unstake route — release via `frozen/release`)
- Docs: `GET /account/{statement,proof,agreement,invoice}`, `GET /documents`
- Admin (code, not token): `GET /admin/{role,users,invited-users,orders,orders/all}`, `POST /admin/orders/{control,update}`, `POST /admin/wallet/adjust`
- Desk: `GET /order/{config,assets,currencies,durations}`, `GET /tasks`, `GET /credit-score{,/history}`, `GET /markets/:symbol{,/ohlcv,/analysis}`, `GET|POST /support/tickets`, `GET /notifications`, `GET /nova/status`, `POST /nova/chat`

**⚠ VERIFIED — there is no WebSocket endpoint.** No `/ws`, no upgrade handler,
no `system.welcome` / `market.tick` / `order.*` / `account.updated` frames exist
in either backend. Part B specifies polling + a *proposed* frame contract to
agree with the backend owner before building — do not code against frames that
don't exist yet.

---

# Part A — The `trading` Worker (edge gateway)

## A.1 Target architecture

```
Browser ──► trading Worker ──┬──► ASSETS (dist/, SPA fallback)
                              ├──► /api/*, /verify ──► service binding WEB_BACK ──► backend Worker
                              │                        └─ fallback: BACKEND_URL (https) when binding absent
                              └──► /ws ──► proxied upgrade to backend (only after backend ships WS)
```

**⚠ VERIFIED — current repo state differs.** Today the `trading` Worker *is* the
backend (`trading-worker/src/index.ts`, ~1,475 lines) with `BACKEND` /
`BACKEND_ORIGIN` passthrough only for unimplemented paths. The gateway below is
the target: adding it means deleting the in-Worker backend (see A.5), so agree
the cutover with the backend owner first.

## A.2 `wrangler.jsonc` (gateway)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "trading",
  "main": "trading-worker/src/index.ts",
  "compatibility_date": "2026-08-20",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    // Worker runs FIRST for API/WS; only non-matches fall through to SPA assets.
    "run_worker_first": ["/api/*", "/verify", "/ws"]
  },
  "services": [
    // Backend Worker. MUST match the backend's deployed Worker name.
    { "binding": "WEB_BACK", "service": "<backend-worker-name>" }
  ],
  "vars": {
    // HTTP fallback when the service binding is absent (local/dev).
    // Production: prefer the binding; keep this as the break-glass URL.
    "BACKEND_URL": "https://<backend-host>",
    "ENVIRONMENT": "production"
  },
  "observability": { "enabled": true }
}
```

Mirror file `trading-worker/wrangler.jsonc`: same content with
`"directory": "../dist"` and `"main": "src/index.ts"`. Keep both in sync —
Workers Builds deploys from the repo root.

## A.3 `trading-worker/src/index.ts` (gateway proxy)

Replace the current full-backend Worker with this proxy at cutover:

```ts
export interface Env {
  ASSETS: Fetcher;
  WEB_BACK?: Fetcher;      // service binding to the backend Worker
  BACKEND_URL?: string;    // https fallback (dev / break-glass)
}

const rid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- WebSocket: only proxied; backend must implement the upgrade. ---
    if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return Response.json({ error: 'WebSocket upgrade required.' }, { status: 426 });
      }
      if (env.WEB_BACK) return env.WEB_BACK.fetch(request); // binding preserves the upgrade
      return Response.json(
        { error: 'Live channel unavailable on this deployment.' }, { status: 501 },
      );
    }

    // --- API: service binding first, HTTP fallback second. ---
    if (url.pathname === '/verify' || url.pathname.startsWith('/api/')) {
      if (env.WEB_BACK) {
        const headers = new Headers(request.headers);
        headers.set('X-Request-Id', request.headers.get('X-Request-Id') || rid());
        if (!headers.has('X-Forwarded-For') && request.headers.get('CF-Connecting-IP')) {
          headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP')!);
        }
        return env.WEB_BACK.fetch(new Request(request, { headers }));
      }
      if (env.BACKEND_URL?.trim()) {
        const upstream = new URL(env.BACKEND_URL.trim());
        upstream.pathname = url.pathname;
        upstream.search = url.search;
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('content-length');
        headers.set('X-Request-Id', request.headers.get('X-Request-Id') || rid());
        return fetch(upstream.toString(), {
          method: request.method, headers, redirect: 'manual',
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          // @ts-expect-error duplex is required for streamed request bodies
          duplex: ['GET', 'HEAD'].includes(request.method) ? undefined : 'half',
        });
      }
      return Response.json(
        { error: 'API backend is not configured on this deployment.' }, { status: 502 },
      );
    }

    // --- everything else is the SPA. ---
    return env.ASSETS.fetch(request);
  },
};
```

Notes:

- IP/request-id preservation: `CF-Connecting-IP` → `X-Forwarded-For`,
  generated `X-Request-Id` when the client didn't send one.
- Service bindings forward WebSocket upgrades; plain `fetch()` to a URL does
  not reliably upgrade — hence 501 on the HTTP path for `/ws`.
- The gateway emits 502 **only** when no backend is configured. The backend
  itself never emits 502 (verified: no such status in `server.mjs`), so a 502
  always means "gateway has nowhere to send this."

## A.4 Vite config

- `VITE_API_URL=""` (empty) in production: the client uses same-origin `/api`,
  so the gateway handles routing and no CORS is involved. Set a real
  `VITE_API_URL` only for split deploys where the SPA is *not* served by the
  gateway Worker.
- Local dev proxies to `wrangler dev` (port 8787) so the gateway is exercised
  locally:

```ts
// vite.config.ts (server.proxy)
{
  '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true, ws: true },
  '/verify': { target: 'http://127.0.0.1:8787', changeOrigin: true },
  '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
}
```

Run `npx wrangler dev -c wrangler.jsonc` (serves gateway + SPA) alongside
`vite` (HMR). `ws: true` on `/api` is harmless and required on `/ws`.

## A.5 What to delete (cutover)

| Delete / remove | Why |
|---|---|
| All route handlers in `trading-worker/src/index.ts` (replaced by A.3) | Two backends = split brain: the edge copy and the real backend diverge on balances/orders with no reconciliation |
| Local `STORE` KV binding / `DB` D1 binding on the gateway Worker | Persistence lives in the backend now; a second store guarantees phantom balances |
| Any frontend market mocks / stub clients | Markets come from the backend feed only |
| `BACKEND` / `BACKEND_ORIGIN` vars | Renamed to `WEB_BACK` / `BACKEND_URL` per this spec |

**Split-brain warning:** never run the old full-backend Worker and the gateway
against the same production traffic. Cut over by deploying the gateway Worker
to `trading` in one deploy, then verify per Part C.

---

# Part B — Client implementation

Conventions (already in `src/api/client.ts`, keep them): bearer on every
request; `ApiError { message, status, kind }`; `success:false`+200 treated as
failure; non-JSON 2xx on an API path = `malformed` (you hit the SPA fallback).

## B.1 The 11 new endpoint groups (verified shapes)

### 1. Order desk config — `GET /api/order/config` (public)

```ts
type OrderConfig = {
  enabled: boolean; accountTypes: ('real'|'demo')[];
  assets: { symbol: string; name: string; enabled: boolean }[];
  currencies: { code: 'INR'|'USDT'; enabled: boolean;
    minAmount: number; maxAmount: number; quickAmounts: number[] }[];
  durations: number[]; payoutPercents: number[];
  defaultDuration: number; defaultPayoutPercent: number;
  settlement: { mode: 'expiry'; description: string; frozenUntilSettlement: boolean };
};
export const getOrderConfig = () => get<{ success: true; config: OrderConfig }>('/api/order/config');
// Siblings: GET /api/order/assets → { success, assets }, /api/order/currencies → { success, currencies },
// GET /api/order/durations → { success, durations }
```

### 2. Tasks — `GET /api/tasks` (auth)

```ts
type Task = { id: string; title: string; description: string; category: string;
  priority: 'high'|'medium'|'low'; status: 'pending'|'in_progress'|'completed'|'failed'|'overdue';
  createdAt: string; dueDate: string; completedAt: string | null };
// → { success: true, tasks: Task[],
//     summary: { total, pending, inProgress, completed, failed, overdue } }
```

### 3. Credit score — `GET /api/credit-score`, `GET /api/credit-score/history` (auth)

```ts
// GET /api/credit-score → { success: true,
//   creditScore: { score: number; status: 'excellent'|'good'|'fair'|'poor';
//     updatedAt: string; category: string } }
// GET /api/credit-score/history → { success: true,
//   history: { score: number; status: string; at: string }[] }  // max 24
```

Never compute or edit the score client-side.

### 4. Account snapshot — `GET /api/user/account` (auth)

```ts
// → { success: true, account: { id, username, name, email, phone, status,
//   category, inviteCode, invitedBy, invitedByType, adminUserCode,
//   createdAt, lastActivityAt, creditScore: { score, status, updatedAt } } }
```

### 5. Market detail — `GET /api/markets/:symbol{,/ohlcv,/analysis}` (public)

```ts
// /api/markets/BTC → { success: true, market: { symbol, name, color, soft, mark,
//   price, change, high, low, volume, pair, rank, marketCap: null,
//   status: 'live'|'delayed'|'unavailable', source, lastUpdated, providerMessage? } }
// /api/markets/BTC/ohlcv?interval=1m → { success: true, symbol, interval,
//   ohlcv: { time, open, high, low, close, volume }[], source, status: 'live', lastUpdated }
//   on provider outage: 503 { success: false, error }
// /api/markets/BTC/analysis?interval=5m → { success: true, symbol, interval,
//   analysis: { price, trend: 'uptrend'|'downtrend'|'sideways', volatilityPercent,
//     rsi14, macd, macdSignal, macdHistogram, sma20, sma50, ema12, ema26,
//     momentumPercent, support, resistance }, status: 'live', source, lastUpdated }
```

Intervals: `1m 5m 15m 1h`. Unknown symbol → 404 `{ error }`.

### 6. Support tickets — `GET|POST /api/support/tickets` (auth)

```ts
type Ticket = { id: string; category: 'Withdrawal'|'Account'|'Order'|'Wallet'|'Documents'|'Other';
  subject: string; message: string; status: string; createdAt: string; updatedAt: string;
  response: string | null; request: { currency: 'INR'|'USDT'; amount?: number } | null };
// GET → { success: true, tickets: Ticket[], categories: string[] }
// POST { category, subject?, message } → 201 { success: true, message, ticket }
// bad category / empty message → 422 { error }
```

### 7. Withdrawal review — `POST /api/withdrawal/support` (auth)

```ts
// body { currency: 'INR'|'USDT', amount?: number, note?: string }
// → 201 { success: true, message, ticket }   (a support ticket, NOT a payout)
// amount ≤ 0 / NaN → 422; amount > available → 409 { error }
// NOTE: POST /api/withdraw/submit exists too (instant debit) — the Wallet UI
// must use /withdrawal/support (review flow), never the instant endpoint.
```

### 8. Notifications — `GET /api/notifications` (auth)

```ts
// → { success: true,
//   notifications: { id, kind: 'order'|'task'|'support', title, message, at }[],
//   unread: 0 }   // ⚠ hardcoded 0 server-side — render the list, ignore unread
```

### 9. Documents catalog — `GET /api/documents` (auth)

```ts
// → { success: true, documents: { id, type, title, description, endpoint }[] }
// endpoint values: /api/account/statement, /api/account/proof,
//   /api/account/agreement[?type=payout], /api/account/invoice
```

### 10. Invoice — `GET /api/account/invoice?email=` (auth)

```ts
// → { success: true, invoice: { invoiceId, issuedAt, periodStart, periodEnd,
//   billTo: { name, email, phone, userId, inviteCode },
//   items: { position, description, detail, date, amount, currency }[],
//   totals: { subtotalInr, subtotalUsdt, platformFee: 0, tax: 0, totalInr, balanceDue: 0 },
//   notes } }
```

### 11. NOVA — `GET /api/nova/status`, `POST /api/nova/chat` (chat: auth)

```ts
// status → { success: true, nova: { online, assistant: 'NOVA',
//   model: 'gemini'|'nova-rulepack', grounded, topics: string[], at } }
// chat { message } → { success: true, reply, at, sources: string[], model }
// empty message → 422 { error }
```

### Corrected shapes for two often-misquoted endpoints ⚠ VERIFIED

```ts
// POST /api/wallet/claim-demo { email, amount? }  (auth)
// → { success: true, claimedAmount: number, newDemoBalance: number }
//   (NOT { claimed, delta?, demoBalance } — those keys do not exist.)

// POST /api/wallet/deposit/approve { email, id, code }  (STAFF-ONLY, admin code)
// → { success: true, message, approvedAmount, newRealBalance, newFrozenBalance }
//   (no `status` key). Missing id → 400; bad code → 403; unknown email/item → 404.
```

## B.2 Error handling

| Status | Meaning here | Client action |
|---|---|---|
| 400 | Validation (`{ error }`) | Show message next to the field |
| 401 | Missing/invalid/rotated token | Clear session → sign-in (see B.3) |
| 403 | Cross-account email, bad admin code | Show message; never retry silently |
| 404 | Unknown symbol / missing item / unknown login email | Show message; for login, route to register |
| 409 | Order already settled (returns `{ error, order }`); withdrawal over balance | **Re-fetch** the resource, render fresh state |
| 422 | Field errors (tickets, withdrawal amount, NOVA empty) | Inline field error from `{ error }` |
| 429 | **Not emitted by this backend** — defensive only | Honor `Retry-After` if a proxy sends one |
| 502 | **Gateway-only** (no backend configured, §A.3) | Self-healing banner: "Service starting — retrying", exponential backoff, then support link |
| 503 | Provider outage (ohlcv/analysis) | Cached-data banner with `lastUpdated`; retry button |
| 201 | Ticket / withdrawal-review created | Treat as success, route to ticket view |
| 0 / timeout | Network down | Offline banner; queue nothing silently |

## B.3 Auth

- **End users:** email-only login. `POST /api/auth/login { email }` → 200
  `{ success, user, token }` or 404 (unknown email → offer register). The
  backend has **no password check** — do not add a decorative password field;
  the sign-in form must disclose email-only auth. Token goes in
  `Authorization: Bearer`, attached to every request including public ones.
- **Staff/operator:** there is **no staff session endpoint and no
  code-as-bearer** in this backend — admin calls authenticate with the code as
  a parameter (`?code=` or body `{ code }`). The `staffMe(code)` equivalent is:

```ts
// GET /api/admin/role?code=MUDREXX-ADMIN → { success: true, role: 'admin'|'super' }
// bad code → 403. Use it to validate an operator code, then include { code }
// in every admin/staff call body (deposit/approve, orders/control, ...).
export const staffMe = (code: string) =>
  get<{ success: true; role: 'admin' | 'super' }>('/api/admin/role', { code });
```

**⚠ VERIFIED — `MUD-ADMIN001` does not exist in the code.** Working defaults
are `ADMIN_CODES=MUDREXX-ADMIN,ADMIN-2024,ADMIN777,MEDRIX888,ADMIN` and
`SUPER_ADMIN_CODES=MUDREXX-SUPER,SUPER-2024` (override via env in production).
Do not ship any code as a bearer token — the backend would ignore it.

## B.4 Live updates (polling now, WS contract proposed)

No WS exists, so ship polling first:

- Markets ticker: `GET /api/markets` every 8s (matches server cache TTL).
- Open orders: `GET /api/orders/list` every 10s while the Trade page is open
  (fetching also triggers lazy settlement).
- Notifications: every 30s.

**Proposed** frame contract — implement client-side only after the backend
acknowledges it:

```ts
type WsFrame =
  | { type: 'system.welcome'; requestId: string; serverTime: string }
  | { type: 'market.tick'; symbol: string; price: number; change: number; at: string }
  | { type: 'order.opened' | 'order.settled' | 'order.cancelled'; orderId: string; status: string; at: string }
  | { type: 'account.updated'; email: string; at: string }; // client re-fetches summary
```

Client rules: connect to same-origin `/ws` with `?token=` (browsers can't set
WS headers); on `account.updated` / `order.*`, re-fetch REST (frames are hints,
never state); backoff reconnect 1s→30s; fall back to polling when the gateway
answers 501/426.

## B.5 Per-screen wiring

| Screen | Control | Endpoint |
|---|---|---|
| Wallet | Balance cards, ledger | `GET /wallet/summary`, `GET /wallet/transactions` |
| Wallet | Convert % / MAX | `POST /wallet/convert-demo { demoCredits }` |
| Wallet | Claim credits | `POST /wallet/claim-demo { amount? }` |
| Wallet | Release hold / unstake / cancel order | `POST /wallet/frozen/release { id }` |
| Wallet | Withdraw button | `POST /withdrawal/support` (review — never instant) |
| Wallet | Deposit submit | `POST /deposit/submit { amount, rail, method, reference }` |
| Earn / staking | Stake vault | `POST /staking/stake { asset, amount, apy }` (apy from market `stakingApy`, never user-typed) |
| Earn | Task list | `GET /tasks` |
| Trade | Desk config (assets/durations/payouts) | `GET /order/config` |
| Trade | Buy up / Buy down | `POST /orders/create` |
| Trade | Chart | `GET /market/klines` (raw) or `GET /markets/:symbol/ohlcv` |
| Trade | Indicators | `GET /markets/:symbol/analysis` |
| Trade | Order history | `GET /orders/list` |
| Markets | Table + detail | `GET /markets`, `GET /markets/:symbol` |
| Credit | Score card + history | `GET /credit-score`, `GET /credit-score/history` |
| Support | Tickets + new ticket | `GET|POST /support/tickets` |
| Documents | Catalog + PDF endpoints | `GET /documents`, then catalog `endpoint` values |
| NOVA | Status dot + chat | `GET /nova/status`, `POST /nova/chat` |
| Staff (separate surface) | Approve deposit | `POST /wallet/deposit/approve { email, id, code }` |
| Staff (separate surface) | Order control | `POST /admin/orders/control { code, orderId, action, percent? }` |

---

# Part C — Rollout

## C.1 6-step deploy checklist

1. **Backend sanity curls** (against the real backend origin, before touching
   this repo): `/api/health` → 200 JSON; `/api/markets` → 32 rows;
   `POST /auth/register` → token; `GET /admin/role?code=` → role;
   `POST /support/tickets` → 201; `GET /markets/BTC/analysis` → indicators.
2. **Repo changes:** gateway `wrangler.jsonc` ×2 (A.2), proxy Worker (A.3),
   Vite proxy (A.4), client functions (B.1), deletions (A.5).
3. **Staging deploy:** `npm run build && npx wrangler deploy` to a staging
   Worker name; set `WEB_BACK` to the staging backend.
4. **Gateway verification:** `GET /verify` → JSON (not HTML);
   `POST /api/auth/register` → not 405; `/api/*` responses carry the backend's
   bodies; `X-Request-Id` present; kill the binding → 502 JSON (proves the
   gateway path, not SPA fallback).
5. **Functional smoke test:** walk B.5 top to bottom against staging — every
   endpoint must return its §B.1 shape; force one 409 (settle an order twice),
   one 422 (empty ticket), one 503 (point backend at a dead provider or read
   the fallback), one 502 (unbind backend briefly).
6. **Production promote:** point `WEB_BACK` at the prod backend, deploy to
   `trading`, re-run step 4 against
   `https://trading.rufflocrm.workers.dev`, then step 5's critical path
   (register → deposit → order → release).

## C.2 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `GET /api/health` returns HTML | Static-assets-only deploy (no `main`) | Deploy with `-c wrangler.jsonc`; check `run_worker_first` |
| `POST /api/*` → 405 | Request hit SPA assets, not the Worker | Same as above; verify `/verify` returns JSON |
| `malformed` errors in client | API path served index.html | Gateway routing (A.2/A.3) or backend down + fallback serving SPA |
| 502 JSON `{ error }` | Gateway has no backend (binding + URL both missing) | Set `WEB_BACK` or `BACKEND_URL` |
| 401 after working session | Token rotated by a second login | Re-login; tokens are single-flight |
| 403 on own-email calls | Email/session mismatch | Use session email only (§B, rule 1) |
| Balances differ between deploys | Split brain: two backends/stores live | A.5 — one backend, one store, cut over atomically |
| WS 426/501 | Backend has no WS yet | Stay on polling (§B.4) |

## C.3 Do / Don't

**Do:** same-origin `/api` everywhere; bearer on every call; session email only;
re-fetch on 409; apy/limits/config from backend responses, never constants;
treat frames as hints; verify 502-path proves gateway routing.

**Don't:** don't invent response keys (all 11 groups are quoted verbatim above);
don't send operator codes as bearer tokens; don't call `/withdraw/submit` from
the Wallet UI; don't compute credit/analysis client-side; don't build WS UI
before the backend ships `/ws`; don't keep a second store on the gateway.
