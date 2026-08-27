# Mudrexx Earn — Mobile Performance & Thermal Optimization

Scope: CPU, battery, memory and thermal behavior on mobile. No visual design,
page replacement, backend architecture or functionality change.

## 1. Polling loops found (profile of the original build)

| # | Location | Original behavior | Problem |
|---|----------|------------------|---------|
| 1 | `market-context.tsx` | `setInterval` — `GET /api/markets` every **12 s on every route**, app-wide provider | Background traffic on wallet/tasks/support; wakes React 5×/min while idle |
| 2 | `InstantOrder.tsx` `OrdersBoard` | recursive `setTimeout` — full `listOrders` + wallet every **4 s** (26 min/hour), even with zero open orders, tab hidden, or board off-screen | The single biggest background network + render loop |
| 3 | `InstantOrder.tsx` `LiveChart` | `setInterval` — klines fetch every **10 s**, never paused (hidden tab / off-screen) | Continuous traffic while idle |
| 4 | `components.tsx` `EntryExperience` | 1 s intro countdown interval | Ran even while backgrounded |
| 5 | CSS infinite loops | `brandShimmer` (repaints header text **every frame on every page**), `heroPulse` (text-shadow repaint), `ctaPulse` (box-shadow repaint), nebula `blur(70px)` + `mix-blend-mode`, `.floating-token backdrop-filter: blur()` over an animated starfield, star/nebula/float drift | Sustained GPU/CPU paint → the phone heating |
| 6 | `AccountPages.tsx` | **static** import of `./pdf-utils` → jsPDF (+autotable, +purify, html2canvas wired) inside the startup chunk (~592 extra KB parsed/executed at boot) | Startup CPU + memory |
| 7 | Bundle | single 844 kB main chunk; every route + admin + NOVA + PDF in it | Parse/exec cost on cold start |
| 8 | Effects | `WalletPage` summary keyed on whole `user` object; duplicate `/api/tasks` (desk + tile); no request cancellation anywhere | Redundant fetches, stale-response races |

No WebSocket/SSE/EventSource, no scroll/resize listeners, and no charting library
were present (chart is inline SVG) — nothing to tear down there.
NOVA already had zero polling (status fetch on first open only) — kept.

## 2. What changed

**New `src/perf.ts`** — one shared, auditable loop engine:
- `useSmartPolling(task, { intervalMs, enabled })`: runs once on entry, then on
  cadence **only while `document.visibilityState === 'visible'` and `navigator.onLine`**;
  pauses on `visibilitychange`/`offline`; refreshes once when the tab returns
  visible and the data is stale; never overlaps two runs; full cleanup of
  interval + listeners on disable/unmount.
- `useInView` (IntersectionObserver, sticky option) — off-screen sections stop work.
- `installMotionGovernor()`: `.motion-paused` (tab hidden/offline → all CSS
  animations paused) and `.motion-lite` (coarse-pointer devices with ≤4 cores /
  ≤4 GB heap / data-saver / on battery → decorative infinite loops off; static
  look unchanged). `prefers-reduced-motion` was already honored globally and
  still overrides everything.

**Live loops re-gated (only run where they are seen):**
- Market feed: 12 s always-on → **15 s, only on `/`, `/dashboard`, `/market`,
  `/trading`, `/instant-order`**, paused hidden/offline, refresh-on-return,
  `AbortController` per load, no stale-response pile-ups, in-flight deduped.
- Order board: 4 s recursive timeout → **10 s via `useSmartPolling`**, only while
  signed in + board in view + at least one open order; **zero polling when no
  order is open**; instant single refresh driven by the new
  `mudrexx:orders-changed` event (order placed / released) instead of fast polling.
- Countdown: `Xs left` is now rendered by a tiny `OrderRemaining` component from
  the **server `expiresAt` timestamp with a local 1 s tick** (isolated render
  scope, pauses when hidden, self-clears at expiry and triggers one board
  refresh). The full API is no longer the clock.
- Chart: 15 s cadence, paused when scrolled off-screen or hidden; symbol/interval
  change aborts the superseded klines request (no stale candles for the old pair).
- Dashboard desk: 5 endpoints on entry + **5 min** slow poll; support tickets:
  entry + **2 min** refresh-on-focus. Wallet: never polled — refreshed after
  mutations (existing flow) and on page entry only. NOVA: unchanged, on-demand only.
- Intro experience: 1 s ticker skips ticks while hidden.

**Duplicate/loop-prone work:**
- `api.ts`: single dedupe layer (`dedupGet`) — simultaneous identical GETs
  (dashboard + task tile, board + orders page, StrictMode double-mount) share one
  request; `request()` gained `signal` (AbortError passes through untouched).
  GETs used by multiple components: markets, klines, orders list, tasks,
  notifications, tickets, credit(+history), documents, wallet summary/transactions/
  frozen, order config, account snapshot, market detail/analysis, NOVA status.
- `WalletPage` summary effect re-keyed on balance fields (not object identity);
  `ProfilePage` effect likewise — refreshes exactly after mutations, never on
  unrelated context churn.

**CSS (appearance preserved, continuous work removed):**
- Logo gradient keeps its shimmer but as hover interaction on pointer devices —
  no 60 fps `background-clip:text` repaint on mobile.
- `heroPulse`/`ctaPulse` replaced by their static mid-glow values; nebula
  `blur(70px)` removed (already-feathered radial gradients); token
  `backdrop-filter` dropped (sits on 86 % opaque fill).
- Transform/opacity-only loops (star drift, card float) stay on capable
  devices, are paused by `.motion-paused`, and disabled by `.motion-lite`.
- Below-the-fold marketing sections get `content-visibility: auto` (offscreen
  layout/paint skipped until they approach the viewport).

**Code splitting (React.lazy):**
- Startup bundle = landing/login/dashboard shell (Home + header/footer/auth/
  toasts + NOVA launcher + market context) + react/router vendors. All student
  routes (markets, instant order, orders, tasks, deposit, account/wallet/
  support/community, documents, admin) are lazy chunks with a spinner fallback;
  likely-next routes warm during `requestIdleCallback` — never blocking first
  paint. Admin, PDFs and their libraries are never prefetched.
- `pdf-utils` (jsPDF + autotable) became a dynamic import fired **on the first
  "Generate PDF" click** and memoized; html2canvas remains a jspdf-internal
  dynamic import that our code paths never trigger. PDF work can no longer run
  during page initialization.
- `vite.config.ts`: react/react-router split into cacheable vendor chunks
  (framework chunk unchanged across app deploys).

## 3. Bundle size before → after (`vite build`, minified)

| Startup JS | Before | After |
|---|---|---|
| Main chunk | 844.09 kB (259.4 gz) | **103.78 kB (29.4 gz)** |
| Static jspdf core + purify at boot | 188.84 kB | **0 kB** |
| React + router vendor | (inside main) | 183.45 kB (60.4 gz) |
| **Total shipped at startup** | **~1,033 kB (324 gz)** | **~287 kB (90 gz) — −72 %** |

Lazy chunks (fetched on demand): Market 14.8 kB, InstantOrder 26.2 kB,
OrdersPage 6.9 kB, TasksPage 5.8 kB, Deposit 13 kB, AccountPages 56.7 kB,
AdminUsersPage 5.2 kB, pdf-utils 433 kB (+159.8 kB jspdf core, only when a PDF
is generated). html2canvas (202.4 kB) stays out of every student path — it is
only reachable through jsPDF's own dynamic import. Vite's >500 kB chunk warning
no longer fires on anything loaded by a student page.

## 4. Network per minute (idle, single tab, before → after)

| State | Before | After |
|---|---|---|
| Home/dashboard, visible | 5 GET/min, forever | 4 GET/min (15 s live desk ticker) |
| Home, tab hidden | 5 GET/min | **0** |
| Wallet / tasks / orders / profile | 5 GET/min | **0** (entry load only) |
| Instant order, no open orders | 21 GET/min | 4 GET/min (chart cadence) |
| Instant order, open order | 21 GET/min + full-board render every 4 s | 4 chart + 6 board/min, isolated 1 s local countdown, 0 when hidden |
| Support | 5 GET/min | 0.5 GET/min |

## 5. Verification performed here

- `tsc --noEmit` clean; `npm test` → 46/46 backend contract tests pass
  (orders, wallet, auth, settlement via `expiresAt` untouched).
- Production build served via `vite preview`: all routes 200; live smoke —
  register → demo order → server settle → `listOrders` shows `expiresAt`
  countdown input end-to-end.
- `grep` audit: no `setInterval`/`setTimeout` recursion left outside
  `perf.ts`'s gated poller, the user-initiated Aviator round, and the
  component-scoped countdown/intro ticks. Every interval/listener/observer
  added by this work is cleaned up in its effect teardown.

## 6. On-device test plan (for Android/iPhone verification)

1. Chrome remote DevTools → Performance tab, 4× CPU throttle: load
   `/dashboard`, idle 1–5 min — expect long idle periods, no frames while
   nothing changes; scripting total after load < 1 % per minute.
2. Network tab: idle Home should show 4 requests/min (0 once the tab is
   backgrounded; a single refresh when foregrounded).
3. Battery Historian / `top` CPU on a low/mid-range Android: background pages
   (wallet/tasks/orders) should produce no periodic wakeups.
4. iPhone Safari: background the tab on the order desk → polling must stop;
   return → exactly one refresh, countdown already correct (local clock).
5. Lighthouse mobile: reduced boot-up JS time and TBT from the −72 % payload.
