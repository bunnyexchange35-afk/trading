# Backend Contract Audit — Verified From Source

**Scope:** `server.mjs` (Express/Node) and `trading-worker/src/index.ts` (Cloudflare Worker),
audited at commit `6761b66`. Every statement below was read out of the source, not out of the
markdown docs in this repo. Where the docs and the code disagree, **the code wins and the
disagreement is called out.**

This file is the evidence backing `FRESH_FRONTEND_COMMAND.md`.

---

## 1. There are two backends, and they are not the same product

`server.mjs` is the **superset**. The Worker implements a **reduced subset**.

| | `server.mjs` (Node/Express) | `trading-worker` (Cloudflare) |
|---|---|---|
| Unique API route paths | **51** | **32** |
| Persistence | JSON file on disk (`server/data/users.json`) | **In-memory** (optional KV namespace `STORE`) |
| Serves built SPA | Yes — `express.static('dist')` + `GET *` fallback | Yes — `assets.directory = "../dist"`, SPA fallback |
| Docker | Yes (`Dockerfile`, `docker-compose.yml`) | No |

### 21 routes exist in Node with **no Worker handler**

These will `404` if the frontend is deployed to the Worker:

```
/api/account/agreement        /api/account/invoice          /api/account/proof
/api/account/statement        /api/credit-score             /api/credit-score/history
/api/documents                /api/markets/:symbol          /api/markets/:symbol/analysis
/api/markets/:symbol/ohlcv    /api/notifications            /api/nova/chat
/api/nova/status              /api/order/assets             /api/order/config
/api/order/currencies         /api/order/durations          /api/support/tickets
/api/tasks                    /api/user/account             /api/withdrawal/support
```

**Consequence:** every "student desk" product area in the proposed IA — Tasks, Credit Score,
Notifications, Support, Documents, NOVA, market analysis panel, order desk config — depends on
a Node-only route. **The Worker cannot host the full frontend.** It can host a
markets + auth + wallet + orders + staking app only.

The Worker's own config confirms the persistence story
(`trading-worker/wrangler.jsonc`):

> "OPTIONAL persistent user/order storage. Without it the worker runs on an in-memory store
> (accounts reset on each deploy)."

---

## 2. `POST /api/staking/unstake` **does not exist**

This is the single most important correction to the proposed command.

`/api/staking/unstake` appears **exactly once** in the entire repo — as a string inside the
self-documenting discovery payload at `server.mjs:434`:

```js
staking: {
  stake:   'POST /api/staking/stake',
  unstake: 'POST /api/staking/unstake',   // ← advertised
},
```

There is **no route handler** for it. `grep -rn "unstake"` across `server.mjs`,
`trading-worker/`, and `src/` returns that one line and nothing else.

**The real unstake path is `POST /api/wallet/frozen/release`.** Staking does not create a
separate staking position — it moves funds into the generic frozen-funds bucket:

```js
// POST /api/staking/stake  (server.mjs:1533)
user.wallet.realBalance -= amt;
user.wallet.frozenBalance += amt;
user.wallet.frozenItems.unshift({
  id: `stk-${Date.now()}`,      // ← this id is what /api/wallet/frozen/release wants
  category: 'staking',
  status: 'accruing',
  canRelease: true,
  apy: Number(apy),
  currency: 'INR',
  ...
});
// response: { success, message, vaultId, newAvailable, newFrozen }
```

```js
// POST /api/wallet/frozen/release  (server.mjs:1090)
// body: { email, id }   →  id === vaultId from stake
// response: { success, message, releasedAmount, newRealBalance, newFrozenBalance }
```

So a staked vault is a `frozenItems` entry with `category: 'staking'`, released by id through
the same endpoint that releases order holds, deposit holds and withdrawal holds.

**A frontend built against `/api/staking/unstake` would ship a dead button.**

---

## 3. Staking is INR-denominated; `asset` is cosmetic

`POST /api/staking/stake` accepts `{ email, asset = 'ETH', amount, apy = 4.7 }` and debits
`user.wallet.realBalance` — the **INR** balance. The response transaction is written with
`currency: 'INR'` and the message renders `₹${amt}`.

- You **cannot** stake USDT through this endpoint. `realUsdtBalance` is untouched.
- `asset` only labels the vault title (`Flexible ${asset} Staking Vault`). It does not select a
  balance, an asset ledger, or a per-asset APY.
- `apy` is **client-supplied and unvalidated** against the server's `apyLocked` table
  (`server.mjs:55`). The server stores whatever number the caller sends.
- There is **no yield accrual engine**. Nothing credits APY over time; `status: 'accruing'` is a
  label. Releasing returns exactly the staked principal.

An honest Earn page must therefore present APY as indicative and must not show projected or
accrued earnings that the backend never pays.

---

## 4. Persistence: **no D1 anywhere**

The D1-authoritative assumption is **not supported by this repo.** No D1 binding, no `prepare()`,
no `d1_databases` entry, no SQL execution exists in either backend.

- **Node:** in-memory `userDb` Map, debounced (350 ms) atomic write to
  `server/data/users.json` via a `.tmp` + `rename`. `DATA_DIR` env var overrides the location.
  The `Dockerfile` declares `VOLUME /app/server/data`. The directory is gitignored and does not
  exist in the checkout — it is created at runtime.
- **Worker:** in-memory only, unless a KV namespace is bound as `STORE`.

The one SQL file in the repo, `database/migrations/001_add_account_documents.sql`, is
**not wired to anything** — no code reads it. Treat `database/` as aspirational.

---

## 5. Auth is hybrid, and the trading surface is **not** token-gated

Only **10** routes run through `requireAuth`:

```
GET  /api/tasks                  GET  /api/credit-score          GET  /api/credit-score/history
GET  /api/user/account           GET  /api/support/tickets       POST /api/support/tickets
POST /api/withdrawal/support     GET  /api/notifications         GET  /api/documents
POST /api/nova/chat
```

Everything else that touches money takes identity as a **plain `email`** in the query string or
request body, with **no token check**:

```
POST /api/orders/create      GET  /api/wallet/summary       GET  /api/wallet/transactions
GET  /api/wallet/frozen      POST /api/wallet/frozen/release POST /api/staking/stake
POST /api/deposit/submit     POST /api/withdraw/submit      GET  /api/orders/list
GET  /api/orders/status      POST /api/wallet/convert-demo  POST /api/wallet/claim-demo
POST /api/wallet/demo/adjust POST /api/wallet/deposit/approve
```

`requireAuth` itself supports `Authorization: Bearer`, `x-auth-token`, and `?token=`, and when it
does run it correctly rejects a mismatched `email` with `403` and defaults `email` to the token
owner.

Aggravating factor: these handlers call `getOrCreateUser(email)`, which **silently creates an
account** for an unknown email (`server.mjs:214`) and falls back to `demo@mudrexx.com` when email
is empty.

**This is a backend authorization gap, not a frontend bug.** A fresh frontend must still send the
bearer token on every call (so it is correct the moment the backend is gated) and must never
expose these endpoints in a way that lets one user act on another's email. The gap should be
reported, not quietly worked around.

---

## 6. Admin is a shared-secret surface, currently living inside the user SPA

Admin routes authenticate with a **code**, not a token — `?code=` on GETs, `{ code }` in POST
bodies. Codes come from `ADMIN_CODES` / `SUPER_ADMIN_CODES` env vars, with hardcoded defaults
(`MUDREXX-ADMIN`, `ADMIN-2024`, `ADMIN777`, `MEDRIX888`, `ADMIN`; super: `MUDREXX-SUPER`,
`SUPER-2024`).

```
GET  /api/admin/role            GET  /api/admin/users          GET  /api/admin/invited-users
GET  /api/admin/orders          GET  /api/admin/orders/all     POST /api/admin/orders/control
POST /api/admin/orders/update   POST /api/admin/wallet/adjust  (super admin only)
```

`POST /api/admin/wallet/adjust` mutates `real | realUsdt | frozen | frozenUsdt | demo` balances
directly. `POST /api/admin/orders/control` force-resolves any user's order `win | lose | cancel`.

Confirmed problem: `src/App.tsx` mounts `POST /admin/users` → `AdminUsersPage` **in the same
router as the user app**, in the same bundle. Anyone who downloads the SPA can read the admin UI
and its code-entry flow. Separation is a real requirement, not a stylistic preference.

---

## 7. Server-authoritative business logic (do not reimplement client-side)

The source is explicit — `server.mjs:1859`:

> `// ---- server-side credit score & user category (the frontend never computes these)`

- **Credit score:** `computeCreditScore(user)` — base 420, + activity (settled × 6, cap 120),
  + win rate (cap 120), + tasks done (× 15, cap 90), + account age (cap 90), + deposit tier
  (15 / 35 / 60), clamped 300–900. Status bands: ≥800 excellent, ≥700 good, ≥600 fair, else poor.
- **Category:** `computeCategory(user)` → `Restricted | Inactive | New | …`
- **Order settlement:** *lazy, on read.* `autoSettleOrders(user)` runs when orders are listed;
  an open order past `expiresAt` is closed against the live price, `settledBy: 'market'`.
  Admins may resolve early via `/api/admin/orders/control`.
- **Order validation (`POST /api/orders/create`):**
  `durationSeconds` clamped **5–86400** (default 60); `payoutPercent` clamped **1–500**
  (default 5); `side` ∈ `up|down`; `currency` ∈ `INR|USDT`; `accountType` ∈ `real|demo`.
  Real orders check available balance per currency and move funds to frozen; demo orders do not.
  Order id format `ord-${Date.now()}`; stores `entryPrice`, `expiresAt`.
- **Order desk config** is served, not hardcoded: `GET /api/order/config` (plus `/assets`,
  `/currencies`, `/durations`) returns the enabled asset/currency/duration lists. Read them.

---

## 8. Registration requires an invitation code (enforced server-side)

`POST /api/auth/register` `{ name, email, phone, preferredCurrency, inviteCode }`.
`inviteCode` is mandatory and must resolve to an admin or super-admin role:

```js
if (!String(inviteCode || '').trim() || !codeRole) {
  return res.status(403).json({ error: 'Registration is by invitation only. Enter the code assigned to you.' });
}
```

New accounts start at **₹0.00 real balance** with demo credits. Success returns
`{ success, message, user, token }` — a bearer token, same as login.

Confirmed frontend gap: `src/App.tsx` has **no `/register` route**. Sign-up is folded into the
login screen (`src/components.tsx:372`), so the invitation-code requirement is not first-class
in the current UI.

---

## 9. Why the existing `src/api.ts` carries `earn | v2 | unknown`

Its header comment names the cause — it speaks to two different live backends:

```
- Earn (local `server.mjs`):            { success, user, error }
- V2 mudrexx-control (`mudrexxback`):   GET /api/auth/me → { ok: true, type: "anonymous" | "access" }
                                        protected calls  → ACCESS_REQUIRED
```

That is why it has `BackendContract`, `interpretAuthBody`, `mapBackendUser`, `isAccessRequired`,
`followLink`, and the `/a/:code` + `/s/:code` access-link routes. **None of that machinery exists
in this repo's backends** — no route in `server.mjs` or the Worker returns `ACCESS_REQUIRED` or an
`{ ok, type }` envelope. It is compatibility debt for a third-party deployment.

`API_BASE` is `import.meta.env.VITE_API_URL ?? ''` — same-origin by default. Keep that.

---

## 10. Domain types already exist and match the backend

`src/types.ts` defines `FrozenFundCategory` (`order | deposit | staking | withdrawal`),
`FrozenFundItem`, `WalletTransaction`, `UserWallet`, `User`, `CreditSnapshot`,
`CreditHistoryPoint`, `StudentTask`, `TasksSummary`, `SupportTicket`, `StudentNotification`,
`OrderDeskConfig`, `MarketAnalysis`, `MarketDetail`, `DocumentCatalogItem`, `NovaStatus`,
`AuthProfile`, `Session`, `TradeOrder`.

These are worth **reusing as a type layer** even while the UI is rebuilt from scratch — they
encode the verified response shapes.

---

## 11. Deposits book a frozen entry — there is no payment rail

`POST /api/deposit/submit` `{ email, amount, rail='inr', method='upi', reference='' }`
(`server.mjs:1280`) creates a `frozenItems` entry and adds to frozen balance:

```js
{ id: `dep-${Date.now()}`, category: 'deposit', status: 'processing',
  reason: reference ? `Ref: ${reference}` : 'Verification in progress (Sandbox)',
  canApprove: true, canRelease: true, ... }
// → { success, message, depositId, amount, currency, status:'processing', newFrozenBalance }
```

There is **no gateway, no UPI collect, no VPA, no USDT address, no QR** — and the backend
returns **no payment instructions of any kind**. A deposit UI that shows "send to this UPI ID"
would be inventing it.

### 🔴 `POST /api/wallet/deposit/approve` is ungated and self-credits

`server.mjs:1144`, commented *"Approve pending deposit (sandbox verification)"*. Body
`{ email, id }` — **no auth, no admin code**. It moves the frozen deposit straight to
available balance **and** increments `wallet.depositCreditedTotal`:

```js
if (isINR) user.wallet.depositCreditedTotal = Number(user.wallet.depositCreditedTotal || 0) + item.amount;
user.wallet.realBalance += item.amount;
```

`depositCreditedTotal` is an input to `computeCreditScore` (deposit tier: 15 / 35 / 60 points).
So an unauthenticated caller who knows an email and a deposit id can **credit their own deposit
and raise their own credit score**. This is the highest-severity wiring hazard available to a
new frontend: the endpoint is discoverable in the `/api` payload and looks like a legitimate
"verify my deposit" button.

`POST /api/wallet/demo/adjust` is likewise ungated and applies an arbitrary `delta` to
`demoBalance`.

---

## 12. Withdrawals are never executed — and two competing endpoints exist

Source comment at `server.mjs:2276`:

> `// Withdrawal requests become support tickets — the website never executes payouts.`

| | `POST /api/withdraw/submit` | `POST /api/withdrawal/support` |
|---|---|---|
| Auth | **none** | `requireAuth` |
| Body | `{ email, amount, destination }` | `{ currency, amount?, note? }` |
| Debits balance | **Yes**, immediately | **No** |
| Currencies | **INR only** (hardcoded `currency:'INR'`) | INR **and** USDT |
| Result | `pending` transaction | **201** + `Withdrawal` support ticket |
| Validates destination | No | n/a |
| Executes payout | **No** | **No** |

`/api/withdraw/submit` also produces the clearest user-facing rule in the codebase:

```js
error: `Insufficient available balance. Available: ₹${...}. Note: Frozen funds
        (₹${user.wallet.frozenBalance}) cannot be withdrawn until released.`
```

A frontend must pick one path deliberately and must not present either as an automated
bank/crypto payout.

---

## 13. Notifications have no read/unread state

```js
// server.mjs:2350
res.json({ success: true, notifications: items.slice(0, 10), unread: 0 });
```

`unread` is **hardcoded to 0**. The route is commented *"notifications (derived from the
student's own backend data)"* — items are computed per request from orders/wallet/tickets,
**capped at 10**, not persisted, and there is **no mutation endpoint**. Any "mark as read"
feature or badge bound to `unread` would be inert or always wrong.

---

## 14. Support tickets cannot be replied to or transitioned

`POST /api/support/tickets` validates `category` against a server allowlist (**422** otherwise)
and creates:

```js
{ id: `TCK-${Date.now().toString(36).toUpperCase()}`, category, subject, message,
  status: 'open', createdAt, updatedAt, response: null, request: null }
// → 201
```

`GET` returns `{ success, tickets, categories }`. **No endpoint ever writes `response` or
changes `status`** — no admin route touches `supportTickets`. Tickets are permanently
`open` with a `null` response. A reply thread or status changer would be pure fiction.

---

## 15. No positions API, no logout endpoint, and a path trap

- **Positions:** `grep -rn "positions"` across `server.mjs` and `trading-worker/src/index.ts`
  returns **nothing**. Positions must be derived from `GET /api/orders/list`
  (`status === 'open'`) and/or `GET /api/wallet/frozen` (`category === 'order'`).
- **Cancellation:** no dedicated endpoint. `POST /api/wallet/frozen/release` `{email, id: orderId}`
  is the user-facing cancel — it detects `category === 'order'`, sets the order to
  `status:'cancelled'`, `settledBy:'user-release'`, `payout = amount`, and refunds.
  (`/api/admin/orders/control` with `action:'cancel'` is admin-only.)
- **Logout:** no endpoint exists. Logout is client-side only.
- **Path trap:** klines is **`/api/market/klines`** (singular `market`), while detail routes are
  **`/api/markets/:symbol`** (plural). Easy to get wrong.

---

## 16. Dev/proxy configuration (verified)

`vite.config.ts` proxies `/api`, `/a`, `/s`, `/verify` to
`process.env.BACKEND_ORIGIN || process.env.VITE_API_URL || 'http://localhost:8080'`, with
`host: '0.0.0.0'`, `strictPort: true`, `port: 5173`, and `allowedHosts: true` on both
`server` and `preview`. So the same-origin assumption holds in dev, and the config already
permits arbitrary preview hostnames.

Build output is already chunk-split: `vendor-router`, `vendor-react`, per-route lazy chunks
(`React.lazy` in `App.tsx`), with the jsPDF stack isolated in a dynamic `pdf-utils` chunk.

⚠ The `/a` and `/s` proxies exist **only** for the V2 access-link contract (§9/F16). Once the
compat layer is dropped, both proxy entries are dead config.

---

## Summary of corrections to the proposed plan

| # | Proposed | Verified reality |
|---|---|---|
| 2 | Add `/api/staking/unstake` | **Does not exist.** Use `POST /api/wallet/frozen/release` `{email,id}` |
| 2 | "Earn/Savings area" | INR-only, no accrual, client-supplied APY. Present honestly |
| 3 | "deposit approval/status" | 🔴 `/api/wallet/deposit/approve` is **ungated self-credit** — exclude from UI |
| 3 | "withdrawal" | **Never executed.** Two competing endpoints; prefer `/api/withdrawal/support` |
| 6 | "ticket status/replies" | **No reply endpoint, no status transitions.** `response` stays `null` forever |
| 7 | "unread/read" notifications | **`unread` hardcoded to 0**; derived, capped at 10, no mutation endpoint |
| — | "Positions" as a product area | **No positions API.** Derive from `/api/orders/list` + `/api/wallet/frozen` |
| — | "cancellation" | No cancel endpoint; cancellation **is** `/api/wallet/frozen/release` |
| 14 | "Served by the existing Worker?" | Worker lacks **21** routes incl. all student-desk areas. Use Node/Docker |
| 15 | "Don't assume D1" | Correct — **no D1.** Node = JSON file; Worker = memory (+optional KV) |
| 9 | "Admin must be separated" | Confirmed — admin ships inside the user SPA bundle; secret is a shared code |
| 10 | "Invitation code first-class" | Confirmed — server enforces it; current SPA has no `/register` route |
| 13 | "Don't inherit `earn/v2/unknown`" | Confirmed — no route in this repo emits the V2 envelope |
| — | *(not in proposal)* | **Trading/wallet/deposit/withdraw/staking routes are not token-gated** |
| — | *(not in proposal)* | **No logout endpoint** — logout must be client-side |
| — | *(not in proposal)* | Settlement is **lazy/on-read**: status advances only when you re-fetch |
| — | *(not in proposal)* | "Flight Lab" branding is emitted **server-side**; cannot be fixed in frontend |
