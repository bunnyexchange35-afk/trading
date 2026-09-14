MASTER COMMAND — FRESH MUDREXX EARN FRONTEND
NEW BRANCH + FULL EXISTING BACKEND INTEGRATION
**REV 2 — CORRECTED AGAINST VERIFIED BACKEND SOURCE**

> Rev 2 note: every `⚠ VERIFIED` block below was read out of `server.mjs` and
> `trading-worker/src/index.ts` at commit `6761b66`. They override any
> conflicting instruction in the original Rev 1 text, and they override the
> repo's own markdown docs. Evidence: `BACKEND_CONTRACT_AUDIT.md`.
>
> Several Rev 1 phases asked for features **the backend does not have**
> (`/api/staking/unstake`, a positions API, notification read/unread, support
> replies, D1). Those have been corrected rather than deleted, so the agent
> knows what to build instead.

You are a senior frontend architect, product designer, UI/UX engineer, TypeScript engineer,
API integration engineer, and deployment engineer.

PROJECT: MUDREXX EARN
TAGLINE: "A Way to Earn in Real Life"

OBJECTIVE:

Build a completely FRESH, ORIGINAL, PRODUCTION-READY frontend from scratch for Mudrexx Earn.

This is NOT a redesign of the old frontend.

The reference project is available for backend/API/feature inspection, but the new frontend must
have a new UI architecture, new visual system, new layouts, and clean frontend code.

The existing backend is the source of truth.

DO NOT rebuild the backend.
DO NOT create a second trading engine.
DO NOT create a second wallet engine.
DO NOT create a second settlement engine.
DO NOT create fake financial/trading data.

==================================================
PHASE 0.5 — HARD FACTS (READ FIRST, DO NOT RE-DERIVE)
==================================================

These are already verified. Do not spend effort rediscovering them, and do not
contradict them. If your own inspection disagrees, STOP and report the conflict.

**F1 — TWO BACKENDS, DIFFERENT SURFACES.**
`server.mjs` (Express/Node, Docker) = **51 routes, the canonical superset**.
`trading-worker` (Cloudflare) = **32 routes**.
**21 Node routes have no Worker handler** — and they are exactly the student-desk
areas: `/api/tasks`, `/api/credit-score`, `/api/credit-score/history`,
`/api/user/account`, `/api/notifications`, `/api/support/tickets`,
`/api/withdrawal/support`, `/api/documents`, `/api/account/{statement,proof,agreement,invoice}`,
`/api/nova/{status,chat}`, `/api/markets/:symbol{,/ohlcv,/analysis}`,
`/api/order/{config,assets,currencies,durations}`.
⇒ **Deploying the full frontend to the Worker silently breaks 9 product areas.**

**F2 — NO D1. ANYWHERE.**
Node persists an in-memory Map to **`server/data/users.json`** (debounced 350 ms,
atomic tmp+rename, `DATA_DIR` override, `VOLUME /app/server/data` in Dockerfile).
Worker is **in-memory only**, with an *optional* KV namespace `STORE`
(commented out in `wrangler.jsonc`; accounts reset on each deploy without it).
`database/migrations/001_add_account_documents.sql` is **wired to nothing**.
⇒ Rev 1 Phase 2 is answered: **JSON-on-disk (Node) is authoritative.** Do not assume D1.

**F3 — `POST /api/staking/unstake` DOES NOT EXIST.**
It appears once in the whole repo, as a *string* in the `/api` discovery payload
(`server.mjs:434`). There is no handler.
⇒ **The real unstake is `POST /api/wallet/frozen/release` `{ email, id }`**, where
`id` is the `vaultId` returned by `/api/staking/stake`.

**F4 — STAKING IS INR-ONLY, COSMETIC ASSET, NO ACCRUAL.**
`/api/staking/stake` debits `wallet.realBalance` (INR) and pushes a `frozenItems`
entry `{ category:'staking', currency:'INR', status:'accruing', canRelease:true }`.
`asset` only labels the vault title. `apy` is **client-supplied and never validated**
against the server's `apyLocked` table. **No yield engine credits anything** — releasing
returns exactly the principal. You cannot stake USDT.

**F5 — NO POSITIONS API.**
`grep positions` across both backends returns nothing. Positions are a **derived view**
of `GET /api/orders/list` (`status === 'open'`) and/or `GET /api/wallet/frozen`
(`category === 'order'`).

**F6 — NOTIFICATIONS HAVE NO READ/UNREAD.**
`GET /api/notifications` returns `{ success, notifications, unread: 0 }` — **`unread` is
hardcoded to 0**. Items are derived on the fly from the user's own data, **capped at 10**,
not persisted, and there is **no mutation endpoint**.

**F7 — SUPPORT TICKETS HAVE NO REPLIES AND NO STATUS TRANSITIONS.**
`POST /api/support/tickets` creates `{ status:'open', response:null, request:null }`.
**Nothing ever writes `response` or changes `status`.** There is no reply endpoint.
`GET` returns `{ tickets, categories }` — `categories` is a server-supplied allowlist;
an invalid category is rejected with **422**.

**F8 — WITHDRAWALS ARE NEVER EXECUTED. TWO COMPETING PATHS EXIST.**
Source comment, `server.mjs:2276`: *"Withdrawal requests become support tickets — the
website never executes payouts."*
- `POST /api/withdraw/submit` `{email, amount, destination}` — **not auth-gated**, debits
  `realBalance`, writes a `pending` transaction, **INR hardcoded**, no destination
  validation, no payout execution.
- `POST /api/withdrawal/support` `{currency, amount?, note?}` — **auth-gated**, does **not**
  debit, creates a `Withdrawal` support ticket, supports INR **and** USDT.
⇒ **DECISION REQUIRED — see STOP CONDITIONS.**

**F9 — DEPOSITS BOOK A FROZEN ENTRY. THERE IS NO PAYMENT RAIL.**
`POST /api/deposit/submit` `{email, amount, rail='inr', method='upi', reference=''}`
creates `frozenItems` entry `{ category:'deposit', status:'processing', canApprove:true,
canRelease:true, reason: reference || 'Verification in progress (Sandbox)' }` and adds to
frozen balance. **No gateway, no UPI collect, no wallet address, and the backend supplies
NO payment instructions whatsoever.**

**F10 — 🔴 `POST /api/wallet/deposit/approve` HAS NO STAFF-ROLE CHECK.**
It *is* token-gated (see F11), but it never verifies the caller is staff — so an account approves
its **own** pending deposit. Verified live with the owner's own token:
`realBalance ₹100 → ₹100,100`, `depositCredited ₹0 → ₹100,000`, **credit score 420 → 480**
(`depositCreditedTotal` is a scoring input).
It is listed in the public `GET /api` discovery payload and looks exactly like a legitimate
"verify my deposit" button.
⇒ **NEVER wire this into any user-facing surface.** See Phase 30.

**F11 — AUTH: money routes ARE gated; the real hole is LOGIN.**
> *Corrected.* An earlier revision claimed money routes were ungated. That was wrong — it missed
> a **prefix-level mount**. Verified live: 401 without a token, 403 cross-account.

`server.mjs:681`:
```js
app.use(['/api/wallet','/api/orders','/api/deposit','/api/withdraw',
         '/api/staking','/api/user','/api/account'], requireAuth);
```
So **every** wallet/order/deposit/withdraw/staking/user/account route requires a bearer token —
including `deposit/approve`, `demo/adjust` and `/api/account/*`, which carry no per-route
middleware. Ten more routes add `requireAuth` individually (tasks, credit-score{,/history},
user/account, support/tickets GET+POST, withdrawal/support, notifications, documents, nova/chat).
`requireAuth` accepts `Authorization: Bearer`, `x-auth-token` or `?token=`, defaults `email` to
the token owner, and **refuses another account's email with 403**.
Public by design: health, `/api`, verify, markets, klines, `markets/:symbol*`, `order/*`,
`nova/status`, `auth/{register,login,me}`.

🔴 **THE REAL GAP — `POST /api/auth/login` verifies no password and creates accounts:**
```js
const user = getOrCreateUser(normalized, name);   // creates if absent
res.json({ success:true, message:'Welcome back', user, token: issueToken(user) });
```
Verified live:
```
POST /api/auth/register { email }           → 403 "Registration is by invitation only…"
POST /api/auth/login    { email } (no pwd)  → 200 + token, account CREATED, 10,000 demo credits
```
⇒ **This defeats the invitation-only registration gate (F15).** The gate is correctly enforced on
`/register`; `/login` is an unauthenticated account-creation + session-issuing endpoint for any
email string. **Highest-severity finding.**
⇒ Frontend consequences: (1) do **not** render a password field — it would be fake
authentication; (2) attach `Authorization: Bearer <token>` to every request anyway; (3) resolve
`email` from the session, never from a caller; (4) **report the login gap loudly.**

⚠ Also: `issueToken` **overwrites** `user.auth.token`, so each login **rotates** the token and
kills the previous session (one active session per account). And `/api/wallet/demo/adjust` takes
an arbitrary `delta` with no role check, though only against demo credits.

**F12 — ADMIN IS A SHARED-SECRET SURFACE CURRENTLY SHIPPED IN THE USER BUNDLE.**
Admin auth is a **code**, not a token: `?code=` / `{ code }`, from `ADMIN_CODES` /
`SUPER_ADMIN_CODES` env vars with **hardcoded defaults in source** (`MUDREXX-ADMIN`,
`ADMIN-2024`, `ADMIN777`, `MEDRIX888`, `ADMIN`; super: `MUDREXX-SUPER`, `SUPER-2024`).
`src/App.tsx` mounts `/admin/users` **in the same router and bundle** as the user app.

**F13 — SERVER-AUTHORITATIVE LOGIC. NEVER REIMPLEMENT.**
`server.mjs:1859`: *"server-side credit score & user category (the frontend never
computes these)"*. Credit score: base 420 + activity + win-rate + tasks + account age +
deposit tier, clamped **300–900**; bands ≥800 excellent / ≥700 good / ≥600 fair / else poor.
Order settlement is **lazy, on read** — `autoSettleOrders(user)` closes expired open orders
against live price, `settledBy:'market'`.

**F14 — ORDER CONTRACT.**
`POST /api/orders/create` `{email, symbol='BTC', side:'up'|'down', amount, currency:'INR'|'USDT',
accountType:'real'|'demo', durationSeconds, payoutPercent}`.
`durationSeconds` clamped **5–86400** (default 60). `payoutPercent` clamped **1–500**
(default 5). Real orders verify available balance per currency and move funds to frozen;
demo orders do not. Order id `ord-${Date.now()}`; stores `entryPrice`, `expiresAt`.
Desk config is **served, not hardcoded**: `GET /api/order/config` (+ `/assets`,
`/currencies`, `/durations`).

**F15 — REGISTRATION REQUIRES AN INVITATION CODE (ENFORCED SERVER-SIDE).**
`POST /api/auth/register` `{name, email, phone?, preferredCurrency?, inviteCode}`.
Missing/invalid code ⇒ **403** `"Registration is by invitation only. Enter the code
assigned to you."` New accounts start at **₹0.00** real balance. Success returns
`{ success, message, user, token }` — **a bearer token, same as login ⇒ register auto-signs-in.**
Current SPA has **no `/register` route**; sign-up is folded into the login screen.

**F16 — DROP THE `earn | v2 | unknown` COMPAT LAYER.**
`src/api.ts` carries `BackendContract`, `interpretAuthBody`, `mapBackendUser`,
`isAccessRequired`, `followLink`, and `/a/:code` + `/s/:code` routes for a *third-party*
"V2 mudrexx-control" backend. **No route in this repo returns `ACCESS_REQUIRED` or an
`{ ok, type }` envelope.** It is dead compatibility debt. Keep `API_BASE =
import.meta.env.VITE_API_URL ?? ''` (same-origin default).

**F17 — `src/types.ts` IS WORTH KEEPING.**
It already encodes the verified shapes: `FrozenFundCategory` (`order|deposit|staking|withdrawal`),
`FrozenFundItem`, `WalletTransaction`, `UserWallet`, `User`, `CreditSnapshot`,
`CreditHistoryPoint`, `StudentTask`, `TasksSummary`, `SupportTicket`, `StudentNotification`,
`OrderDeskConfig`, `MarketAnalysis`, `MarketDetail`, `DocumentCatalogItem`, `NovaStatus`,
`AuthProfile`, `Session`, `TradeOrder`. **Reuse the type layer; rebuild the UI.**

**F18 — NO E2E SUITE EXISTS.**
`npm test` = `tsc --noEmit && node --test test/api.test.mjs`. That is the whole test story.
⇒ Do not claim to have run E2E tests. Do not invent an E2E framework unless asked.

**F19 — KNOWN BACKEND BRANDING LEAK.**
`/api/wallet/demo/adjust` writes transaction titles **"Flight Lab Wager"** /
**"Flight Lab Cash Out"** — legacy branding generated *server-side*. The frontend cannot
rename it without modifying the backend. **Report it; do not fix it.**

==================================================
PHASE 0 — GIT SAFETY
==================================================

Before changing anything:

1. `git status`
2. `git branch --show-current`
3. `git log --oneline -10`
4. Create a NEW dedicated branch: `frontend/mudrexx-earn-fresh`
   (if it exists, pick a unique suffix).

⚠ VERIFIED — **ARENA SESSIONS PIN THE BRANCH.** If this command runs inside an Arena
agent session, the session is bound to a fixed branch (e.g. `arena/xxxx-trading`).
**Use the session branch; do not create or push any other branch.** State which one you
used in the final report. Otherwise, use `frontend/mudrexx-earn-fresh`.

DO NOT work directly on main.
DO NOT merge into main.
DO NOT push until all verification is complete.

==================================================
PHASE 1 — INSPECT THE ENTIRE PROJECT
==================================================

Phase 0.5 already did the contract work. **Verify F1–F19 still hold**, then go deeper on
the parts not yet mapped:

- `package.json` scripts (`dev` runs `server.mjs` + `vite` concurrently via `concurrently`)
- `vite.config.ts` — **confirm the dev proxy target for `/api`**
- `src/app-context.tsx`, `src/market-context.tsx` — existing state/data flow
- `src/data.ts`, `src/perf.ts`, `src/pdf-utils.ts`
- `src/InstantOrder.tsx`, `src/Market.tsx`, `src/AccountPages.tsx`, `src/Deposit.tsx`,
  `src/OrdersPage.tsx`, `src/TasksPage.tsx`, `src/NovaChat.tsx`, `src/AdminUsersPage.tsx`
- `test/api.test.mjs` — what contract is already asserted
- `api.json`, `API.md`, `DEPLOYMENT.md`, `ADMIN-CONTROL.md`, `ACCOUNT_DOCUMENTS_*.md`
  — **treat all of these as UNRELIABLE. F3 exists precisely because the docs advertise an
  endpoint that was never implemented.**

Produce an internal integration map before coding.

==================================================
PHASE 2 — CANONICAL BACKEND (ALREADY DETERMINED)
==================================================

Answers, from F1/F2:

1. **Canonical backend = `server.mjs`** (Node/Express, Docker, port 8080). The Worker is a
   reduced-contract alternative that cannot serve the full product.
2. **Production API base = same-origin** (`API_BASE = ''`).
3. **Same-origin: yes** — `server.mjs` serves `dist/` via `express.static` + `GET *`
   SPA fallback; `wrangler.jsonc` likewise sets `assets.directory = "../dist"`.
4. **Worker serves frontend assets: yes**, but see F1.
5. **Separate frontend deployment: not required** for Node; required only if you split admin.
6. **Auth: bearer token** (`mx_<48 hex>`) from login/register, accepted as
   `Authorization: Bearer`, `x-auth-token`, or `?token=`. Plus F11's caveat.
7. **Persistence: `server/data/users.json`.**
8. **No D1, no KV in use.**

DO NOT modify persistence architecture as part of this frontend task.

⚠ **HARD GATE — DEPLOYMENT TARGET.** If you deploy to the Worker anyway, you MUST either
(a) implement the 21 missing routes in the Worker — **which violates "do not rebuild the
backend"**, or (b) **feature-flag off every Node-only area** and say so loudly in the
report. Silently shipping broken Tasks / Credit / Notifications / Support / Documents /
NOVA / market-analysis pages is a **failure condition**.

==================================================
PHASE 3 — BACKEND API CONTRACT (VERIFIED TABLE)
==================================================

Use **exactly** these paths. Where Rev 1 named a capability that does not exist, the
correction is inline.

AUTH
- `POST /api/auth/register` `{name,email,phone?,preferredCurrency?,inviteCode}` → `{user,token}` — **inviteCode mandatory (F15)**
- `POST /api/auth/login` → bearer token
- `GET  /api/auth/me`
- `PUT  /api/user/profile`
- `GET  /api/user/account` *(auth)* — dashboard snapshot
- ⚠ **No logout endpoint exists.** Logout is **client-side only**: drop the token + state.

MARKETS
- `GET /api/markets`
- `GET /api/market/klines?symbol=BTC&interval=1m` — **note singular `/market/`**
- `GET /api/markets/:symbol`, `/api/markets/:symbol/ohlcv`, `/api/markets/:symbol/analysis`
  — **Node only (F1)**

TRADING
- `GET  /api/order/config` (+ `/assets`, `/currencies`, `/durations`) — **Node only; drive the desk from this (F14)**
- `POST /api/orders/create`
- `GET  /api/orders/list?email=`
- `GET  /api/orders/status?orderId=&email=`
- ⚠ **No dedicated cancel endpoint.** User-facing cancellation =
  `POST /api/wallet/frozen/release` `{email, id: orderId}` — the handler finds the matching
  `frozenItems` entry, and if `category === 'order'` sets that order to
  `status:'cancelled'`, `settledBy:'user-release'`, `payout = amount`, then refunds.
  (`/api/admin/orders/control` with `action:'cancel'` is **admin-only**.)
- ⚠ **Settlement is lazy/on-read (F13).** Status changes when you *fetch*, not on a timer.

WALLET
- `GET  /api/wallet/summary?email=`, `/api/wallet/transactions?email=`, `/api/wallet/frozen?email=`
- `POST /api/wallet/frozen/release` `{email,id}` — **the universal release/unstake/cancel**
- `POST /api/wallet/convert-demo`, `/claim-demo`, `/link-demo`, `/demo/adjust` — demo-credit mechanics
- 🔴 `POST /api/wallet/deposit/approve` — **F10: FORBIDDEN in user UI**

POSITIONS
- ⚠ **F5: no API.** Derive from `/api/orders/list` (`open`) + `/api/wallet/frozen`.
  Label it clearly as a derived view. Do **not** fabricate position state, PnL, or
  liquidation levels the backend does not return.

STAKING / EARN
- `POST /api/staking/stake` `{email,asset,amount,apy}` → `{vaultId,newAvailable,newFrozen}`
- ⚠ **F3: unstake = `POST /api/wallet/frozen/release` `{email, id: vaultId}`**
- ⚠ **F4: INR-only, no term, no accrual, client-supplied APY.**

TASKS — `GET /api/tasks` *(auth)* — **Node only**

CREDIT SCORE — `GET /api/credit-score`, `GET /api/credit-score/history` *(auth)* — **Node only**

NOTIFICATIONS — `GET /api/notifications` *(auth)* — **Node only. F6: no read/unread.**

SUPPORT
- `GET  /api/support/tickets` *(auth)* → `{tickets, categories}`
- `POST /api/support/tickets` *(auth)* `{category,subject,message}` → **201**
- `POST /api/withdrawal/support` *(auth)* `{currency,amount?,note?}` → **201**
- ⚠ **F7: no replies, no status transitions.**

DOCUMENTS
- `GET /api/documents` *(auth)* — catalog — **Node only**
- `GET /api/account/statement?email=`, `/proof?email=`, `/agreement?email=`, `/invoice` — **Node only**

NOVA
- `GET  /api/nova/status` → `{nova:{online,assistant,model,grounded,topics,at}}`
  (`model` is `'gemini'` if `GEMINI_API_KEY` else `'nova-rulepack'`)
- `POST /api/nova/chat` *(auth)* `{message}` → **422** on empty message
- ⚠ **NOVA is rule-based unless a server-side Gemini key exists. It is not a general LLM.
  Never market it as one.**

ADMIN — **F12. Code-gated, separate app.**
`GET /api/admin/role`, `/users`, `/invited-users`, `/orders`, `/orders/all`;
`POST /api/admin/orders/control`, `/orders/update`, `/wallet/adjust` *(super only)*.

MISC — `GET /api/health`, `GET /api` (discovery — **unreliable, see F3**),
`GET /verify` + `/api/verify`.

**If an endpoint does not exist, DO NOT invent it. Report it as a gap.**

==================================================
PHASE 4 — FRESH FRONTEND ARCHITECTURE
==================================================

React + TypeScript + Vite + `react-router-dom` v7 (already the stack — keep it).

```
src/
  app/           # router, providers, guards, route tree
  layouts/       # UserShell, AuthShell, PublicShell, (AdminShell — separate build)
  components/    # design-system primitives only
  features/
    auth/ dashboard/ markets/ trading/ wallet/ orders/ positions/
    earn/ tasks/ credit/ notifications/ support/ documents/ nova/ account/
  api/           # ONE canonical client (Phase 28)
  hooks/
  types/         # port from src/types.ts (F17)
  utils/
  styles/
```

Adapt to the actual repository. Do not create unnecessary abstraction.

==================================================
PHASE 5 — ORIGINAL DESIGN SYSTEM
==================================================

New Mudrexx Earn visual identity. Brand: **MUDREXX EARN**. Tagline: **"A Way to Earn in Real Life"**.

Premium, modern, clean, distinctive, trustworthy, fast, responsive, accessible, excellent
typography, strong hierarchy, polished interactions.

Build tokens + components for: typography, spacing, cards, buttons, inputs, tables, badges,
tabs, navigation, modals, drawers, alerts, charts, empty states, skeletons, errors, success.

⚠ Add to that list, because this product needs them specifically:
- **currency formatting** — INR `₹` with `en-IN` grouping; USDT `₮` (matches backend output)
- **status pill vocabulary** — orders: `open|won|lost|cancelled`; frozen: `processing|accruing`;
  transactions: `pending|completed`; tickets: `open`
- **a "sandbox / not-executed" disclosure style** — needed for F8/F9 honesty

Do not copy the old frontend. Do not merely reskin existing components.

==================================================
PHASE 6 — APPLICATION SHELL
==================================================

Desktop: top nav, primary product nav, account area, notifications, wallet summary, NOVA access.
Mobile: compact top bar, responsive nav, bottom nav or drawer.

Core areas: Dashboard · Markets · Trade · Orders · Positions · Wallet · Earn · Tasks · Credit · Support.
Secondary (reachable, not cluttering): Notifications · Documents · Account · Settings · NOVA.

⚠ **Notification bell badge:** F6 says `unread` is always 0. **Do not render a badge off
`unread`.** Either omit the badge, or derive an unread indicator **client-side** from items
the user hasn't seen this session — and label it as session-local, never as server state.

⚠ **Wallet summary in the shell** is token-gated (F11) and `requireAuth` defaults `email` to the
token owner. Render it only for an authenticated session and never pass an email the user did not
sign in with — a mismatched email is refused with 403.

==================================================
PHASE 7 — LANDING PAGE
==================================================

Branding, tagline, hero, product explanation, market/trading overview, wallet overview,
earning overview, platform features, security/account info, clear CTA, responsive footer.

DO NOT CLAIM: guaranteed profit, guaranteed returns, risk-free earnings, false real-money
execution, unsupported regulatory status, unsupported financial guarantees.

⚠ **F8/F9 make this concrete.** The landing page MUST NOT imply that deposits are collected
by a payment gateway or that withdrawals are paid out automatically. Neither is true:
deposits book a pending frozen entry with no rail; withdrawals become support tickets.
Also do not describe staking APY as earned yield (F4) or NOVA as a general AI (Phase 3).

==================================================
PHASE 8 — AUTHENTICATION
==================================================

Routes: `/auth/login`, `/auth/register`.

⚠ **F15 — invitation code is a FIRST-CLASS registration field**, not an optional extra:
required, validated, with the backend's 403 message surfaced verbatim. Explain that codes
are institute-assigned and are never issued by the app.

⚠ **F15 — register returns a token.** Auto-sign-in after successful registration; do not
bounce the user to the login screen.

Implement: login, registration, invitation code, session persistence (`localStorage` key —
reuse `mudrexx-session` or define one new key, not both), authenticated requests, logout
(**client-side only — no endpoint exists**), session expiry, 401/403 handling, protected routes.

⚠ **F11 — attach `Authorization: Bearer <token>` to EVERY request.** The money routes are
gated, so this is mandatory, not defensive. Never send another user's email; always resolve
identity from the session (the backend refuses a mismatch with 403).

⚠ **F11 — do NOT render a password field on sign-in.** The backend checks no credential, so a
password box would be fake authentication. Ask for the email, disclose the gap in the UI, and
report it.

Do not create fake authentication. Do not expose credentials.

==================================================
PHASE 9 — DASHBOARD
==================================================

Primary source: `GET /api/user/account` *(auth, Node-only)*, supplemented by
`/api/wallet/summary`, `/api/orders/list`, `/api/credit-score`, `/api/tasks`,
`/api/notifications`.

Show: available balance, locked/frozen balance, wallet status, active orders, recent orders,
positions (derived — F5), markets, recent transactions, staking info, tasks, credit score,
notifications.

Only display fields the backend actually supplies. Never hardcode account values.

⚠ **Graceful degradation:** every one of those Node-only endpoints 404s on the Worker (F1).
The dashboard must render the wallet/orders core and **collapse the unavailable panels
honestly** rather than showing spinners forever or inventing data.

==================================================
PHASE 10 — MARKETS
==================================================

`/markets` — list from `GET /api/markets`: search, symbol, price data, market stats, status,
navigation to detail. Filters only if the backend supports them.

Do not invent symbols or prices.

==================================================
PHASE 11 — MARKET DETAIL
==================================================

`/markets/:symbol` — header, current data, chart from `GET /api/market/klines?symbol=&interval=`
(**singular `/market/`**), timeframe controls per supported intervals, market statistics,
**analysis panel from `GET /api/markets/:symbol/analysis`**, trade CTA.

Do not generate fake chart data. If data is unavailable: honest empty/error state.

⚠ Rev 1 item 12 asked for a "proper analysis panel rather than only a chart" — correct, and
`/api/markets/:symbol/analysis` exists. **Node only (F1).** Feature-flag it on the Worker.

==================================================
PHASE 12 — TRADING TERMINAL
==================================================

Build a completely new trading interface.

**Do NOT reuse the old `InstantOrder.tsx` design. Do NOT rename, re-skin, wrap, or port it.**
You may read it to learn business rules; you may not carry its UI, layout, markup, class
names, or component structure forward. **Rebuild from scratch, reusing only the verified
backend contract (F14) and the server's business rules.**

Desktop:
```
MARKET HEADER
CHART                    | ORDER PANEL
                         |  Amount · Currency · Duration · Direction
                         |  Validation · Place Order
ACTIVE ORDERS | POSITIONS | HISTORY
```
Mobile: Market → Chart → Order controls → Active orders → History.

⚠ **F14 — drive everything from `GET /api/order/config`**: enabled assets, currencies,
durations, payout config, trading rules, min/max/precision **if provided**. Never hardcode
what the API provides. Fall back to the source-verified clamps
(duration **5–86400 s**, payout **1–500 %**) only if config is unavailable — and say so.

==================================================
PHASE 13 — REAL ORDER FLOW
==================================================

```
SELECT MARKET → LOAD REAL MARKET DATA → LOAD /api/order/config
→ ENTER PARAMETERS → CLIENT BASIC VALIDATION → POST /api/orders/create
→ BACKEND IS AUTHORITY → REAL ORDER RESPONSE → REFRESH WALLET → REFRESH ACTIVE ORDERS
→ BACKEND CONTROLS EXPIRY → BACKEND CONTROLS SETTLEMENT (lazy, on read — F13)
→ FRONTEND RE-FETCHES TO OBSERVE STATUS → WALLET/LEDGER REFRESH → HISTORY UPDATED
```

Frontend MUST NOT: settle orders, calculate authoritative payout, modify wallet balances,
bypass backend validation, manufacture order states.

A countdown is **display-only**. Backend status always wins.

⚠ **F13 is subtle and easy to get wrong:** settlement happens **when an order list is
fetched**, not on a background timer. So when a countdown hits zero the order is *not yet*
`won`/`lost` — you must **re-fetch `/api/orders/list` to trigger and observe settlement.**
Design the polling around that. Do not optimistically flip the state locally.

==================================================
PHASE 14 — ORDERS
==================================================

`/orders` — active, completed (`won`/`lost`), `cancelled`, history, filters, search, details,
cancellation.

⚠ **Cancellation = `POST /api/wallet/frozen/release` `{email, id: orderId}`** (see Phase 3).
It refunds to available balance and sets the order `cancelled`. Surface the refund.
Only offer it while the order is `open`.

Use real backend data. Do not fake pagination. Do not fake statuses.

==================================================
PHASE 15 — POSITIONS
==================================================

`/positions` — ⚠ **F5: there is no positions API.**

Build it as an explicit **derived view** over `GET /api/orders/list` (`status:'open'`) and
`GET /api/wallet/frozen` (`category:'order'`). Display only real fields
(`symbol, side, amount, currency, accountType, payoutPercent, durationSeconds, entryPrice,
expiresAt, createdAt`).

Do **not** compute authoritative position state, unrealised PnL, margin, or liquidation
client-side. If you show indicative PnL against the live price, **label it indicative and
non-authoritative.**

==================================================
PHASE 16 — WALLET
==================================================

`/wallet` — available, frozen/locked, total, per currency (**INR and USDT are separate
ledgers**: `realBalance`/`frozenBalance` vs `realUsdtBalance`/`frozenUsdtBalance`), wallet
status, transactions, deposits, withdrawals, frozen funds.

Frozen funds carry `category: order | deposit | staking | withdrawal` (F17) — group by it,
and expose **release** for items with `canRelease: true`.

Use the actual endpoints. Refresh wallet after any trading action. Never maintain a
separate authoritative balance.

🔴 **F10 — do NOT render any "approve deposit" control here.** See Phase 30.

==================================================
PHASE 17 — DEPOSITS
==================================================

⚠ **F9 — the backend provides NO payment instructions.** No UPI ID, no VPA, no USDT address,
no gateway, no QR. `/api/deposit/submit` only books a frozen entry marked
`"Verification in progress (Sandbox)"`.

Therefore:
- Build the form around the **real** fields: `amount`, `rail` (`inr` / other → USDT),
  `method`, `reference`.
- **NEVER fabricate payment instructions, addresses, or QR codes.** If you need to tell the
  user where to send money, state plainly that instructions are provided out-of-band by the
  institute/support — do not invent them.
- Show the resulting **frozen** entry, its `processing` status, and the transaction ledger row.
- **Clearly label deposits as pending manual verification.**
- 🔴 **No self-approve button. Ever (F10).**

==================================================
PHASE 18 — WITHDRAWALS
==================================================

⚠ **F8 — DECISION REQUIRED.** Two paths, different semantics. **Pick ONE deliberately,
implement it honestly, and record the decision in the final report:**

- **Recommended: `POST /api/withdrawal/support`** — auth-gated, does **not** debit, supports
  INR + USDT, creates a `Withdrawal` support ticket. Matches the source's stated intent
  (*"the website never executes payouts"*) and cannot lose user funds.
- **`POST /api/withdraw/submit`** — token-gated, debits `realBalance` immediately, **INR only**,
  no destination validation, **no payout execution**. If you use it, you MUST disclose that
  the balance is debited now and fulfilment is manual/off-platform.

Either way:
- **Never present a withdrawal as an automated bank/crypto payout.**
- Show amount, destination details the backend actually requires, validation, available
  balance (**frozen funds are not withdrawable** — the backend says so verbatim in its error),
  status, history, and the support escalation path.

Backend remains authoritative.

==================================================
PHASE 19 — EARN / STAKING
==================================================

`/earn` — built on **F3 + F4**:

- Stake: `POST /api/staking/stake` `{email, asset, amount, apy}` → returns `vaultId`.
- **Unstake: `POST /api/wallet/frozen/release` `{email, id: vaultId}`. Do NOT call
  `/api/staking/unstake` — it does not exist (F3).**
- Active vaults: read from `GET /api/wallet/frozen`, filter `category === 'staking'`.
- **INR only.** Do not offer USDT staking — the endpoint debits the INR balance and ignores
  `asset` except as a label (F4).
- **There is no term/duration and no accrual engine.** Do not show a maturity date, a lock
  period, an earned-yield counter, or a projected balance. Releasing returns exactly the
  principal.
- ⚠ `apy` is **client-supplied and unvalidated**. Do not let a user type an arbitrary APY.
  Populate the rate from the server's asset list / `GET /api/order/config` if it exposes one,
  otherwise use a **fixed, clearly-labelled indicative rate** and state that yields are not
  automatically credited. **Never imply the backend pays it.**

Do not promise returns. Do not calculate authoritative rewards in the browser.

==================================================
PHASE 20 — TASKS
==================================================

`/tasks` — `GET /api/tasks` *(auth, Node-only)*. Show available tasks, progress, completion
state, and rewards **only when supplied by the backend**.

⚠ Verify whether any task-completion **mutation** endpoint exists before building one.
If tasks are read-only, build a read-only view and report it — **do not invent a
"claim reward" button.** Do not fabricate rewards.

==================================================
PHASE 21 — CREDIT SCORE
==================================================

`/credit-score` — `GET /api/credit-score`, `GET /api/credit-score/history` *(auth, Node-only)*.

Show current score, status band, and history. Factors **only if the backend supplies them**.

⚠ **F13 — the score and its band are server-computed; the source explicitly forbids the
frontend from computing them.** Do not reimplement the 420-base formula, the 300–900 clamp,
or the band thresholds. Render what arrives.

==================================================
PHASE 22 — NOTIFICATIONS
==================================================

`GET /api/notifications` *(auth, Node-only)*. Show timestamps, message, and relevant
destination/action (order, wallet, support, task).

⚠ **F6 — there is NO read/unread support.** `unread` is **hardcoded to 0**, items are
derived per-request, **capped at 10**, and not persisted. So:
- **Do not build a mark-as-read feature** — no endpoint exists.
- **Do not bind a badge to `unread`** (always 0).
- If you want an unread affordance, keep it **session-local and clearly non-authoritative**,
  and note the 10-item cap in the UI so users don't assume a full history.

Do not generate fake financial notifications.

==================================================
PHASE 23 — SUPPORT
==================================================

`/support` — `GET` + `POST /api/support/tickets` *(auth, Node-only)*.

- **Use the server-supplied `categories` allowlist** from the GET response to populate the
  category picker; an invalid category returns **422**.
- Create: `{category, subject, message}` → **201**, ticket id `TCK-…`.
- ⚠ **F7 — no replies, no status transitions.** `response` stays `null` and `status` stays
  `'open'` forever. Build the detail view to render `response` **when present** and show an
  honest "awaiting support response" state otherwise. **Do not fake a reply thread, do not
  invent agent messages, do not offer a status changer.**
- Wire in `POST /api/withdrawal/support` as the withdrawal escalation path (Phase 18).

Make support usable on mobile.

==================================================
PHASE 24 — DOCUMENTS
==================================================

`/documents` — `GET /api/documents` catalog *(auth)* plus `/api/account/statement`,
`/api/account/proof`, `/api/account/agreement`, `/api/account/invoice` — **all Node-only (F1)**.

Use the backend document/PDF endpoints. `src/pdf-utils.ts` (`jspdf` + `jspdf-autotable`) is
available if the backend returns data rather than a rendered file — **check which**.

Do not generate fake account documents. Do not put unsupported financial claims into
documents — **especially not claims that deposits were collected or withdrawals paid (F8/F9).**

==================================================
PHASE 25 — NOVA
==================================================

`GET /api/nova/status`, `POST /api/nova/chat` *(auth, Node-only)*.

⚠ **NOVA is a rule-pack unless the server has `GEMINI_API_KEY`** — `/api/nova/status` tells
you which via `model: 'gemini' | 'nova-rulepack'`, plus a `topics` allowlist. **Read the
status and constrain the UI to the advertised topics.** Do not present NOVA as a general LLM,
and do not let users believe it can execute trades.

Empty message ⇒ **422**. Render `sources` if the response includes them.

NOVA must not bypass backend authorization, and must not manipulate authoritative trading
state — it has no such endpoint.

==================================================
PHASE 26 — ACCOUNT + SETTINGS
==================================================

`/account`, `/settings` — `GET /api/user/account` *(auth)*, `GET /api/auth/me`,
`PUT /api/user/profile`.

⚠ **Inspect `PUT /api/user/profile` to learn exactly which fields it accepts** and build the
form from that list. Do not offer fields it ignores.

Include only supported functionality: profile, account status, preferences, session/logout
(**client-side — no logout endpoint**), relevant account metadata.

==================================================
PHASE 27 — ADMIN SEPARATION
==================================================

⚠ **F12 — this is a real, confirmed defect.** `/admin/users` currently ships **inside the
user SPA bundle**, so every visitor downloads the admin UI and its code-entry flow. Admin
auth is a **shared secret code**, not a token.

Requirements:
- **Separate the admin app from the user app at BUILD level, not route level.** A separate
  entry/bundle (or a separate build target) so admin code and admin API calls are **not
  present in the user bundle at all**. A guarded route inside the same bundle **does not
  satisfy this.**
- No admin link, no admin route, no admin API method, and no admin code input anywhere in
  the user app.
- Admin access must be enforced by backend authorization. **Never rely on frontend role
  checks alone.**
- Do not expose user management, `/api/admin/wallet/adjust`, `/api/admin/orders/control`
  (forced win/lose/cancel), or system configuration to ordinary users.
- 🔴 **Also keep `POST /api/wallet/deposit/approve` out of BOTH apps' user flows (F10).**
  If it belongs anywhere, it belongs behind the admin code — and even then, flag that the
  endpoint itself checks no staff role (F10).

==================================================
PHASE 28 — API CLIENT
==================================================

Build **ONE** canonical typed API client. Centralize: base URL, auth header injection,
request handling, JSON parsing, error normalisation, response types, retries where appropriate.

⚠ **F16 — do NOT port the `earn | v2 | unknown` machinery.** No `BackendContract`, no
`interpretAuthBody`, no `ACCESS_REQUIRED`, no `followLink`, no `/a/:code` or `/s/:code`
routes. **No backend in this repo emits that envelope.** Target the single verified
`{ success, ... } | { error }` contract from `server.mjs`.

Keep `API_BASE = import.meta.env.VITE_API_URL ?? ''` (same-origin).
Port the types from `src/types.ts` (F17).

Handle **identity** structurally: the client derives `email` from the session and **never accepts
an arbitrary email argument** for user-scoped calls, so a cross-account 403 cannot be provoked
from the UI.

Do not keep multiple competing API clients.

==================================================
PHASE 29 — DATA INTEGRITY
==================================================

Search the new frontend for: mock, dummy, fake, sample, demo, placeholder financial data,
hardcoded prices, hardcoded balances, hardcoded orders, fake chart data, fake users,
fake transactions. Remove fabricated account/trading state.

Allowed: skeleton loaders, clearly non-data empty-state examples, static marketing content.
Not allowed: fake financial/account state presented as real.

⚠ **Also forbidden, specifically (these are the Rev 2 additions):**
- a self-approve deposit control (F10)
- an unstake call to `/api/staking/unstake` (F3)
- staking yield accrual, maturity dates, or USDT staking (F4)
- a mark-as-read notification action (F6)
- a support reply composer or ticket status changer (F7)
- fabricated UPI IDs / USDT addresses / payment QR codes (F9)
- an automated-payout withdrawal narrative (F8)
- client-side credit-score computation (F13)
- client-side order settlement or authoritative payout maths (F13)
- a positions API call (F5)

==================================================
PHASE 30 — SECURITY
==================================================

Verify no secret is bundled: no API token, no Cloudflare secret, no D1/KV credentials, no
backend secret, no service-binding secret, no admin credential, no private env var in client code.

⚠ **VERIFIED ISSUES TO REPORT — DO NOT SILENTLY FIX (fixing means editing the backend):**

1. ✅→ **`POST /api/auth/login` checked no password and created accounts for any email** (F11),
   bypassing the invitation-only registration gate (F15). **FIXED** (security commit `4183c26`):
   login is now a lookup — unknown emails get 404. **Still open:** sign-in verifies no
   credential, so a known email opens that session.
2. ✅ **`POST /api/wallet/deposit/approve` had no staff-role check** (F10): a user self-approved
   their own pending deposit, inflating `realBalance`, `depositCreditedTotal` and their credit
   score (420 → 480 verified). **FIXED** (`4183c26`): approval now authenticates with an admin
   code, like `/api/admin/*`. The frontend still never calls it.
3. 🔴 **Hardcoded default `ADMIN_CODES` / `SUPER_ADMIN_CODES` in source and in
   `wrangler.jsonc` comments** (F12) — effectively published admin credentials. Report.
   **Now load-bearing** (`4183c26` gates deposit approval on these codes): any real deployment
   MUST override both env vars.
4. 🟠 **`POST /api/wallet/demo/adjust`** applies an arbitrary demo delta with no role check.
5. 🟠 **Client-supplied, unvalidated `apy` on `/api/staking/stake`** (F4).
6. 🟠 **Login rotates the token**, so a second sign-in silently kills the first session (F11).
7. 🟠 **Legacy "Flight Lab" branding emitted server-side** (F19) — cannot be fixed client-side.

✅ **Verified as SOUND — do not report these as gaps** (an earlier revision of this command got
them wrong): money routes **are** token-gated via the `app.use` prefix mount at `server.mjs:681`,
and cross-account access is correctly refused with **403**. The `requireAuth` email-ownership
check works.

The frontend is an untrusted client. The backend controls authorization, wallet, orders,
settlement, permissions, identity, and admin actions — **except where F10/F11 show it
currently does not. Say so plainly in the report.**

==================================================
PHASE 31 — RESPONSIVE UX
==================================================

Test desktop, laptop, tablet, mobile. Ensure: no horizontal overflow, charts resize, order
form usable, tables responsive, dialogs work, navigation works, wallet controls accessible,
touch targets usable, typography readable.

⚠ Note the dev environment binds `0.0.0.0` (`vite --host 0.0.0.0`, server listens on
`0.0.0.0`) and `vite.config.ts` proxies `/api` — **verify the proxy target matches the
backend port (default 8080)** so the same-origin assumption holds in dev.

==================================================
PHASE 32 — ACCESSIBILITY
==================================================

Semantic HTML, keyboard navigation, visible focus, accessible forms and labels, accessible
dialogs and tables, status announcements (`aria-live` for order settlement and wallet
updates), meaningful errors, sufficient contrast.

⚠ The trading terminal's up/down control and the countdown are the highest-risk a11y
surfaces: the countdown must be `aria-live="polite"` (not assertive, not per-second spam),
and direction must be conveyed by more than colour alone.

==================================================
PHASE 33 — PERFORMANCE
==================================================

Optimize route loading (lazy + `Suspense`), bundle size, chart rendering, API requests,
rerenders, polling, asset loading.

⚠ **Polling rule, derived from F13:** settlement only advances on a **read**, so you must
poll `/api/orders/list` while orders are open — but **stop polling entirely when there are
no open orders**, and back off on hidden tabs (`visibilitychange`). Do not poll wallet,
notifications, and orders on three independent timers. Do not use browser timers as
business logic.

==================================================
PHASE 34 — ERROR HANDLING
==================================================

Handle 400, 401, 403, 404, 409, 422, 429, 500, network errors, timeouts, malformed
responses, session expiry.

⚠ **Status codes this backend actually emits — map them to real copy:**
- **403** `"Registration is by invitation only…"` (F15) · **403** `"This session can only
  access its own account."` (requireAuth email mismatch) · **403** `"Invalid admin code"`
- **422** invalid support category (F7) · **422** empty NOVA message
- **409** withdrawal-support amount exceeds available balance (F8)
- **404** frozen item not found (release/unstake with a stale id)
- **400** insufficient balance — **surface the backend's own message**, which already states
  the available amount and (for withdrawals) that frozen funds cannot be withdrawn
- **401** `"Sign in required. Sign up with an invitation code, then sign in and send
  Authorization: Bearer <token>."`

⚠ **404 also means "you deployed to the Worker" (F1).** Distinguish a missing-resource 404
from a missing-**route** 404 and show a "not available on this deployment" state for the
latter rather than a generic failure.

Never turn an API failure into a success message. Never display stale financial information
without indication.

==================================================
PHASE 35 — PRODUCTION CONFIGURATION
==================================================

Inspect `wrangler.jsonc`, the Worker entry, assets, SPA fallback, API routing, env vars,
bindings, deployment config. Determine the correct production architecture **from F1/F2**.

⚠ **The answer is already known:**
- **Full product ⇒ `server.mjs` via Docker** (`npm run build` → `dist/`, served same-origin,
  `VOLUME /app/server/data` for the JSON store, healthcheck on `/api/health`, port 8080).
- **`npm run deploy` = `npm run build && wrangler deploy -c trading-worker/wrangler.jsonc`**
  publishes `dist/` to a Worker that **cannot serve 21 routes (F1)**.
- **Do not run `npm run deploy` as the production path for the full frontend.** If the Worker
  is required, apply the Phase 2 hard gate: feature-flag the Node-only areas off and report it.

Do NOT assume the old Hello World Worker deployment is correct.
Do NOT claim production is live without verifying it.

==================================================
PHASE 36 — TESTING
==================================================

Run: `npm install`, `npm run typecheck`, `npm test`, `npm run build`.

⚠ **F18 — `npm test` is `tsc --noEmit && node --test test/api.test.mjs`. There is no E2E
suite.** Do not claim E2E coverage. If you add tests, add them to `test/` in the existing
`node --test` style.

⚠ **Where feasible, test against a live `node server.mjs`** (it boots with no external
dependencies and creates `server/data/users.json` on first write) and exercise the real
contract end to end — including the **403 invitation-code rejection**, a stake→release
round trip via `/api/wallet/frozen/release`, and lazy order settlement on re-fetch.

Then verify in the running app:
Landing · Login · Registration · Invitation code (incl. the 403 path) · Dashboard · Markets ·
Market detail · Chart · Analysis panel · Trading · Order creation · Active order ·
Backend lifecycle · **Settlement observed via re-fetch** · Wallet update · Ledger ·
Order history · Cancellation-via-release · Positions (derived) · Deposit (frozen, no rail) ·
Withdrawal (ticket path) · Earn stake + **release** · Tasks · Credit score · Notifications ·
Support · Documents · NOVA · Account · Logout · Protected routes · Refresh persistence.

Do not mark functionality complete merely because the page renders.

==================================================
PHASE 37 — FINAL SECURITY + CODE AUDIT
==================================================

Repository-wide search for: old branding, `Bunny`/`BUNNY`, `Ruflo`/`RUFLO`, `training`,
`virtual training`, `mock trading`, `fake trading`, hardcoded financial data, duplicate API
clients, duplicate wallet logic, duplicate order logic, browser settlement, exposed secrets,
dead frontend code, broken imports.

⚠ **Rev 2 additions to the sweep:**
- `Flight Lab` — **backend-emitted (F19)**: report, do not chase it in frontend code
- `InstantOrder` — must not survive as a component, route, or copied layout (Phase 12)
- `/a/:code`, `/s/:code`, `ACCESS_REQUIRED`, `BackendContract`, `interpretAuthBody` — must
  be **gone** (F16)
- `staking/unstake` — must appear **nowhere** in frontend code (F3)
- `deposit/approve` — must appear **nowhere** in frontend code (F10)
- `admin` — must not appear in the **user** bundle (F12)
- `server/data/users.json` — must stay **gitignored**; never commit real user data

Do not blindly rename backend technical identifiers if it would break APIs. Clean
**user-facing** branding.

==================================================
PHASE 38 — BACKEND PROTECTION
==================================================

Before commit, verify the backend is untouched: `git status`, `git diff --stat`, `git diff`.

**`server.mjs`, `trading-worker/**`, `database/**`, `Dockerfile`, `docker-compose.yml` must
show ZERO diff.** Separate frontend from backend changes.

If the task accidentally modified backend logic: restore it, unless strictly necessary for a
documented frontend compatibility issue.

DO NOT alter backend business logic merely to make the frontend easier.
⚠ **In particular: do NOT "fix" F3 by adding an `/api/staking/unstake` handler, do NOT gate
F10/F11, and do NOT add a positions endpoint.** Those are backend changes. **Report them.**

==================================================
PHASE 39 — BUILD + GIT VERIFICATION
==================================================

`npm run typecheck` · `npm test` · `npm run build`, then `git status`, `git diff --stat`,
`git diff`, `git log --oneline -5`.

Review all modified files. Verify: no secrets, no debug code, no fake data, **no backend
diff**, no old UI copied, no broken routes, **no forbidden calls from Phase 29**.

==================================================
PHASE 40 — COMMIT + PUSH
==================================================

Only after everything passes:

```
git add <frontend files>          # never `git add -A` — protect backend + server/data
git commit -m "feat: build fresh Mudrexx Earn frontend"
git push origin <your branch>
```

Do NOT push main. Do NOT merge main. Report the exact branch name and commit hash.
If push is blocked, report the exact error. **Do not claim it was pushed.**

==================================================
STOP CONDITIONS — DECISIONS REQUIRED
==================================================

Do not ask for approval between normal phases. **Do stop** for a destructive change, a
missing backend capability, authentication ambiguity, or a genuinely blocking
infrastructure issue. Rev 2 identifies **three** such points up front:

**S1 — WITHDRAWAL SEMANTICS (F8).** Which path is product-correct:
`/api/withdrawal/support` (ticket, no debit — recommended) or `/api/withdraw/submit`
(debits immediately, INR only, never executed)? **Proceed with the recommended path and
flag it**, unless instructed otherwise.

**S2 — DEPLOYMENT TARGET (F1/Phase 35).** Node/Docker (full contract) or Worker
(21 routes missing)? **Proceed targeting Node/Docker**, and if a Worker deploy is demanded,
stop and confirm which product areas may be disabled.

**S3 — SELF-APPROVE DEPOSIT (F10).** Confirm it is **excluded** from the user frontend. It needs
a token but no staff role, so it is a privilege hole rather than a user feature. **Proceed by
excluding it and reporting it as critical.** Do not wire it "because the backend offers it."

Everything else: proceed without asking.

==================================================
FINAL ACCEPTANCE CRITERIA
==================================================

COMPLETE ONLY WHEN:

✓ Branch created (or session branch used, and named in the report)
✓ Backend fully inspected; **F1–F19 re-confirmed**
✓ Canonical backend determined (**server.mjs**)
✓ Actual API contract mapped to real paths
✓ Fresh frontend built from scratch
✓ New design system created
✓ Mudrexx Earn branding correct
✓ Landing page complete **and free of F4/F8/F9 overclaims**
✓ Authentication connected; **invitation code first-class (F15)**; register auto-signs-in
✓ Dashboard connected, with honest degradation for Node-only panels
✓ Markets connected
✓ Market detail + `/api/market/klines` chart connected
✓ Market analysis connected (Node only)
✓ Trading terminal **rebuilt from scratch — `InstantOrder.tsx` not reused**
✓ Order desk driven by `/api/order/config`
✓ Order creation connected
✓ Active orders connected
✓ **Lazy settlement respected: status observed by re-fetch, never set locally (F13)**
✓ Orders/history connected
✓ **Cancellation via `/api/wallet/frozen/release`**
✓ Positions built as an **explicit derived view (F5)**
✓ Wallet connected (INR + USDT ledgers)
✓ Deposits connected — **frozen/pending, no fabricated payment instructions (F9)**
✓ 🔴 **No self-approve deposit control anywhere (F10)**
✓ Withdrawals connected per **S1**, with no automated-payout claim (F8)
✓ Earn/staking connected — **INR-only, release-based unstake, no accrual UI (F3/F4)**
✓ Tasks connected (read-only if that is all the backend offers)
✓ Credit score connected — **not recomputed client-side (F13)**
✓ Notifications connected — **no read/unread feature (F6)**
✓ Support connected — **no fake replies or status changes (F7)**
✓ Documents connected
✓ NOVA connected, scoped to advertised `topics` and `model`
✓ Account/settings connected; logout client-side
✓ **Admin isolated at BUILD level — absent from the user bundle (F12)**
✓ No fake financial data; **all Phase 29 prohibitions satisfied**
✓ No duplicate trading / wallet engine; no client-side settlement
✓ No secrets exposed; **the login gap (F11) and deposit self-approval (F10) reported as backend gaps**
✓ Responsive UI complete · Accessibility reviewed · Performance reviewed
✓ **`earn|v2|unknown` compat layer NOT ported (F16)**
✓ Typecheck passes · Tests pass · Build passes
✓ **Backend diff is EMPTY (Phase 38)**
✓ Git diff reviewed · Branch committed · Branch pushed · Main untouched

==================================================
FINAL REPORT FORMAT
==================================================

```
BRANCH:            <exact branch>
FRONTEND:          <architecture summary>
PAGES:             <pages created>
BACKEND:           <canonical backend + persistence identified>
DEPLOY TARGET:     <Node/Docker or Worker; if Worker, list disabled areas>
API:               <actual endpoints integrated, with real paths>
TRADING:           <order lifecycle verification, incl. how settlement was observed>
WALLET:            <wallet verification, INR + USDT>
DEPOSITS:          <what was built; confirm no fabricated instructions, no self-approve>
WITHDRAWALS:       <S1 decision taken and why>
EARN/STAKING:      <stake + release flow; confirm no accrual/term UI>
DERIVED VIEWS:     <positions — what it derives from>
OTHER FEATURES:    <tasks / credit / notifications / support / documents / NOVA>
NOT IMPLEMENTED:   <endpoints that do not exist; features intentionally omitted>
SECURITY:          <result + the F10/F11/F12 backend gaps, verbatim>
BACKEND DIFF:      <must be empty — confirm explicitly>
RESPONSIVE:        <result>
TYPECHECK:         <PASS/FAIL>
TESTS:             <PASS/FAIL — name what actually ran>
BUILD:             <PASS/FAIL>
COMMIT:            <hash>
PUSH:              <PASS/FAIL>
REMAINING GAPS:    <only genuine gaps>
```

IMPORTANT:

Do not stop after creating the UI.
Do not fake missing backend functionality.
Do not modify the existing backend.
Do not copy the old frontend.
**Do not build against an endpoint just because the docs advertise it — F3 is what happens.**

Build a genuinely fresh Mudrexx Earn frontend and connect every supported feature to the
real backend.

START NOW.

FIRST: Create the branch, inspect the repository, **re-verify F1–F19**, and confirm the
canonical backend.
THEN: Build the fresh frontend feature-by-feature and verify it end to end.

DO NOT ask for approval between normal phases — only at S1/S2/S3, a destructive change, a
missing backend capability, authentication ambiguity, or a genuinely blocking
infrastructure issue.
