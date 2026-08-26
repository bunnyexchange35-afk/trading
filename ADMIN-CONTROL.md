# ADMIN & SUPER ADMIN CONTROL — Backend Command Summary

> Full machine-readable API definition (both auth conditions + every endpoint, worker URLs): see [`api.json`](api.json).

Paste-ready reference for the training programme backend. All control is **backend-side** — no admin pages; you drive everything with these HTTP commands (curl, Postman, or your own tooling). The site itself reads as a normal live trading desk: real Coinbase market graphs, real currency pairs, no "demo/training" wording.

**Both conditions attached:**
1. **Registration is invitation-only** — the only valid codes are the institute-assigned `ADMIN_CODES` / `SUPER_ADMIN_CODES`; user referral codes are rejected, no code is ever issued by the app.
2. **Sign-in required** — sign up / sign in return a bearer token (`Authorization: Bearer <token>`); every wallet/order/deposit/staking call requires it and can only touch its own account.

- **Backend code**: `server.mjs` → "ORDER ENGINE" + "ADMIN & SUPER ADMIN ORDER CONTROL ROOM" sections
- **Works through Cloudflare Workers**: every `/api/*` command below is proxied by the `mudrex-earn` worker to `BACKEND_ORIGIN` — or call the backend directly on its own URL.

## Roles

| Role | Env var | Default codes (override in production!) |
|---|---|---|
| ADMIN | `ADMIN_CODES` | `MUDREXX-ADMIN, ADMIN-2024, ADMIN777, MEDRIX888, ADMIN` |
| SUPER ADMIN | `SUPER_ADMIN_CODES` | `MUDREXX-SUPER, SUPER-2024` |

Both roles control **every order** — win, lose, cancel, change currency, change time, change payout % — **anytime**. Only SUPER ADMIN can command wallet balances directly.

```bash
# set your own codes when deploying
ADMIN_CODES="ADMIN1,ADMIN2" SUPER_ADMIN_CODES="BOSS1" node server.mjs
```

## Commands

```bash
BASE="https://mudrex-earn.<your-subdomain>.workers.dev"   # the deployed worker (proxies /api to your backend)
CODE="MUDREXX-SUPER"                  # admin or super admin code
```

### Check role
```bash
curl "$BASE/api/admin/role?code=$CODE"
# -> { "success": true, "role": "super" }
```

### Every order across all users (live board)
```bash
curl "$BASE/api/admin/orders/all?code=$CODE"
# -> { role, total, orders: [ { id, userEmail, userName, symbol, side, amount,
#      currency, accountType, status(open|won|lost|cancelled), payoutPercent,
#      durationSeconds, createdAt, expiresAt, entryPrice, exitPrice, payout, ... } ] }
```

### Force order outcome — WIN / LOSE / CANCEL (anytime)
```bash
curl -X POST "$BASE/api/admin/orders/control" -H 'content-type: application/json' \
  -d '{ "code": "'$CODE'", "orderId": "ord-1787709313173", "action": "win" }'
# action: "win" | "lose" | "cancel"      optional: "percent": 85  (payout % at settle time)
# win    -> stake + payout% returns to the user's balance (real ₹/₮ or credits)
# lose   -> stake is consumed
# cancel -> stake refunded
```

### Change currency / time / payout % (anytime, open orders)
```bash
curl -X POST "$BASE/api/admin/orders/update" -H 'content-type: application/json' \
  -d '{ "code": "'$CODE'", "orderId": "ord-1787709313173",
        "currency": "USDT", "durationSeconds": 120, "payoutPercent": 50 }'
# all fields optional — send only what you want changed
# currency INR<->USDT moves the escrow between the INR and USDT books 1:1
# durationSeconds resets the remaining time (5..86400); payoutPercent 1..500
```

### SUPER ADMIN only — command wallet state directly
```bash
curl -X POST "$BASE/api/admin/wallet/adjust" -H 'content-type: application/json' \
  -d '{ "code": "MUDREXX-SUPER", "email": "user@example.com",
        "field": "real", "delta": 10000 }'
# field: real | realUsdt | frozen | frozenUsdt | demo   delta: + / - (never below 0)
# shows in the user's ledger as a neutral "Balance Sync" entry
```

### User-side reads (what the site uses)
```bash
curl "$BASE/api/orders/list?email=user@example.com"
# the Instant Order page board: every order + live wallet state
# -> { orders: [...], wallet: { depositCredited, depositCreditedUsdt, creditTotal,
#      totalBalance, totalUsdtBalance, frozenBalance, frozenUsdtBalance, ... } }

curl "$BASE/api/wallet/summary?email=user@example.com"
# wallet page: adds deposit / credit / total / frozen state + openOrders count
```

## Order lifecycle

1. **Create** — `POST /api/orders/create { email, symbol, side:up|down, amount, currency:INR|USDT, accountType:real|demo, durationSeconds, payoutPercent }`. Real orders escrow the amount (₹ or ₮); credit orders escrow practice credits. Entry price is captured live from the market feed.
2. **Board** — every order appears on the Instant Order page with side, amount, %, countdown, entry→exit price and status.
3. **Settlement** — when time expires, the order auto-closes against the real market move (UP wins if price ≥ entry, DOWN wins if price ≤ entry). Admins can force the outcome **before or after** expiry — the admin decision is final and instant.
4. **Wallet** — wins/losses/refunds immediately update Available / Frozen / Total; the wallet page shows the Deposit / Credit / Total / Frozen state strip, and every move lands in the transaction ledger.

## Run / deploy

```bash
# local
npm install && npm run build && node server.mjs            # API + SPA on :8080

# cloudflare worker (site + live markets) + backend for the control commands
npm run deploy                                              # worker: mudrex-earn
# then in Cloudflare dashboard -> mudrex-earn -> Variables: BACKEND_ORIGIN=https://<backend-url>
ADMIN_CODES="..." SUPER_ADMIN_CODES="..." npm start         # on the backend host
```

Tests: `npm test` (29 checks incl. order board + admin control).
