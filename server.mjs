import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8080);
const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ETC', 'ADA', 'DOGE'];
const allowedIntervals = new Set(['1m', '5m', '15m', '1h']);
const seed = { BTC: [116430.2, 2.84], ETH: [4284.51, 1.47], BNB: [873.22, -0.64], SOL: [184.76, 4.92], XRP: [2.18, -1.23], ETC: [23.74, 0.82], ADA: [0.728, 3.16], DOGE: [0.2184, -0.42] };
const assets = { BTC: ['Bitcoin', '#f7931a', '#fff4e4', '₿'], ETH: ['Ethereum', '#627eea', '#eef1ff', 'Ξ'], BNB: ['BNB', '#f3ba2f', '#fff9df', 'B'], SOL: ['Solana', '#7657ff', '#f2efff', 'S'], XRP: ['XRP', '#23292f', '#edf0f2', 'X'], ETC: ['Ethereum Classic', '#3ab83a', '#eaf9ea', 'E'], ADA: ['Cardano', '#316bd6', '#edf4ff', 'A'], DOGE: ['Dogecoin', '#c3a634', '#fff9df', 'Ð'] };
const apy = { BTC: 2.8, ETH: 4.7, BNB: 3.4, SOL: 6.9, XRP: 2.2, ETC: 3.8, ADA: 5.1, DOGE: 1.8 };
const adminKey = process.env.ADMIN_API_KEY || '';
const config = { maintenanceMode: false, supportUrl: process.env.VITE_TELEGRAM_URL || 'https://t.me/mudrexxearn_support', announcement: 'Flexible Earn vaults are now available.' };
let marketCache = null;
let cacheAt = 0;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], baseUri: ["'self'"], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], imgSrc: ["'self'", 'data:', 'https:'],
    scriptSrc: ["'self'"], connectSrc: ["'self'", 'https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com', 'https://api.binance.us'],
    objectSrc: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"], upgradeInsecureRequests: [],
  } },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(express.json({ limit: '16kb', strict: true }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please try again shortly.' } }));

function fallbackMarkets() { return symbols.map((symbol) => { const [price, change] = seed[symbol]; const [name, color, soft, mark] = assets[symbol]; return { symbol, name, color, soft, mark, stakingApy: apy[symbol], price, change, high: price * 1.035, low: price * 0.968, volume: price * 28435 }; }); }
async function fetchBinance(route) { const hosts = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com', 'https://api.binance.us']; let lastError; for (const host of hosts) { try { const response = await fetch(`${host}${route}`, { signal: AbortSignal.timeout(5500), headers: { 'User-Agent': 'MudrexxEarn/1.0' } }); if (!response.ok) throw new Error(`Binance returned ${response.status}`); return await response.json(); } catch (error) { lastError = error; } } throw lastError || new Error('Market provider unavailable'); }
function safeExternalUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !['localhost', '127.0.0.1', '::1'].includes(url.hostname) && !url.hostname.endsWith('.local'); } catch { return false; } }
function requireAdmin(req, res, next) { if (!adminKey) return res.status(503).json({ error: 'Admin API is disabled. Set ADMIN_API_KEY to enable it.' }); const token = req.get('authorization')?.replace(/^Bearer\s+/i, ''); if (!token || token.length !== adminKey.length || !Buffer.from(token).equals(Buffer.from(adminKey))) return res.status(401).json({ error: 'Unauthorized' }); return next(); }

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'mudrexx-earn', timestamp: new Date().toISOString() }));
app.get('/api/link-safety/check', (req, res) => { const value = String(req.query.url || ''); const safe = safeExternalUrl(value); res.json({ safe, reason: safe ? 'HTTPS destination passed Link Safety Guard.' : 'Only public HTTPS links without credentials are allowed.' }); });
app.get('/api/markets', async (_req, res) => { if (marketCache && Date.now() - cacheAt < 8000) return res.json({ data: marketCache, source: 'binance', cached: true }); try { const pairs = symbols.map((symbol) => `\"${symbol}USDT\"`).join(','); const tickers = await fetchBinance(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(`[${pairs}]`)}`); marketCache = symbols.map((symbol) => { const item = tickers.find((ticker) => ticker.symbol === `${symbol}USDT`); const [name, color, soft, mark] = assets[symbol]; const price = Number(item?.lastPrice || seed[symbol][0]); return { symbol, name, color, soft, mark, stakingApy: apy[symbol], price, change: Number(item?.priceChangePercent || seed[symbol][1]), high: Number(item?.highPrice || price * 1.03), low: Number(item?.lowPrice || price * 0.97), volume: Number(item?.quoteVolume || price * 28435) }; }); cacheAt = Date.now(); res.set('Cache-Control', 'public, max-age=5'); res.json({ data: marketCache, source: 'binance', cached: false }); } catch (error) { res.json({ data: fallbackMarkets(), source: 'fallback', message: error instanceof Error ? error.message : 'Provider unavailable' }); } });
app.get('/api/market/klines', async (req, res) => { const base = String(req.query.symbol || 'BTC').toUpperCase(); const interval = String(req.query.interval || '1m'); if (!symbols.includes(base) || !allowedIntervals.has(interval)) return res.status(400).json({ error: 'Unsupported market request' }); try { const rows = await fetchBinance(`/api/v3/klines?symbol=${base}USDT&interval=${interval}&limit=80`); const data = rows.map((row) => ({ time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) })); res.set('Cache-Control', 'public, max-age=8'); res.json({ data, source: 'binance' }); } catch { const [start] = seed[base]; let price = start * 0.975; const data = Array.from({ length: 80 }, (_, index) => { const open = price; price = Math.max(0.0001, price * (1 + (Math.sin(index * 1.7) + Math.random() - 0.45) * 0.0028)); return { time: Date.now() - (79 - index) * 60_000, open, high: Math.max(open, price) * 1.002, low: Math.min(open, price) * 0.998, close: price, volume: 100 + Math.random() * 900 }; }); res.json({ data, source: 'fallback' }); } });
app.get('/api/admin/config', requireAdmin, (_req, res) => res.set('Cache-Control', 'no-store').json({ data: config }));
app.put('/api/admin/config', requireAdmin, (req, res) => { const body = req.body || {}; const allowed = ['maintenanceMode', 'supportUrl', 'announcement']; const unknown = Object.keys(body).filter((key) => !allowed.includes(key)); if (unknown.length) return res.status(400).json({ error: `Unsupported configuration field: ${unknown[0]}` }); if ('maintenanceMode' in body && typeof body.maintenanceMode !== 'boolean') return res.status(400).json({ error: 'maintenanceMode must be a boolean' }); if ('supportUrl' in body && (typeof body.supportUrl !== 'string' || !safeExternalUrl(body.supportUrl))) return res.status(400).json({ error: 'supportUrl must be a safe public HTTPS URL' }); if ('announcement' in body && (typeof body.announcement !== 'string' || body.announcement.length > 180)) return res.status(400).json({ error: 'announcement must be a string of 180 characters or fewer' }); Object.assign(config, body); res.set('Cache-Control', 'no-store').json({ data: config }); });

app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', index: false }));
app.get('*', (req, res, next) => { if (req.path.startsWith('/api/')) return next(); res.sendFile(path.join(__dirname, 'dist', 'index.html')); });
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
const server = app.listen(port, '0.0.0.0', () => console.log(`Mudrexx Earn is listening on 0.0.0.0:${port}`));

// Container platforms stop old replicas with SIGTERM during redeploys. Close the listener
// cleanly so the process exits successfully instead of leaving npm to report a lifecycle error.
function shutdown(signal) {
  console.log(`Received ${signal}; closing Mudrexx Earn gracefully.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8_000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
