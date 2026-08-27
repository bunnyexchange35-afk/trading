import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownLeft, ArrowRight, Award, BadgeCheck, Banknote, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Coins, ExternalLink, Headphones, Info, Link2,
  ListChecks, Lock, LogOut, Menu, MessageCircle, Plus, RefreshCcw, Settings, ShieldCheck,
  Sparkles, Unlock, User, Users, Wallet, X, Zap,
} from 'lucide-react';
import { useApp } from './app-context';
import type { Asset } from './data';

const TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_URL || 'https://t.me/MEDRIXEARN';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Mudrexx Earn home">
      <span className="brand-mark">
        <svg className="brand-mark-svg" viewBox="0 0 44 44" aria-hidden="true">
          <defs>
            <linearGradient id="mx-logo-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#D9FF57" />
              <stop offset="1" stopColor="#2FE0A1" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#0B0F0D" stroke="#262E29" strokeWidth="1.5" />
          <path
            d="M11 30V15l5.6 9L22 15v15"
            fill="none"
            stroke="url(#mx-logo-grad)"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M26.4 19l5.6-5.6M32 13.4h-4.7M32 13.4v4.7"
            fill="none"
            stroke="#D9FF57"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="33" cy="26.8" r="4.6" fill="url(#mx-logo-grad)" />
          <path
            d="M31.2 26.9l1.3 1.7 2-3.2"
            fill="none"
            stroke="#0B0F0D"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="brand-copy">
        <b>Mudrexx</b>
        <em>Earn</em>
      </span>
    </Link>
  );
}

export function CoinIcon({ asset, size = 'md' }: { asset: Asset; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`coin-icon coin-${size}`} style={{ color: asset.color, background: asset.soft }}>
      {asset.mark}
    </span>
  );
}

const links = [
  ['/', 'Home'],
  ['/trading', 'Trading'],
  ['/instant-order', 'Instant Order'],
  ['/deposit', 'Deposit'],
  ['/tasks', 'Tasks'],
  ['/orders', 'Orders'],
] as const;

export function SiteHeader() {
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, openAuth, signOut, notify, openConversionModal, accessRequired, backendContract, accessType } = useApp();

  useEffect(() => {
    setMenu(false);
    setProfile(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfile(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const logout = () => {
    signOut();
    setProfile(false);
    notify('Signed out', 'You have been safely signed out.', 'info');
  };

  const totalNet = user ? user.wallet.realBalance + user.wallet.frozenBalance : 0;
  const frozen = user ? user.wallet.frozenBalance : 0;
  const demoCredits = user ? user.wallet.demoBalance : 0;

  return (
    <>
      {accessRequired || backendContract === 'v2' ? (
        <div className={`notice-bar ${accessRequired ? 'notice-private' : 'notice-v2'}`}>
          <Lock size={14} />
          {accessRequired
            ? 'Live mudrexxback is in private mode. Open a V2 source/access link or paste a code to continue.'
            : `Connected to V2 mudrexx-control (${accessType}). Earn wallet calls stay gated until the V2 contract exposes them.`}
          {accessRequired && (
            <button type="button" onClick={() => openAuth('signin')}>
              Enter access
            </button>
          )}
        </div>
      ) : (
        <div className="notice-bar">
          <Sparkles size={14} /> Link Demo to Real Conversion is active: 100 Demo = ₹10 Real Wallet{' '}
          <Link to="/wallet#conversion-desk">Convert now</Link>
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav className={`main-nav ${menu ? 'nav-open' : ''}`} aria-label="Main navigation">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            {user && (
              <div className="header-balance-pill">
                <Link to="/wallet" className="header-balance-link" title="Open Wallet">
                  <span className="balance-label">WALLET</span>
                  <strong>₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  {frozen > 0 && <span className="header-frozen-tag">🔒 ₹{frozen.toLocaleString()}</span>}
                </Link>
                <button
                  type="button"
                  className="header-convert-quick"
                  onClick={openConversionModal}
                  title="Convert Demo Credits to Real INR"
                >
                  <RefreshCcw size={13} />
                  <span>Convert Demo</span>
                </button>
              </div>
            )}

            <div className="profile-wrap" ref={profileRef}>
              <button
                className={`profile-button ${user ? 'profile-active' : ''}`}
                onClick={() => setProfile((value) => !value)}
                aria-label="Open profile menu"
                aria-expanded={profile}
              >
                {user ? user.name.slice(0, 1).toUpperCase() : <User size={18} />}
                <ChevronDown size={13} />
              </button>
              {profile && (
                <div className="profile-menu panel-pop">
                  <div className="profile-summary">
                    <span className="avatar">
                      {user ? user.name.slice(0, 1).toUpperCase() : <User size={18} />}
                    </span>
                    <div>
                      <strong>{user?.name || 'Welcome'}</strong>
                      <small>{user?.email || 'Sign in to access your account'}</small>
                    </div>
                  </div>

                  {user && (
                    <div className="profile-balance-breakdown">
                      <div className="profile-stat-row">
                        <span>Real Available:</span>
                        <b>₹{user.wallet.realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                      </div>
                      <div className="profile-stat-row">
                        <span>Frozen Amount:</span>
                        <b className={frozen > 0 ? 'text-amber' : ''}>
                          ₹{user.wallet.frozenBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </b>
                      </div>
                      <div className="profile-stat-row">
                        <span>Demo Credits:</span>
                        <b className="text-purple">{demoCredits.toLocaleString()} DEMO</b>
                      </div>
                      <button
                        type="button"
                        className="profile-convert-btn"
                        onClick={() => {
                          setProfile(false);
                          openConversionModal();
                        }}
                      >
                        <RefreshCcw size={13} /> Convert Demo to Real
                      </button>
                    </div>
                  )}

                  {!user && (
                    <button className="profile-login" onClick={() => openAuth('signin')}>
                      Sign in or register <ArrowRight size={15} />
                    </button>
                  )}
                  <ProfileLink to="/profile" icon={<Settings size={17} />} label="Profile settings" />
                  <ProfileLink
                    to="/wallet"
                    icon={<Wallet size={17} />}
                    label="Wallet & Balances"
                    badge={frozen > 0 ? `🔒 ₹${frozen.toLocaleString()}` : undefined}
                  />
                  <ProfileLink to="/orders" icon={<Activity size={17} />} label="Order history" />
                  <ProfileLink to="/tasks" icon={<ListChecks size={17} />} label="My tasks" />
                  <ProfileLink to="/deposit" icon={<ArrowDownLeft size={17} />} label="Deposit funds" />
                  <ProfileLink to="/support" icon={<Headphones size={17} />} label="Support" />
                  <ProfileLink to="/community" icon={<Users size={17} />} label="Community" />
                  {user && (
                    <button className="profile-row danger" onClick={logout}>
                      <LogOut size={17} /> Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              className="menu-button"
              onClick={() => setMenu((value) => !value)}
              aria-label="Toggle navigation"
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

function ProfileLink({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <Link className="profile-row" to={to}>
      {icon}
      <span>{label}</span>
      {badge && <span className="profile-link-badge">{badge}</span>}
      <ArrowRight size={14} />
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>A clear, modern way to follow crypto markets, practise trading decisions, and convert demo gains.</p>
          <span className="feed-badge">
            <i /> Coinbase live market feed
          </span>
        </div>
        <div>
          <h4>Products</h4>
          <Link to="/market">Markets</Link>
          <Link to="/instant-order">Instant order</Link>
          <Link to="/deposit">Deposit</Link>
          <Link to="/wallet#conversion-desk">Demo to Real Convert</Link>
        </div>
        <div>
          <h4>Company</h4>
          <Link to="/support">Support</Link>
          <Link to="/community">Community</Link>
          <Link to="/profile">Account</Link>
          <Link to="/wallet">Wallet desk</Link>
        </div>
        <div>
          <h4>Stay secure</h4>
          <p className="footer-small">
            <ShieldCheck size={16} /> Never share your password, OTP, or wallet recovery phrase.
          </p>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            Telegram @MEDRIXEARN <ExternalLink size={13} />
          </a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Mudrexx Earn</span>
        <span>Crypto assets are volatile. Demo conversion and practice credits are for simulated learning.</span>
      </div>
    </footer>
  );
}

export function ContactButton() {
  return (
    <a
      className="contact-button"
      href={TELEGRAM_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Contact us on Telegram"
    >
      <MessageCircle size={20} />
      <span>Contact us</span>
      <small>@MEDRIXEARN</small>
    </a>
  );
}

export function PageHero({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="container">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        {children}
      </div>
    </section>
  );
}

export function AuthModal() {
  const { authMode, closeAuth, authenticate, notify, accessRequired, backendContract, redeemAccess, syncing } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [accessInput, setAccessInput] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (authMode) setMode(authMode);
  }, [authMode]);

  if (!authMode) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || 'member@example.com');
    const fullName = String(data.get('name') || email.split('@')[0]);
    const inviteCode = String(data.get('inviteCode') || '').trim();
    const isSignup = mode === 'signup';

    setLoading(true);
    try {
      await authenticate({ name: fullName, email, inviteCode }, isSignup);
      notify(
        isSignup ? 'Account registered! 🎉' : 'Welcome back!',
        isSignup
          ? 'Your new account starts with ₹0.00 initial balance. 10,000 demo practice credits are ready for conversion!'
          : 'Your Mudrexx Earn session is active.',
        'success'
      );
      navigate('/wallet');
    } catch {
      /* the context already surfaced the backend error */
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async () => {
    setLoading(true);
    try {
      await authenticate(
        { name: 'Demo Trader', email: 'demotrader@mudrexx.com' },
        true
      );
      notify(
        'Demo Trader Active',
        'Registered with ₹0.00 initial balance and 10,000 demo credits.',
        'success'
      );
      navigate('/wallet');
    } catch {
      /* the context already surfaced the backend error */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Authentication">
      <button className="modal-backdrop" onClick={closeAuth} aria-label="Close" />
      <div className="auth-modal">
        <button className="modal-close" onClick={closeAuth}>
          <X size={20} />
        </button>
        <Logo />
        <div className="auth-heading">
          <span>
            {accessRequired || backendContract === 'v2'
              ? 'Private desk'
              : mode === 'signup'
                ? 'New Account Registration'
                : 'Member Sign In'}
          </span>
          <h2>
            {accessRequired
              ? 'Access required'
              : mode === 'signin'
                ? 'Welcome back'
                : 'Create your account'}
          </h2>
          <p>
            {accessRequired
              ? 'The live backend is V2 mudrexx-control in private mode. Use a source/access link (/a/… or /s/…) or paste the code below. Old Earn register/login calls return ACCESS_REQUIRED.'
              : mode === 'signin'
                ? 'Sign in to access your wallet, inspect frozen balances, and trade.'
                : 'Register now. New accounts start with ₹0.00 balance and 10,000 practice demo credits.'}
          </p>
        </div>

        {(accessRequired || backendContract === 'v2') && (
          <form
            className="auth-form access-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setLoading(true);
              try {
                const ok = await redeemAccess(accessInput);
                if (ok) {
                  closeAuth();
                  navigate('/');
                }
              } finally {
                setLoading(false);
              }
            }}
          >
            <label>
              V2 source / access link
              <input
                value={accessInput}
                onChange={(event) => setAccessInput(event.target.value)}
                placeholder="/a/your-access-code or full URL"
                autoComplete="off"
                required
              />
            </label>
            <button className="btn btn-purple btn-full" disabled={loading || syncing}>
              {loading || syncing ? 'Redeeming access…' : 'Redeem access'} <ArrowRight size={16} />
            </button>
          </form>
        )}

        {!accessRequired && (
        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Sign up (₹0 Balance)
          </button>
        </div>
        )}

        {!accessRequired && (
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Full name
              <input name="name" placeholder="Your full name" required />
            </label>
          )}
          <label>
            Email address
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          {mode === 'signup' && (
            <label>
              Invitation code
              <span className="label-hint">Assigned to you</span>
              <input
                name="inviteCode"
                placeholder="Enter your assigned code"
                autoComplete="off"
                required
              />
            </label>
          )}
          <label>
            Password
            <span className="label-hint">8+ characters</span>
            <input name="password" type="password" placeholder="Enter your password" minLength={8} required />
          </label>

          {mode === 'signup' && (
            <div className="auth-signup-notice">
              <Sparkles size={14} />
              <span>
                <strong>Zero Initial Balance Policy:</strong> New accounts are initialized with ₹0.00 Real Balance. You receive 10,000 Demo Practice Credits that you can convert to real INR anytime!
              </span>
            </div>
          )}

          {mode === 'signup' && (
            <label className="check-row">
              <input type="checkbox" required />{' '}
              <span>I agree to the Terms and acknowledge crypto market risk.</span>
            </label>
          )}

          <button className="btn btn-purple btn-full" disabled={loading}>
            {loading ? 'Securing your session…' : mode === 'signin' ? 'Sign in securely' : 'Create my account (₹0 balance)'}{' '}
            <ArrowRight size={16} />
          </button>
        </form>
        )}

        {!accessRequired && (
        <div className="quick-demo-access-wrap">
          <span className="divider-text">OR FAST ACCESS</span>
          <button type="button" className="btn btn-soft btn-full" onClick={quickDemoLogin} disabled={loading}>
            <Sparkles size={15} /> One-Click Quick Demo Registration <ArrowRight size={14} />
          </button>
        </div>
        )}

        <div className="secure-note">
          <ShieldCheck size={17} />
          <span>{accessRequired ? 'V2 private mode · source/access links grant the session cookie' : 'Persistent session · You will not be asked again once logged in'}</span>
        </div>
      </div>
    </div>
  );
}

export function ConversionModal() {
  const { user, isConversionOpen, closeConversionModal, convertDemoToReal, claimDemoCredits, notify } = useApp();
  const [amount, setAmount] = useState('1000');

  if (!isConversionOpen || !user) return null;

  const demoCredits = user.wallet.demoBalance;
  const realBalance = user.wallet.realBalance;
  const rate = user.wallet.conversionRate || 0.1;
  const parsed = Math.max(0, Number(amount) || 0);
  const gain = Math.round(parsed * rate * 100) / 100;

  const handleConvert = async (e: FormEvent) => {
    e.preventDefault();
    if (parsed <= 0) {
      notify('Invalid amount', 'Enter demo credits to convert.', 'warning');
      return;
    }
    if (parsed > demoCredits) {
      notify('Insufficient Demo Credits', `Available: ${demoCredits.toLocaleString()}`, 'warning');
      return;
    }
    const result = await convertDemoToReal(parsed);
    if (result.success) closeConversionModal();
  };

  const setPercent = (pct: number) => {
    setAmount(String(Math.floor((demoCredits * pct) / 100)));
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Demo to Real Conversion">
      <button className="modal-backdrop" onClick={closeConversionModal} aria-label="Close" />
      <div className="auth-modal conversion-modal-box">
        <button className="modal-close" onClick={closeConversionModal}>
          <X size={20} />
        </button>
        <div className="auth-heading">
          <span className="eyebrow"><Link2 size={13} /> LINK DEMO TO REAL</span>
          <h2>Convert Demo Credits to Real ₹</h2>
          <p>Bridge practice profits and demo credits directly into your Real Wallet available balance.</p>
        </div>

        <div className="modal-balance-status-row">
          <div>
            <small>DEMO PRACTICE CREDITS</small>
            <strong>{demoCredits.toLocaleString()} DEMO</strong>
          </div>
          <div className="rate-bubble">100 DEMO = ₹10 REAL</div>
          <div>
            <small>CURRENT REAL BALANCE</small>
            <strong>₹{realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <form onSubmit={handleConvert} className="auth-form">
          <label>
            <span>Amount of Demo Credits to Convert</span>
            <div className="large-amount">
              <Coins size={18} />
              <input
                type="number"
                min="10"
                max={demoCredits}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter demo credits"
                required
              />
              <em>DEMO</em>
            </div>
          </label>

          <div className="amount-suggestions">
            <button type="button" onClick={() => setPercent(25)}>25%</button>
            <button type="button" onClick={() => setPercent(50)}>50%</button>
            <button type="button" onClick={() => setPercent(75)}>75%</button>
            <button type="button" onClick={() => setPercent(100)}>100% (MAX)</button>
          </div>

          <div className="gain-preview-callout">
            <Banknote size={20} />
            <div>
              <small>REAL WALLET VALUE TO RECEIVE</small>
              <strong>+₹{gain.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR</strong>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-purple btn-full btn-lg"
            disabled={parsed <= 0 || parsed > demoCredits}
          >
            <Link2 size={16} /> Convert & Credit to Real Wallet <ArrowRight size={16} />
          </button>
        </form>

        <div className="modal-claim-footer">
          <span>Need more practice credits?</span>
          <button type="button" onClick={() => claimDemoCredits(5000)}>
            <Sparkles size={13} /> Claim +5,000 Demo Credits
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastStack() {
  const { notices, dismiss } = useApp();
  return (
    <div className="toast-stack">
      {notices.map((notice) => (
        <div key={notice.id} className={`toast toast-${notice.tone}`}>
          <span>
            {notice.tone === 'success' ? (
              <CheckCircle2 />
            ) : notice.tone === 'warning' ? (
              <CircleHelp />
            ) : (
              <Zap />
            )}
          </span>
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
          <button onClick={() => dismiss(notice.id)}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function EntryExperience() {
  const [visible, setVisible] = useState(() => sessionStorage.getItem('mudrexx-intro-seen') !== '1');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const replay = () => {
      setElapsed(0);
      setVisible(true);
    };
    window.addEventListener('replay-intro', replay);
    return () => window.removeEventListener('replay-intro', replay);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => {
      // A backgrounded tab must not spend its CPU budget (or the user's
      // attention) on the intro — the countdown simply waits.
      if (document.visibilityState !== 'visible') return;
      setElapsed((value) => {
        if (value >= 9) {
          sessionStorage.setItem('mudrexx-intro-seen', '1');
          setVisible(false);
          return 10;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [visible]);

  const close = () => {
    sessionStorage.setItem('mudrexx-intro-seen', '1');
    setVisible(false);
  };

  if (!visible) return null;

  const phase = elapsed < 3 ? 0 : elapsed < 6 ? 1 : elapsed < 8 ? 2 : 3;
  const copy = [
    ['Savings', 'Simple, Safe, Current Deposit, Earn Interest Immediately'],
    ['Markets, brought to life', 'Spot, Futures, Staking — live Coinbase feeds in one desk.'],
    ['Trade with confidence', 'Practice now, then convert demo winnings into real INR.'],
    ['Welcome to Mudrexx Earn', 'Your exchange journey begins here.'],
  ][phase];

  return (
    <div className="entry-experience exchange-intro">
      <div className="exchange-backdrop">
        <div className="exchange-grid" />
        <div className="exchange-glow glow-blue" />
        <div className="exchange-glow glow-pink" />
      </div>

      <div className="exchange-topbar">
        <Logo light />
        <div className="exchange-nav-pills" aria-hidden="true">
          <span className="active">Dashboard</span>
          <span>DEX Swap</span>
          <span>Dev Loan</span>
          <span>Buy &amp; Sell</span>
          <span>Charts</span>
        </div>
        <span className="exchange-connected">
          <i /> Connected
        </span>
        <button onClick={close}>
          Skip intro <ArrowRight size={15} />
        </button>
      </div>

      <div className="exchange-center">
        <section className="exchange-showcase">
          <div className="exchange-copy" key={copy[0]}>
            <span className="exchange-eyebrow">
              <Sparkles size={14} /> MUDREXX EXCHANGE
            </span>
            <h1>{copy[0]}</h1>
            <p>{copy[1]}</p>
            <div className={`exchange-cta ${phase === 3 ? 'show' : ''}`}>
              <span>Claim Trial Funds</span>
              <ArrowRight size={16} />
            </div>
          </div>

          <div className="exchange-card-scene" aria-label="Floating Mudrexx exchange card with live chart">
            <span className="exchange-coin coin-btc">₿</span>
            <span className="exchange-coin coin-eth">Ξ</span>
            <span className="exchange-chip chip-1">BTC +2.4%</span>
            <span className="exchange-chip chip-2">ETH +1.5%</span>
            <span className="exchange-chip chip-3">₹10,000 DEMO</span>

            <div className="exchange-card">
              <div className="exchange-card-top">
                <Logo light />
                <span className="exchange-card-chip" />
              </div>
              <div className="exchange-card-screen">
                <span className="screen-tag">MUDREXX / LIVE</span>
                <svg className="screen-chart" viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    className="chart-grid"
                    d="M0 20H240M0 40H240M0 60H240M30 0V80M90 0V80M150 0V80M210 0V80"
                  />
                  <path className="chart-area" d="M0 64 L18 58 L36 66 L54 44 L72 52 L90 32 L108 40 L126 22 L144 36 L162 18 L180 30 L198 12 L216 24 L240 16 L240 80 L0 80 Z" />
                  <path className="chart-line" d="M0 64 L18 58 L36 66 L54 44 L72 52 L90 32 L108 40 L126 22 L144 36 L162 18 L180 30 L198 12 L216 24 L240 16" />
                  <circle className="chart-dot" cx="198" cy="12" r="3" />
                </svg>
                <div className="screen-stats">
                  <span><b>BTC/USDT</b><em>₹4,82,410</em></span>
                  <span className="up">+2.4%</span>
                  <span className="screen-pulse" />
                </div>
              </div>
              <div className="exchange-card-bottom">
                <span>•••• 8842</span>
                <span>MUDREXX</span>
              </div>
            </div>
          </div>
        </section>

        <div className="exchange-ticker" aria-hidden="true">
          <span><i>BTC</i> ₹4,82,410 <b className="up">+2.4%</b></span>
          <span><i>ETH</i> ₹2,05,113 <b className="up">+1.5%</b></span>
          <span><i>USDT</i> ₹83.21 <b className="up">+0.1%</b></span>
          <span><i>SOL</i> ₹1,44,890 <b className="down">-0.8%</b></span>
        </div>
      </div>

      <div className="entry-progress exchange-progress">
        <span style={{ width: `${(elapsed / 10) * 100}%` }} />
        <small>{10 - elapsed}s</small>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Wallet size={22} />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}
