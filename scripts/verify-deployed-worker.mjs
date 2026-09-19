#!/usr/bin/env node
/**
 * Verify that a deployed Worker is the agreed STATIC-ONLY deployment
 * (assets + SPA fallback, no API handler).
 *
 *   node scripts/verify-deployed-worker.mjs [https://host]
 *   npm run verify:deployed -- https://trading.rufflocrm.workers.dev
 *
 * Why this exists: the in-Worker API backend was removed on purpose — the
 * `trading` Worker serves the built SPA from static assets and nothing else
 * (audit item: "API handler in trading Worker — should be removed, static
 * only"). The API lives in `server.mjs` (Express, deployed separately). The
 * risk to guard against is the opposite regression now: someone re-adding an
 * API handler (or an old script+assets deploy still being live), which would
 * put a second, diverging backend back on the edge.
 *
 * The checks below are side-effect free — the register probe posts an empty
 * body and expects the static-assets layer to reject it with 405/404, so no
 * account can be created even if an API handler were somehow present.
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

console.log(`Verifying ${target} (static-only contract)\n`);

// 1. The SPA must be served at the root.
try {
  const root = await probe('GET', '/');
  if (root.status === 200 && isHtml(root)) {
    record(true, 'GET / -> SPA', 'static assets are live');
  } else {
    record(false, 'GET /', `HTTP ${root.status}, content-type ${root.contentType}`);
  }
} catch (error) {
  record(false, 'GET /', `request failed: ${error.message}`);
}

// 2. Deep links must fall back to the SPA (client-side routing on hard refresh).
try {
  const spa = await probe('GET', '/auth/register');
  if (spa.status === 200 && isHtml(spa)) {
    record(true, 'GET /auth/register -> SPA', 'single-page-application fallback works');
  } else {
    record(false, 'GET /auth/register -> SPA', `HTTP ${spa.status}, content-type ${spa.contentType}`);
  }
} catch (error) {
  record(false, 'GET /auth/register -> SPA', `request failed: ${error.message}`);
}

// 3. GET /api/health must NOT be answered by an API handler. A static-only
//    Worker falls back to index.html; a JSON `{ok:true}` body means an API
//    handler is (still / again) deployed on this Worker.
try {
  const health = await probe('GET', '/api/health');
  if (isHtml(health)) {
    record(true, 'GET /api/health -> SPA fallback (no API handler)', 'the Worker is static-only');
  } else if (health.json?.ok === true) {
    record(
      false,
      'GET /api/health -> JSON API response',
      'An API handler is deployed on this Worker. The trading Worker must be static only — remove the script (no "main" in wrangler.jsonc) and redeploy.',
    );
  } else {
    record(false, 'GET /api/health', `unexpected response (HTTP ${health.status}): ${health.text.slice(0, 160)}`);
  }
} catch (error) {
  record(false, 'GET /api/health', `request failed: ${error.message}`);
}

// 4. POST /api/auth/register must never reach a register handler. Cloudflare
//    static assets answer 405; any other static host answers 404. A JSON
//    validation response (400 {"error":...}) would prove a backend is live.
try {
  const register = await probe('POST', '/api/auth/register', {});
  if (register.status === 405 || register.status === 404) {
    record(
      true,
      'POST /api/auth/register -> not handled',
      `HTTP ${register.status} from the static-assets layer (expected)`,
    );
  } else if (register.json && ('success' in register.json || 'error' in register.json)) {
    record(
      false,
      'POST /api/auth/register -> API handler answered',
      `HTTP ${register.status}: ${register.text.slice(0, 160)}`,
    );
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

console.log(results.map((r) => `${r.ok ? '  PASS' : '  FAIL'}  ${r.label}${r.detail ? `\n        ${r.detail}` : ''}`).join('\n'));

if (failed) {
  console.log(`
${failed} check(s) failed — this deployment does not match the static-only contract.

Fix:
  1. Deploy the static Worker (assets only, no script):
       npm run deploy          # npm run build && wrangler deploy -c wrangler.jsonc
     wrangler.jsonc must have NO "main" entry point.
  2. For Workers Builds, make sure the project's deploy command is
       npx wrangler deploy -c wrangler.jsonc
     and that the deploy ran for production (non-production branches use
     \`npx wrangler versions upload\`, which leaves production unchanged).
  3. The API is 'server.mjs' (Express, Docker) — deploy it separately and point
     the frontend at it with the build-time VITE_API_URL variable.`);
  process.exit(1);
}

console.log('\nAll checks passed — the Worker is serving the static SPA only, with no API handler.');
