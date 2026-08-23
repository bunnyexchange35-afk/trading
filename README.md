# Mudrexx Earn

A responsive crypto market and practice-trading web experience built with React, TypeScript, Vite, and Express. The interface is an original implementation inspired by modern Indian fintech patterns; it does not copy Mudrex source code or protected brand assets.

## Included

- Home landing page with a 30-second 3D-style wealth-wallet intro and skip control
- Live market page with Spot, Futures, and Staking tabs plus folding quick-action forms
- Instant Order desk with Binance public kline streaming, INR/USDT amounts, time, target %, BUY UP, and BUY DOWN previews
- Flight Lab practice game with demo credits, random rounds, cash-out controls, and reward/result popups
- Deposit experience for INR via UPI/bank and USDT via TRC20
- Sign-in/sign-up demo flow and profile menu for Settings, Wallet, Support, and Community
- Global Telegram contact button
- Responsive layouts for desktop, tablet, and mobile
- Production Express server, API proxy/fallback, health check, and Dockerfile

> The order desk, balances, account flow, deposit details, and mini-game are demonstrational. No real orders or payments are submitted. Replace the sandbox UI with licensed payment, custody, identity, and exchange services before accepting funds.

## Local development

```bash
npm install
npm run dev
```

The development command starts both services: Vite on `http://localhost:5173` and the market API on port `8080`. Vite proxies browser requests from `/api` to that API, so no second terminal is needed.

## Production

```bash
npm run build
npm start
```

The server binds to `0.0.0.0:${PORT:-8080}`, serves `dist`, and exposes:

- `GET /api/health` — health probe
- `GET /api/markets` — selected Binance 24-hour tickers
- `GET /api/market/klines?symbol=BTC&interval=1m` — chart candles

Binance requests use public endpoints and require no API key. If every Binance host is unavailable, the API returns clearly identified fallback data so the UI remains usable.

## Deploy to Northflank

This repository can be deployed directly as a **combined service** using the included multi-stage `Dockerfile`.

1. Create a Northflank project and add a **Combined Service** from this Git repository.
2. Select **Build with Dockerfile**; path: `Dockerfile`, context: repository root.
3. Expose public HTTP port **8080**.
4. Set the health check to `GET /api/health` on port 8080.
5. Optional build argument: `VITE_TELEGRAM_URL=https://t.me/your_verified_support_handle`.
6. Deploy. Northflank can inject `PORT`; the server defaults to `8080` when it is absent.

No database or persistent volume is required for the current demo.

## Configuration

| Variable | Type | Purpose |
| --- | --- | --- |
| `PORT` | Runtime variable | Express listen port; defaults to `8080` |
| `VITE_TELEGRAM_URL` | Build argument / local env | Global Telegram support destination |

For production, use a verified support handle and display the same handle in your official-channel documentation to reduce impersonation risk.

## Security and administration

The server sends security headers (including CSP, HSTS when served over HTTPS, frame protection, and a strict referrer policy), limits API traffic, rejects oversized JSON payloads, and includes a Link Safety Guard at `GET /api/link-safety/check?url=` for public HTTPS destinations. Browser-facing integrations use relative `/api` paths.

A server-only, bearer-authenticated configuration API is documented in [ADMIN_API.md](ADMIN_API.md). Set `ADMIN_API_KEY` as a Northflank secret; never use a `VITE_` variable for it. The API is disabled when no key is configured.

Run the local API smoke suite after building:

```bash
npm run test:api
```
