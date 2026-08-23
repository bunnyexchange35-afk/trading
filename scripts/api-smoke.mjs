import { spawn } from 'node:child_process';

const port = 18080;
const key = 'smoke-test-admin-key';
const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), ADMIN_API_KEY: key }, stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
const fail = (message) => { child.kill(); throw new Error(message); };
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('API did not start')), 8000); child.stdout.on('data', (line) => { if (line.toString().includes('listening')) { clearTimeout(timer); resolve(); } }); child.on('exit', (code) => reject(new Error(`API exited ${code}`))); });
  const health = await fetch(`${base}/api/health`);
  if (!health.ok || !(await health.json()).ok) fail('health check failed');
  if (!health.headers.get('content-security-policy') || !health.headers.get('x-content-type-options')) fail('security headers missing');
  const unsafe = await fetch(`${base}/api/link-safety/check?url=http://localhost:3000`);
  if ((await unsafe.json()).safe) fail('Link Safety Guard accepted localhost');
  const denied = await fetch(`${base}/api/admin/config`);
  if (denied.status !== 401) fail('admin endpoint was not protected');
  const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const update = await fetch(`${base}/api/admin/config`, { method: 'PUT', headers, body: JSON.stringify({ announcement: 'Smoke-tested configuration' }) });
  if (!update.ok || (await update.json()).data.announcement !== 'Smoke-tested configuration') fail('admin update failed');
  console.log('API smoke tests passed');
} finally { child.kill(); }
