export const fmtMoney = (n: number | string | null | undefined, digits = 2): string => {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: v % 1 === 0 ? 0 : 2,
  });
};

export const fmtNum = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString('en-US');

export const fmtPct = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
};

export const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmtDateTime = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const timeAgo = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return fmtDate(s);
};

export type Status = 'active' | 'cold' | 'locked' | 'blocked' | 'pending';

export const statusTone: Record<string, string> = {
  active: 'text-neon-green bg-neon-green/10 ring-neon-green/30',
  cold: 'text-neon-cyan bg-neon-cyan/10 ring-neon-cyan/30',
  locked: 'text-neon-amber bg-neon-amber/10 ring-neon-amber/30',
  blocked: 'text-neon-red bg-neon-red/10 ring-neon-red/30',
  pending: 'text-neon-purple bg-neon-purple/10 ring-neon-purple/30',
  win: 'text-neon-green bg-neon-green/10 ring-neon-green/30',
  lose: 'text-neon-red bg-neon-red/10 ring-neon-red/30',
  live: 'text-neon-cyan bg-neon-cyan/10 ring-neon-cyan/30',
  active_campaign: 'text-neon-green bg-neon-green/10 ring-neon-green/30',
};

export const badge = (toneKey: string): string =>
  `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusTone[toneKey] ?? 'text-slate-300 bg-ink-700 ring-ink-500'}`;

export const roleTone: Record<string, string> = {
  master_admin: 'text-neon-green bg-neon-green/10 ring-neon-green/30',
  admin: 'text-neon-cyan bg-neon-cyan/10 ring-neon-cyan/30',
  support: 'text-neon-purple bg-neon-purple/10 ring-neon-purple/30',
  viewer: 'text-slate-300 bg-ink-700 ring-ink-500',
};

export const platformIcon: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  x: 'X',
};

export const initials = (name: string): string =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
