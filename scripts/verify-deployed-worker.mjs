#!/usr/bin/env node
/**
 * Verify that a deployed Worker is running the *backend* build (script +
 * assets), not a static-assets-only deployment.
 *
 *   node scripts/verify-deployed-worker.mjs [https://host]
 *   npm run verify:deployed -- https://trading.rufflocrm.workers.dev
 *
 * Why this exists: a Worker that only has the built SPA uploaded (no
 * `src/index.ts`) serves index.html for `GET /api/health` and answers
 * `POST /api/auth/register` with **405 Method Not Allowed**, because static
 * assets only allow GET/HEAD and fall back to the SPA. Everything looks
 * deployed, but registration/login can never work.
 *
 * The checks below are side-effect free — the register probe posts an empty
 * body, so the Worker answers `400 {"error":"Email is required"}` without
 * creating an account.
 */

const target = (process.argv[2] || 'https://trading.rufflocrm.workers.dev').replace(/\/+$/, '');

const results = [];
let failed = 0;

function record(ok, label, detail) {
  results.push({ ok, label, detail });
  if (!ok) failed += 1;
}

async function probe(method, path, body) {
  const res = await fetch(`${target}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, contentType: res.headers.get('content-type') || '', text, json };
}

function isHtml(res) {
  return /text\/html/i.test(res.contentType) || /^\s*<!doctype html/i.test(res.text);
}

console.log(`Verifying ${target}\n`);

// 1. The Worker script must answer /api/health with JSON.
try {
  const health = await probe('GET', '/api/health');
  if (health.json?.ok === true) {
    record(
      true,
      'GET /api/health -> JSON backend response',
      `storage=${health.json.storage ?? 'unknown'} source=${health.json.source ?? 'unknown'}`,
    );
  } else if (isHtml(health)) {
    record(
      false,
      'GET /api/health -> index.html (static-assets-only deployment)',
      'The API backend script is not deployed. /api/* is falling through to the SPA.',
    );
  } else {
    record(false, 'GET /api/health', `unexpected response (HTTP ${health.status}): ${health.text.slice(0, 160)}`);
  }
} catch (error) {
  record(false, 'GET /api/health', `request failed: ${error.message}`);
}

// 2. The API catalog is served natively by the Worker (never by assets).
try {
  const catalog = await probe('GET', '/api');
  if (catalog.json?.endpoints?.auth?.register && catalog.json?.endpoints?.health) {
    record(true, 'GET /api -> endpoint catalog', 'register + health endpoints advertised');
  } else {
    record(false, 'GET /api -> endpoint catalog', `HTTP ${catalog.status}: ${catalog.text.slice(0, 160)}`);
  }
} catch (error) {
  record(false, 'GET /api -> endpoint catalog', `request failed: ${error.message}`);
}

// 3. POST /api/auth/register must reach the Worker's register handler.
//    400 + {"error":"Email is required"} proves the handler ran (no account created).
//    405 means the request never left the static-assets layer.
try {
  const register = await probe('POST', '/api/auth/register', {});
  if (register.status === 405) {
    record(
      false,
      'POST /api/auth/register -> 405 Method Not Allowed',
      'Static assets are answering: the Worker script (trading-worker/src/index.ts) is not part of this deployment.',
    );
  } else if (register.json?.error === 'Email is required') {
    record(true, 'POST /api/auth/register -> register handler reached', 'HTTP 400 validation response (expected)');
  } else {
    record(
      false,
      'POST /api/auth/register',
      `unexpected response (HTTP ${register.status}): ${register.text.slice(0, 160)}`,
    );
  }
} catch (error) {
  record(false, 'POST /api/auth/register', `request failed: ${error.message}`);
}

// 4. The SPA itself must still be served for browser routes.
try {
  const spa = await probe('GET', '/auth/register');
  if (spa.status === 200 && isHtml(spa)) {
    record(true, 'GET /auth/register -> SPA', 'deep links served');
  } else {
    record(false, 'GET /auth/register -> SPA', `HTTP ${spa.status}, content-type ${spa.contentType}`);
  }
} catch (error) {
  record(false, 'GET /auth/register -> SPA', `request failed: ${error.message}`);
}

console.log(results.map((r) => `${r.ok ? '  PASS' : '  FAIL'}  ${r.label}${r.detail ? `\n        ${r.detail}` : ''}`).join('\n'));

if (failed) {
  console.log(`
${failed} check(s) failed — this deployment does not include the Worker backend.

Fix:
  1. Deploy the full Worker (script + assets) rather than assets alone:
       npm run deploy          # npm run build && wrangler deploy -c wrangler.jsonc
  2. For Workers Builds, make sure the project's deploy command references a
     Wrangler config that has "main" set, e.g.
       npx wrangler deploy -c wrangler.jsonc
     and that the deploy runs in production (Workers Builds uses
     \`npx wrangler versions upload\` for non-production branches, which creates a
     preview version and leaves production unchanged).`);
  process.exit(1);
}

console.log('\nAll checks passed — the live Worker is serving the SPA, live markets and the full API backend.');
