import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, CandlestickChart, Target, Megaphone,
  Share2, Filter, MessageSquareText, Mail, BellRing, Globe, FileText,
  Bot, ScrollText, Settings, ShieldAlert, Menu, X, LogOut, Search,
  Lock, Unlock, ChevronDown,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';
import { fmtDateTime, initials, roleTone } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  perm: string;
  end?: boolean;
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, perm: 'dashboard.view', end: true }],
  },
  {
    group: 'Control',
    items: [
      { to: '/users', label: 'Users', icon: <Users className="h-4 w-4" />, perm: 'users.view' },
      { to: '/balances', label: 'Balances', icon: <Wallet className="h-4 w-4" />, perm: 'users.view' },
      { to: '/orders', label: 'Orders', icon: <CandlestickChart className="h-4 w-4" />, perm: 'orders.view' },
    ],
  },
  {
    group: 'CRM & Marketing',
    items: [
      { to: '/leads', label: 'Leads', icon: <Target className="h-4 w-4" />, perm: 'leads.view' },
      { to: '/campaigns', label: 'Campaigns', icon: <Megaphone className="h-4 w-4" />, perm: 'campaigns.view' },
      { to: '/social', label: 'Social Media', icon: <Share2 className="h-4 w-4" />, perm: 'social.view' },
      { to: '/segments', label: 'Segments', icon: <Filter className="h-4 w-4" />, perm: 'segments.view' },
    ],
  },
  {
    group: 'Communication',
    items: [
      { to: '/chat', label: 'Chat Support', icon: <MessageSquareText className="h-4 w-4" />, perm: 'chats.manage' },
      { to: '/email', label: 'Email Center', icon: <Mail className="h-4 w-4" />, perm: 'emails.view' },
      { to: '/popups', label: 'Pop-ups', icon: <BellRing className="h-4 w-4" />, perm: 'popups.view' },
    ],
  },
  {
    group: 'Content',
    items: [
      { to: '/website', label: 'Website Editor', icon: <Globe className="h-4 w-4" />, perm: 'website.view' },
      { to: '/agreements', label: 'Agreements', icon: <FileText className="h-4 w-4" />, perm: 'agreements.view' },
    ],
  },
  {
    group: 'Intelligence',
    items: [{ to: '/ai', label: 'AI Assistant', icon: <Bot className="h-4 w-4" />, perm: 'ai.use' }],
  },
  {
    group: 'System',
    items: [
      { to: '/logs', label: 'Logs & Security', icon: <ScrollText className="h-4 w-4" />, perm: 'logs.view' },
      { to: '/settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, perm: 'logs.view' },
    ],
  },
];

export default function Layout() {
  const { staff, lockdown, can, logout, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifs, setNotifs] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    api.get<{ data: Array<Record<string, unknown>> }>('/system/notifications')
      .then((r) => setNotifs(r.data))
      .catch(() => undefined);
  }, []);

  const doLockdown = async () => {
    try {
      const r = await api.post<{ data: { lockdown: boolean } }>('/auth/lockdown/toggle');
      await refresh();
      toast.push(r.data.lockdown ? 'error' : 'success', r.data.lockdown ? '🔒 Emergency lockdown ACTIVE' : 'Lockdown lifted');
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed to toggle lockdown');
    }
  };

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/users?q=${encodeURIComponent(query.trim())}`);
  };

  const navGroups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(i.perm)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-600/70 bg-ink-900/95 backdrop-blur transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-600/70 px-4">
          <Logo />
          <button className="text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((g) => (
            <div key={g.group} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-neon-green/10 text-neon-green shadow-[inset_0_0_0_1px_rgba(34,255,154,0.25)]'
                            : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100'
                        }`
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-ink-600/70 p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-ink-800/60 p-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple text-xs font-bold text-ink-950">
              {initials(staff?.full_name ?? '?')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">{staff?.full_name}</p>
              <p className="truncate text-[11px] text-slate-500">{staff?.role.replace('_', ' ')}</p>
            </div>
            <button onClick={doLogout} title="Sign out" className="text-slate-500 transition hover:text-neon-red">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-600/70 bg-ink-900/80 px-4 backdrop-blur sm:px-6">
          <button className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={onSearch} className="relative hidden max-w-xs flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="hcc-input pl-9"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            {can('lockdown.manage') && (
              <button
                onClick={doLockdown}
                title="Emergency lockdown"
                className={`hcc-btn border text-xs ${lockdown ? 'border-neon-red/50 bg-neon-red/15 text-neon-red' : 'border-ink-500 bg-ink-800/40 text-slate-300 hover:border-neon-red/40 hover:text-neon-red'}`}
              >
                {lockdown ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{lockdown ? 'Unlock' : 'Lockdown'}</span>
              </button>
            )}

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-lg border border-ink-600 bg-ink-800/40 p-2 text-slate-400 transition hover:text-white"
              >
                <BellRing className="h-4 w-4" />
                {notifs.some((n) => !n.read) && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-neon-red" />
                )}
              </button>
              {notifOpen && (
                <div className="glass absolute right-0 mt-2 w-72 overflow-hidden border-ink-500 bg-ink-850/95 p-1 shadow-card">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Notifications</p>
                  {notifs.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Nothing new</p>}
                  {notifs.slice(0, 8).map((n) => (
                    <div key={String(n.id)} className="rounded-md px-3 py-2 hover:bg-ink-800">
                      <p className="text-sm text-slate-200">{String(n.title)}</p>
                      <p className="text-xs text-slate-500">{String(n.body ?? '')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userRef}>
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800/40 px-2 py-1.5 transition hover:border-ink-500"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple text-[11px] font-bold text-ink-950">
                  {initials(staff?.full_name ?? '?')}
                </span>
                <span className="hidden text-sm font-medium text-slate-200 md:block">{staff?.full_name.split(' ')[0]}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
              {userOpen && staff && (
                <div className="glass absolute right-0 mt-2 w-72 overflow-hidden border-ink-500 bg-ink-850/95 p-2 shadow-card">
                  <div className="border-b border-ink-600/70 px-2 pb-2">
                    <p className="text-sm font-semibold text-slate-100">{staff.full_name}</p>
                    <p className="text-xs text-slate-500">{staff.email}</p>
                    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleTone[staff.role]}`}>
                      <ShieldAlert className="h-3 w-3" /> {staff.role.replace('_', ' ')}
                    </span>
                  </div>
                  <dl className="space-y-1.5 px-2 pt-2 text-xs">
                    <div className="flex justify-between"><dt className="text-slate-500">Last login</dt><dd className="text-slate-300">{fmtDateTime(staff.last_login_at)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">IP</dt><dd className="font-mono text-slate-300">{staff.last_login_ip}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Location</dt><dd className="text-slate-300">{staff.last_login_location}</dd></div>
                  </dl>
                  <button onClick={doLogout} className="hcc-btn-danger mt-3 w-full">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {lockdown && (
          <div className="flex items-center gap-2 border-b border-neon-red/40 bg-neon-red/10 px-4 py-2 text-sm text-neon-red">
            <ShieldAlert className="h-4 w-4" />
            <span className="font-semibold">EMERGENCY LOCKDOWN ACTIVE</span>
            <span className="hidden text-neon-red/80 sm:inline">— all user-facing actions are frozen.</span>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
