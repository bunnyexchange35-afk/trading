import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft, ArrowRight, Award, BadgeCheck, Banknote, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Coins, ExternalLink, Headphones, Info, Link2,
  Lock, LogOut, Menu, MessageCircle, Plus, RefreshCcw, Settings, ShieldCheck,
  Sparkles, Unlock, User, Users, Wallet, X, Zap,
} from 'lucide-react';
import { useApp } from './app-context';
import type { Asset } from './data';

const TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_URL || 'https://t.me/mudrexxearn_support';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Mudrexx Earn home">
      <span className="brand-mark">
        <i />
        <i />
        <i />
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
  ['/market', 'Market'],
  ['/instant-order', 'Instant Order'],
  ['/deposit', 'Deposit'],
] as const;

export function SiteHeader() {
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, openAuth, signOut, notify, openConversionModal } = useApp();

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
      <div className="notice-bar">
        <Sparkles size={14} /> Link Demo to Real Conversion is active: 100 Demo = ₹10 Real Wallet{' '}
        <Link to="/wallet#conversion-desk">Convert now</Link>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav className={`main-nav ${menu ? 'nav-open' : ''}`} aria-label="Main navigation">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
            <div className="mobile-auth">
              {!user ? (
                <>
                  <button className="btn btn-ghost" onClick={() => openAuth('signin')}>
                    Sign in
                  </button>
                  <button className="btn btn-dark" onClick={() => openAuth('signup')}>
                    Register (₹0 Balance)
                  </button>
                </>
              ) : (
                <div className="mobile-user-summary">
                  <span>Balance: ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <Link to="/wallet" className="btn btn-purple btn-sm">
                    Open Wallet
                  </Link>
                </div>
              )}
            </div>
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

            {!user && (
              <button className="text-button signin-button" onClick={() => openAuth('signin')}>
                Sign in
              </button>
            )}
            {!user && (
              <button className="btn btn-dark signup-button" onClick={() => openAuth('signup')}>
                Get started <ArrowRight size={15} />
              </button>
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
            <i /> Binance public market feed
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
            Telegram support <ExternalLink size={13} />
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
      <small>Telegram</small>
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
  const { authMode, closeAuth, authenticate, notify } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authMode) setMode(authMode);
  }, [authMode]);

  if (!authMode) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || 'member@example.com');
    const fullName = String(data.get('name') || email.split('@')[0]);
    const isSignup = mode === 'signup';

    setLoading(true);
    window.setTimeout(() => {
      authenticate({ name: fullName, email }, isSignup);
      notify(
        isSignup ? 'Account registered! 🎉' : 'Welcome back!',
        isSignup
          ? 'Your new account starts with ₹0.00 initial balance. 10,000 demo practice credits are ready for conversion!'
          : 'Your Mudrexx Earn session is active.',
        'success'
      );
      setLoading(false);
      navigate('/wallet');
    }, 450);
  };

  const quickDemoLogin = () => {
    setLoading(true);
    window.setTimeout(() => {
      authenticate(
        { name: 'Demo Trader', email: 'demotrader@mudrexx.com' },
        true
      );
      notify(
        'Demo Trader Active',
        'Registered with ₹0.00 initial balance and 10,000 demo credits.',
        'success'
      );
      setLoading(false);
      navigate('/wallet');
    }, 300);
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
          <span>{mode === 'signup' ? 'New Account Registration' : 'Member Sign In'}</span>
          <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p>
            {mode === 'signin'
              ? 'Sign in to access your wallet, inspect frozen balances, and trade.'
              : 'Register now. New accounts start with ₹0.00 balance and 10,000 practice demo credits.'}
          </p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
            Sign in
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Sign up (₹0 Balance)
          </button>
        </div>

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

        <div className="quick-demo-access-wrap">
          <span className="divider-text">OR FAST ACCESS</span>
          <button type="button" className="btn btn-soft btn-full" onClick={quickDemoLogin} disabled={loading}>
            <Sparkles size={15} /> One-Click Quick Demo Registration <ArrowRight size={14} />
          </button>
        </div>

        <div className="secure-note">
          <ShieldCheck size={17} />
          <span>Persistent session · You will not be asked again once logged in</span>
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

  const handleConvert = (e: FormEvent) => {
    e.preventDefault();
    if (parsed <= 0) {
      notify('Invalid amount', 'Enter demo credits to convert.', 'warning');
      return;
    }
    if (parsed > demoCredits) {
      notify('Insufficient Demo Credits', `Available: ${demoCredits.toLocaleString()}`, 'warning');
      return;
    }
    convertDemoToReal(parsed);
    closeConversionModal();
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
      setElapsed((value) => {
        if (value >= 29) {
          sessionStorage.setItem('mudrexx-intro-seen', '1');
          setVisible(false);
          return 30;
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
  const copy =
    elapsed < 6
      ? ['Your wealth journey begins', 'One wallet. Every opportunity.']
      : elapsed < 14
      ? ['Markets, brought to life', 'Watch value move in real time.']
      : elapsed < 23
      ? ['Open your eyes to possibility', 'Clarity before every decision.']
      : ['Welcome to Mudrexx Earn', 'Trade with confidence. Grow with purpose.'];

  return (
    <div className="entry-experience">
      <div className="entry-aurora" />
      <div className="entry-stars">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="entry-top">
        <Logo light />
        <button onClick={close}>
          Skip intro <ArrowRight size={15} />
        </button>
      </div>
      <div className="entry-content">
        <div className="entry-copy" key={copy[0]}>
          <span>
            <Sparkles size={15} /> THE FUTURE OF YOUR WEALTH
          </span>
          <h1>{copy[0]}</h1>
          <p>{copy[1]}</p>
        </div>
        <div className="wealth-scene" aria-label="Animated wallet opening with a delighted investor">
          <div className="orbit orbit-one">
            <i className="mini-coin">₿</i>
          </div>
          <div className="orbit orbit-two">
            <i className="mini-coin">Ξ</i>
          </div>
          <div className="character">
            <div className="character-hair" />
            <div className="character-head">
              <span className="eye left">
                <i />
              </span>
              <span className="eye right">
                <i />
              </span>
              <span className="character-mouth" />
            </div>
            <div className="character-neck" />
            <div className="character-body">
              <i />
            </div>
          </div>
          <div className="wallet-scene">
            <div className="wealth-rays" />
            <div className="wallet-back">
              <span className="card card-one">M</span>
              <span className="card card-two">
                <BadgeCheck size={18} />
              </span>
            </div>
            <div className="wallet-flap">
              <span className="wallet-button" />
            </div>
            <div className="wallet-front">
              <Logo light />
              <span className="wallet-balance">WEALTH WALLET</span>
            </div>
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className={`flying-coin flying-coin-${index + 1}`}>
                {index % 2 ? '₹' : '₿'}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="entry-progress">
        <span style={{ width: `${(elapsed / 30) * 100}%` }} />
        <small>{30 - elapsed}s</small>
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
