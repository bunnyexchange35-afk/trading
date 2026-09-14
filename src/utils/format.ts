/** Number, currency and date formatting.
 *  Mirrors the backend's own output style: INR uses `en-IN` grouping with the
 *  ₹ symbol, USDT uses ₮ (as server.mjs does), demo credits are unitless.
 */

export type Currency = 'INR' | 'USDT' | 'CREDITS';

export const currencySymbol = (currency: string): string => {
  if (currency === 'USDT') return '₮';
  if (currency === 'CREDITS') return '';
  return '₹';
};

const inr = (value: number, max = 2) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: max,
  });

/** Format a monetary amount with its symbol. */
export function money(value: number, currency: Currency | string = 'INR'): string {
  const n = Number(value || 0);
  if (currency === 'USDT') return `₮${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (currency === 'CREDITS') return `${n.toLocaleString('en-IN')} credits`;
  return `₹${inr(n)}`;
}

/** Compact money for tight spaces (nav, badges). */
export function moneyCompact(value: number, currency: Currency | string = 'INR'): string {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sym = currencySymbol(currency);
  if (abs >= 1e7) return `${sym}${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sym}${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}K`;
  return `${sym}${inr(n, abs < 100 ? 2 : 0)}`;
}

/** Crypto/forex style price — precision adapts to magnitude. */
export function price(value: number): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '—';
  const digits = n >= 1000 ? 2 : n >= 1 ? 4 : 8;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

export function signedPercent(value: number, digits = 2): string {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function compactNumber(value: number): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/** "2m 05s" style countdown from a remaining millisecond value. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}m ${pad(s)}s`;
}

export function durationLabel(seconds: number): string {
  const s = Number(seconds || 0);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** The backend stores human strings like "Just now" alongside ISO timestamps.
 *  Render ISO when we can parse it, otherwise pass the string through. */
export function whenLabel(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number') return new Date(value).toLocaleString('en-IN', dateTimeOpts);
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) return String(value);
  const diff = Date.now() - parsed;
  if (diff >= 0 && diff < 45_000) return 'just now';
  if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff >= 0 && diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff >= 0 && diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(parsed).toLocaleString('en-IN', dateTimeOpts);
}

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function dateLabel(value: string | number | undefined | null): string {
  if (!value) return '—';
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  if (Number.isNaN(parsed)) return String(value);
  return new Date(parsed).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function clockLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function initials(name: string | undefined, email: string): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? src[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}
