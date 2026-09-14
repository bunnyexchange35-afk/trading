/**
 * Authenticated application shell: sticky top nav, notification centre,
 * account menu, and a mobile bottom bar.
 *
 * The notification bell deliberately does NOT read `unread` from the API —
 * the backend hardcodes that field to 0 (audit F6). Any "new since you last
 * looked" indicator here is session-local and is labelled as such.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChartLine,
  CircleUserRound,
  Coins,
  FileText,
  Grid2x2,
  Layers,
  ListOrdered,
  LogOut,
  MessageSquare,
  Sparkles,
  Star,
  Wallet as WalletIcon,
  Wrench,
} from 'lucide-react';
import { useSession } from '../app/session';
import { getNotifications, type StudentNotification } from '../api';
import { useAsync } from '../hooks/useAsync';
import { Badge, Button, EmptyState, Spinner } from '../components/ui';
import { moneyCompact, whenLabel } from '../utils/format';

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const PRIMARY: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <Grid2x2 size={16} /> },
  { to: '/markets', label: 'Markets', icon: <ChartLine size={16} /> },
  { to: '/trade', label: 'Trade', icon: <Layers size={16} /> },
  { to: '/orders', label: 'Orders', icon: <ListOrdered size={16} /> },
  { to: '/positions', label: 'Positions', icon: <Sparkles size={16} /> },
  { to: '/wallet', label: 'Wallet', icon: <WalletIcon size={16} /> },
  { to: '/earn', label: 'Earn', icon: <Coins size={16} /> },
  { to: '/tasks', label: 'Tasks', icon: <Star size={16} /> },
  { to: '/credit', label: 'Credit', icon: <CircleUserRound size={16} /> },
  { to: '/support', label: 'Support', icon: <Wrench size={16} /> },
];

const SECONDARY: NavItem[] = [
  { to: '/documents', label: 'Documents', icon: <FileText size={16} /> },
  { to: '/nova', label: 'NOVA', icon: <MessageSquare size={16} /> },
  { to: '/account', label: 'Account', icon: <CircleUserRound size={16} /> },
];

const MOBILE: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: <Grid2x2 size={19} /> },
  { to: '/markets', label: 'Markets', icon: <ChartLine size={19} /> },
  { to: '/trade', label: 'Trade', icon: <Layers size={19} /> },
  { to: '/wallet', label: 'Wallet', icon: <WalletIcon size={19} /> },
  { to: '/account', label: 'Account', icon: <CircleUserRound size={19} /> },
];

export function UserShell({ children }: { children: ReactNode }) {
  const { user, email, wallet, signOut } = useSession();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const notifications = useAsync(
    () => getNotifications().then((r) => r.notifications),
    [],
    { enabled: Boolean(email), intervalMs: 60_000 },
  );

  // Session-local "seen" set — the backend has no read/unread state (F6).
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const fresh = useMemo(
    () => (notifications.data ?? []).filter((n) => !seen.has(n.id)).length,
    [notifications.data, seen],
  );

  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setNotifOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifOpen]);

  const closePopovers = () => {
    setNotifOpen(false);
    setMenuOpen(false);
    // Mark everything currently listed as seen for this browser session.
    setSeen(new Set((notifications.data ?? []).map((n) => n.id)));
  };

  const onSignOut = () => {
    signOut();
    navigate('/auth/login', { replace: true });
  };

  const initial = (user?.name || email || '?').trim()[0]?.toUpperCase() ?? '?';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" to="/dashboard" aria-label="Mudrexx Earn home">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <span className="brand-text">
              <span className="brand-name">MUDREXX EARN</span>
              <span className="brand-tag">A Way to Earn in Real Life</span>
            </span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            {PRIMARY.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav-right">
            {wallet && (
              <Link className="nav-balance" to="/wallet" title="Available balance">
                <WalletIcon size={14} aria-hidden="true" />
                <span>{moneyCompact(wallet.realBalance, 'INR')}</span>
              </Link>
            )}

            <div style={{ position: 'relative' }} ref={popoverRef}>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => {
                  setMenuOpen(false);
                  setNotifOpen((v) => !v);
                }}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                aria-label={`Notifications${fresh > 0 ? `, ${fresh} new this session` : ''}`}
              >
                <Bell size={17} />
                {fresh > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--brand)',
                    }}
                  />
                )}
              </button>

              {notifOpen && (
                <div className="pop" role="dialog" aria-label="Notifications">
                  <div className="pop-head">
                    <strong className="small">Notifications</strong>
                    <Badge tone="neutral">last {(notifications.data ?? []).length}</Badge>
                  </div>
                  <div className="pop-list">
                    {notifications.loading && !notifications.data && (
                      <div className="empty" style={{ padding: 'var(--sp-6)' }}>
                        <Spinner />
                      </div>
                    )}
                    {notifications.unavailable && (
                      <div className="empty">
                        <EmptyState
                          title="Not available here"
                          body="This deployment does not serve notifications."
                        />
                      </div>
                    )}
                    {!notifications.loading && notifications.data?.length === 0 && (
                      <div className="empty">
                        <EmptyState icon={<Bell size={20} />} title="Nothing yet" body="Order, task and support activity will appear here." />
                      </div>
                    )}
                    {notifications.data?.map((item: StudentNotification) => (
                      <button
                        key={item.id}
                        className="pop-item"
                        onClick={() => navigate(kindToRoute(item.kind))}
                      >
                        <Badge tone={item.kind === 'order' ? 'open' : item.kind === 'task' ? 'brand' : 'neutral'}>
                          {item.kind}
                        </Badge>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="small strong" style={{ display: 'block' }}>
                            {item.title}
                          </span>
                          <span className="xs faint" style={{ display: 'block' }}>
                            {item.message}
                          </span>
                          <span className="xs faint">{whenLabel(item.at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="card-foot xs faint" style={{ textAlign: 'center' }}>
                    Newest 10 only · “new” is tracked in this browser session
                  </div>
                </div>
              )}

              {menuOpen && (
                <div className="pop" role="menu" aria-label="Account">
                  <div className="pop-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="small strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.name || 'Account'}
                      </div>
                      <div className="xs faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {email}
                      </div>
                    </div>
                  </div>
                  {SECONDARY.map((item) => (
                    <Link key={item.to} to={item.to} className="menu-item" role="menuitem" onClick={closePopovers}>
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                  <button className="menu-item" role="menuitem" onClick={onSignOut}>
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              className="avatar"
              onClick={() => {
                setNotifOpen(false);
                setMenuOpen((v) => !v);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              {initial}
            </button>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <nav className="mobile-nav" aria-label="Primary mobile">
        <div className="mobile-nav-inner">
          {MOBILE.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive ? 'mobile-nav-link-active' : ''}`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

function kindToRoute(kind: string): string {
  if (kind === 'order') return '/orders';
  if (kind === 'task') return '/tasks';
  if (kind === 'support' || kind === 'withdrawal') return '/support';
  if (kind === 'wallet' || kind === 'deposit') return '/wallet';
  if (kind === 'credit') return '/credit';
  return '/dashboard';
}

export function ShellButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}
