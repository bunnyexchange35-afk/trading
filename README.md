# ⚡ Hype Coin Control — Master Admin Panel + CRM

A full-stack **master admin panel & CRM** for a coin / trading-style platform, built for
**study and practice**. Dark, futuristic, hacker + fintech dashboard with neon accents
(green / cyan / purple), inspired by the W3CRM admin template layout (left sidebar,
topbar, KPI cards, data tables, charts).

> Everything runs out of the box with **zero external services** — the backend uses
> Node's built-in SQLite (`node:sqlite`), JWT auth, and placeholder integrations for
> AI / email / social / passkey / MFA, so you can explore every module immediately.

---

## 1. Quick start

```bash
npm install          # installs both workspaces (server + web)
npm run dev          # starts API on :4000 and web on :5173 (concurrently)
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` to the backend.

### Demo logins (seeded on first boot)

| Role         | Username   | Password      | MFA        |
| ------------ | ---------- | ------------- | ---------- |
| Master Admin | `master`   | `Master@123`  | enabled → code `123456` |
| Admin        | `n.kane`   | `Admin@123`   | —          |
| Support      | `s.bloom`  | `Support@123` | —          |
| Viewer       | `v.read`   | `Viewer@123`  | —          |

Useful scripts:

```bash
npm run dev           # root — run server + web together
npm run dev:server    # API only  (tsx watch)
npm run dev:web       # web only   (vite)
npm run seed          # re-seed dummy data  (-- --force to wipe & rebuild)
npm run build         # production build of the web app
npm run typecheck     # type-check server + web
```

---

## 2. Tech stack

| Layer    | Choice |
| -------- | ------ |
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS 3, Recharts, lucide-react, react-router-dom |
| Backend  | Node.js + Express 4 + TypeScript (run via `tsx`) |
| Database | SQLite via `node:sqlite` (schema in `server/src/schema.sql` — easily portable to PostgreSQL/MySQL) |
| Auth     | JWT (`jsonwebtoken`) + bcryptjs, optional MFA flow, passkey/face-scan design hooks |
| Realtime | Design hooks left for WebSockets / Redis (see §8) |

---

## 3. Project structure

```
Hypo-backend/
├─ package.json            # npm workspaces root (concurrently dev runner)
├─ .env.example            # env template (secrets/config)
├─ server/                 # ── Backend (Express API) ──
│  ├─ src/
│  │  ├─ index.ts          # app bootstrap, router mounting, error handling
│  │  ├─ config.ts         # env-driven config
│  │  ├─ db.ts             # sqlite open + settings + audit helpers
│  │  ├─ schema.sql        # full relational schema
│  │  ├─ seed.ts           # rich dummy dataset for every module
│  │  ├─ auth.ts           # JWT + password hashing + RBAC permission model
│  │  ├─ helpers.ts        # small utils
│  │  ├─ middleware/auth.ts# authRequired + requirePermission
│  │  ├─ services/
│  │  │  ├─ ai.ts          # AI command parser + agreement generator (placeholder)
│  │  │  └─ email.ts       # email delivery (placeholder, tracks metrics)
│  │  └─ routes/           # one router per domain (see §5)
│  └─ tsconfig.json
└─ web/                    # ── Frontend (React SPA) ──
   ├─ index.html
   ├─ vite.config.ts       # /api proxy → :4000, 0.0.0.0 host
   ├─ tailwind.config.js   # neon theme tokens
   └─ src/
      ├─ App.tsx           # routes + protected layout
      ├─ components/       # Layout, Logo, MatrixRain, ui primitives
      ├─ lib/              # api client, auth context, toast, formatters, types
      └─ pages/            # one page per module
```

---

## 4. Database schema (summary)

Core tables (full DDL in `server/src/schema.sql`):

- **staff** — admin panel accounts (`master_admin | admin | support | viewer`)
- **users** — platform members (status: `active | cold | locked | blocked | pending`)
- **transactions** — balance ledger (add/deduct + reason + admin + balance_after)
- **orders** — trading orders (`result: pending | live | win | lose`, `live` flag)
- **leads / campaigns / social_accounts / scheduled_posts / segments** — CRM
- **chats / chat_messages / email_templates / emails / popups** — communication
- **pages / page_versions** — website editor + versioning
- **agreements / agreement_sends** — document automation + acceptance tracking
- **activity_logs / security_logs / login_history / alerts** — audit & security
- **ai_commands / notifications / backup_points / system_settings / status_history / user_notes**

The emergency **lockdown flag** is stored in `system_settings(key='lockdown')`.

---

## 5. API endpoints

All routes are JSON, prefixed with `/api`, and (except auth/health) require a
`Authorization: Bearer <token>` header.

| Domain | Endpoints |
| ------ | --------- |
| Auth | `POST /auth/login`, `POST /auth/mfa/verify`, `GET /auth/me`, `GET /auth/status`, `POST /auth/lockdown`, `POST /auth/lockdown/toggle`, `POST /auth/passkey/register`, `POST /auth/face-scan/enroll`, `POST /auth/logout` |
| Dashboard | `GET /dashboard` |
| Users | `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/approve|reject|status|notes`, `GET /users/:id/activity`, `POST /users/bulk/status` |
| Balances | `GET /balances/:userId`, `POST /balances/:userId/adjust` |
| Orders | `GET /orders`, `GET /orders/live`, `GET /orders/:id`, `PATCH /orders/:id`, `POST /orders/:id/result` |
| CRM | `GET/POST /leads`, `PATCH/DELETE /leads/:id` · `GET/POST /campaigns`, `PATCH/DELETE /campaigns/:id` · `GET/POST /social/accounts`, `DELETE /social/accounts/:id`, `GET/POST /social/posts`, `PATCH/DELETE /social/posts/:id` · `GET/POST /segments`, `PATCH/DELETE /segments/:id` |
| Communication | `GET /chats`, `GET /chats/:id`, `POST /chats/:id/messages|ai|assign|mode|status` · `GET /emails`, `POST /emails/templates`, `POST /emails/send` · `GET/POST /popups`, `PATCH/DELETE /popups/:id`, `POST /popups/:id/toggle` |
| Website | `GET/POST /website/pages`, `GET/PATCH /website/pages/:id`, `POST /website/pages/:id/publish|rollback` |
| Agreements | `GET/POST /agreements`, `GET/PATCH/DELETE /agreements/:id`, `POST /agreements/generate`, `POST /agreements/:id/send`, `POST /agreements/sends/:sendId/accept` |
| AI | `GET /ai`, `POST /ai/command`, `POST /ai/:id/confirm|execute|cancel` |
| System | `GET /system/health`, `GET /system/logs/activity|security`, `GET /system/alerts`, `POST /system/alerts/:id/dismiss`, `GET/POST /system/backups`, `POST /system/backups/:id/restore`, `GET/PATCH /system/settings`, `GET/POST /system/staff`, `PATCH /system/staff/:id`, `GET /system/staff/options`, `GET /system/notifications`, `POST /system/quick/lock-all|popup|campaign` |

---

## 6. Role-based access control

| Permission group | master_admin | admin | support | viewer |
| ---------------- | :---: | :---: | :---: | :---: |
| Dashboard        | ✅ | ✅ | ✅ | ✅ |
| Users (view)     | ✅ | ✅ | ✅ | ✅ |
| Users (manage/status/notes) | ✅ | ✅ | notes only | — |
| Balances / Orders manage | ✅ | ✅ | view | view |
| Leads manage     | ✅ | ✅ | ✅ | view |
| Campaigns manage | ✅ | ✅ | — | view |
| Social / Segments manage | ✅ | ✅ | — | view |
| Chats            | ✅ | ✅ | ✅ | — |
| Emails send      | ✅ | ✅ | ✅ | — |
| Popups manage    | ✅ | ✅ | — | view |
| Website / Agreements manage | ✅ | ✅ | — | view |
| AI               | ✅ | ✅ | ✅ | — |
| Logs / Security  | ✅ | ✅ | ✅ | ✅ |
| Backups          | ✅ | ✅ | — | — |
| Staff / Lockdown / Settings | ✅ (master only) | — | — | — |

The permission map lives in `server/src/auth.ts` (`permissionsFor`), the guard in
`server/src/middleware/auth.ts`, and the UI mirrors it through `useAuth().can(...)`.

---

## 7. Feature map → modules

1. **Entry & security** — animated matrix login, logo, welcome copy, username/password,
   MFA step, passkey & face-scan hooks, last-login info, emergency lockdown panic button.
2. **Dashboard** — KPI cards, traffic/orders/funnel charts, live online users, system
   health, quick actions (lock all / global pop-up / start campaign).
3. **User control** — filterable table (name, username, role/tier, status, device,
   browser, phone, IP, location), approve/reject, edit profile & limits, activity history,
   internal notes, Cold / Lock / Block actions with status history.
4. **Balances & orders** — per-user balance, add/deduct modal with reason + audit log;
   orders table with edit + win/lose settle + live blinking indicator.
5. **Restrictions** — status logic:
   - **Cold** → view-only profile & wallet
   - **Lock** → user-facing frontend renders the big lock screen
   - **Block** → user-facing frontend returns 404 / "account not found"
   (enforced server-side via `users.status`; the consumer frontend reads it from `GET /users/:id`.)
6. **CRM** — leads pipeline (New → Contacted → Qualified → Proposal → Won/Lost) with
   assignment; campaigns with ROI tracking; social accounts + scheduling + engagement;
   segments (source / interest / region / activity).
7. **Communication center** — chat dashboard (waiting/active, Manual/AI/Hybrid modes,
   AI reply generator); email center (templates, audience targeting, opens/clicks);
   pop-up manager (type, target, pages, frequency).
8. **Website editor** — sections (hero/footer/banner/stats/cards), editable fields,
   live preview, save/publish, versioning + rollback. A/B testing left as a design hook.
9. **Agreements** — AI-generated terms/contracts/disclaimers, editable + preview,
   send via email/chat/social, acceptance tracking.
10. **AI assistant** — natural-language commands → parsed intent → suggested actions →
    confirm → execute → full audit log.
11. **Logs & security** — admin activity (filter by module/user/date), security events,
    alerts, backup points + restore hook.

---

## 8. Placeholder integrations (design hooks)

Everything is wired so only the marked functions need swapping for production:

| Feature | Where | Notes |
| ------- | ----- | ----- |
| AI responses / command parsing | `server/src/services/ai.ts` | `aiReply`, `parseCommand`, `generateAgreementText` |
| Email sending | `server/src/services/email.ts` | simulated delivery + tracked opens/clicks; SMTP hook |
| Passkey (WebAuthn) | `POST /auth/passkey/register` | returns `not_configured` |
| Face scan | `POST /auth/face-scan/enroll` | returns `not_configured` |
| MFA | `POST /auth/mfa/verify` | demo code `123456`; swap for otplib/TOTP |
| Backup restore | `POST /system/backups/:id/restore` | creates real snapshot files; live restore needs restart |
| WebSockets / Redis | — | add a Socket.IO gateway + Redis cache layer for live data |

### Environment variables (`.env.example`)

`PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `AI_API_KEY`, `AI_API_URL`,
`SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `DB_PATH`. The app ships with safe dev defaults.

---

## 9. Notes for the owner

- **Security first:** MFA on the master account, audit log on every action, failed-login
  and geo-anomaly detection, emergency lockdown reachable from the login screen (master
  password) or the topbar.
- **Control:** every balance/order/status change is recorded with `who`, `what`, `when`
  and a reason, so nothing is untraceable.
- **Automation:** the AI command center reduces repetitive operations to a sentence,
  but always requires human confirmation before execution.
- **Portability:** swap SQLite for PostgreSQL/MySQL by re-running `schema.sql` and
  replacing the thin query layer in `db.ts` — the route logic is DB-agnostic SQL.
