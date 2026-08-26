# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the frontend (needs devDependencies: vite, tsc)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts postcss.config.js index.html ./
COPY src ./src
RUN npm run build          # tsc --noEmit && vite build -> dist/

# ---------------------------------------------------------------------------
# Stage 2 — runtime: Express backend (server.mjs) + built SPA (dist/)
# ---------------------------------------------------------------------------
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Production dependencies only (express)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --omit=dev && npm cache clean --force

COPY server.mjs ./
COPY --from=build /app/dist ./dist

# Persistent user store (server/data/users.json) — mount a volume here
RUN mkdir -p server/data
VOLUME /app/server/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

# ADMIN_CODES is read at runtime — pass it with -e / compose environment
CMD ["node", "server.mjs"]
