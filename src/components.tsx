import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, CheckCircle2, ChevronDown, CircleHelp, Clock3, ExternalLink,
  Headphones, LogOut, Menu, MessageCircle, Settings, ShieldCheck, Sparkles, User, Users,
  Wallet, X, Zap,
} from 'lucide-react';
import { useApp } from './app-context';
import type { Asset } from './data';

const TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_URL || 'https://t.me/mudrexxearn_support';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Mudrexx Earn home">
      <span className="brand-mark"><i /><i /><i /></span>
      <span className="brand-copy"><b>Mudrexx</b><em>Earn</em></span>
    </Link>
  );
}

export function CoinIcon({ asset, size = 'md' }: { asset: Asset; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`coin-icon coin-${size}`} style={{ color: asset.color, background: asset.soft }}>{asset.mark}</span>;
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
  const { user, openAuth, signOut, notify } = useApp();

  useEffect(() => { setMenu(false); setProfile(false); }, [location.pathname]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfile(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const logout = () => {
    signOut();
    setProfile(false);
    notify('Signed out', 'You have been safely signed out.', 'info');
  };

  return (
    <>
      <div className="notice-bar"><Sparkles size={14} /> New: Flexible Earn vaults are now available <Link to="/market?tab=staking">Explore earn</Link></div>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav className={`main-nav ${menu ? 'nav-open' : ''}`} aria-label="Main navigation">
            {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
            <div className="mobile-auth">
              {!user && <><button className="btn btn-ghost" onClick={() => openAuth('signin')}>Sign in</button><button className="btn btn-dark" onClick={() => openAuth('signup')}>Create account</button></>}
            </div>
          </nav>
          <div className="header-actions">
            {!user && <button className="text-button signin-button" onClick={() => openAuth('signin')}>Sign in</button>}
            {!user && <button className="btn btn-dark signup-button" onClick={() => openAuth('signup')}>Get started <ArrowRight size={15} /></button>}
            <div className="profile-wrap" ref={profileRef}>
              <button className={`profile-button ${user ? 'profile-active' : ''}`} onClick={() => setProfile((value) => !value)} aria-label="Open profile menu" aria-expanded={profile}>
                {user ? user.name.slice(0, 1).toUpperCase() : <User size={18} />}<ChevronDown size={13} />
              </button>
              {profile && (
                <div className="profile-menu panel-pop">
                  <div className="profile-summary">
                    <span className="avatar">{user ? user.name.slice(0, 1).toUpperCase() : <User size={18} />}</span>
                    <div><strong>{user?.name || 'Welcome'}</strong><small>{user?.email || 'Sign in to access your account'}</small></div>
                  </div>
                  {!user && <button className="profile-login" onClick={() => openAuth('signin')}>Sign in or create account <ArrowRight size={15} /></button>}
                  <ProfileLink to="/profile" icon={<Settings size={17} />} label="Profile settings" />
                  <ProfileLink to="/wallet" icon={<Wallet size={17} />} label="Wallet" />
                  <ProfileLink to="/support" icon={<Headphones size={17} />} label="Support" />
                  <ProfileLink to="/community" icon={<Users size={17} />} label="Community" />
                  {user && <button className="profile-row danger" onClick={logout}><LogOut size={17} /> Sign out</button>}
                </div>
              )}
            </div>
            <button className="menu-button" onClick={() => setMenu((value) => !value)} aria-label="Toggle navigation">{menu ? <X /> : <Menu />}</button>
          </div>
        </div>
      </header>
    </>
  );
}

function ProfileLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return <Link className="profile-row" to={to}>{icon}<span>{label}</span><ArrowRight size={14} /></Link>;
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand"><Logo light /><p>A clear, modern way to follow crypto markets and practise trading decisions.</p><span className="feed-badge"><i /> Binance public market feed</span></div>
        <div><h4>Products</h4><Link to="/market">Markets</Link><Link to="/instant-order">Instant order</Link><Link to="/deposit">Deposit</Link></div>
        <div><h4>Company</h4><Link to="/support">Support</Link><Link to="/community">Community</Link><Link to="/profile">Account</Link></div>
        <div><h4>Stay secure</h4><p className="footer-small"><ShieldCheck size={16} /> Never share your password, OTP, or wallet recovery phrase.</p><a href={TELEGRAM_URL} target="_blank" rel="noreferrer">Telegram support <ExternalLink size={13} /></a></div>
      </div>
      <div className="container footer-bottom"><span>© 2026 Mudrexx Earn</span><span>Crypto assets are volatile. Nothing on this site is investment advice.</span></div>
    </footer>
  );
}

export function ContactButton() {
  return <a className="contact-button" href={TELEGRAM_URL} target="_blank" rel="noreferrer" aria-label="Contact us on Telegram"><MessageCircle size={20} /><span>Contact us</span><small>Telegram</small></a>;
}

export function PageHero({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children?: ReactNode }) {
  return <section className="page-hero"><div className="container"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p>{children}</div></section>;
}

export function AuthModal() {
  const { authMode, closeAuth, authenticate, notify } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (authMode) setMode(authMode); }, [authMode]);
  if (!authMode) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || 'member@example.com');
    const fullName = String(data.get('name') || email.split('@')[0]);
    setLoading(true);
    window.setTimeout(() => {
      authenticate({ name: fullName, email });
      notify(mode === 'signup' ? 'Account ready' : 'Welcome back', 'Your Mudrexx Earn demo session is active.');
      setLoading(false);
    }, 650);
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Authentication">
      <button className="modal-backdrop" onClick={closeAuth} aria-label="Close" />
      <div className="auth-modal">
        <button className="modal-close" onClick={closeAuth}><X size={20} /></button>
        <Logo />
        <div className="auth-heading"><span>Demo access</span><h2>{mode === 'signin' ? 'Welcome back' : 'Build your wealth journey'}</h2><p>{mode === 'signin' ? 'Sign in to continue to your portfolio.' : 'Create your Mudrexx Earn account in seconds.'}</p></div>
        <div className="auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button></div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Full name<input name="name" placeholder="Your full name" required /></label>}
          <label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label>
          <label>Password<span className="label-hint">8+ characters</span><input name="password" type="password" placeholder="Enter your password" minLength={8} required /></label>
          {mode === 'signup' && <label className="check-row"><input type="checkbox" required /> <span>I agree to the Terms and acknowledge crypto market risk.</span></label>}
          <button className="btn btn-purple btn-full" disabled={loading}>{loading ? 'Securing your session…' : mode === 'signin' ? 'Sign in securely' : 'Create my account'} <ArrowRight size={16} /></button>
        </form>
        <div className="secure-note"><ShieldCheck size={17} /><span>Demo session · credentials are not transmitted or stored</span></div>
      </div>
    </div>
  );
}

export function ToastStack() {
  const { notices, dismiss } = useApp();
  return <div className="toast-stack">{notices.map((notice) => <div key={notice.id} className={`toast toast-${notice.tone}`}><span>{notice.tone === 'success' ? <CheckCircle2 /> : notice.tone === 'warning' ? <CircleHelp /> : <Zap />}</span><div><strong>{notice.title}</strong><p>{notice.message}</p></div><button onClick={() => dismiss(notice.id)}><X size={15} /></button></div>)}</div>;
}

export function EntryExperience() {
  const [visible, setVisible] = useState(() => sessionStorage.getItem('mudrexx-intro-seen') !== '1');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const replay = () => { setElapsed(0); setVisible(true); };
    window.addEventListener('replay-intro', replay);
    return () => window.removeEventListener('replay-intro', replay);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setElapsed((value) => {
      if (value >= 29) {
        sessionStorage.setItem('mudrexx-intro-seen', '1');
        setVisible(false);
        return 30;
      }
      return value + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [visible]);

  const close = () => { sessionStorage.setItem('mudrexx-intro-seen', '1'); setVisible(false); };
  if (!visible) return null;
  const copy = elapsed < 6 ? ['Your wealth journey begins', 'One wallet. Every opportunity.'] : elapsed < 14 ? ['Markets, brought to life', 'Watch value move in real time.'] : elapsed < 23 ? ['Open your eyes to possibility', 'Clarity before every decision.'] : ['Welcome to Mudrexx Earn', 'Trade with confidence. Grow with purpose.'];

  return (
    <div className="entry-experience">
      <div className="entry-aurora" />
      <div className="entry-stars">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
      <div className="entry-top"><Logo light /><button onClick={close}>Skip intro <ArrowRight size={15} /></button></div>
      <div className="entry-content">
        <div className="entry-copy" key={copy[0]}><span><Sparkles size={15} /> THE FUTURE OF YOUR WEALTH</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div>
        <div className="wealth-scene" aria-label="Animated wallet opening with a delighted investor">
          <div className="orbit orbit-one"><i className="mini-coin">₿</i></div>
          <div className="orbit orbit-two"><i className="mini-coin">Ξ</i></div>
          <div className="character">
            <div className="character-hair" />
            <div className="character-head"><span className="eye left"><i /></span><span className="eye right"><i /></span><span className="character-mouth" /></div>
            <div className="character-neck" /><div className="character-body"><i /></div>
          </div>
          <div className="wallet-scene">
            <div className="wealth-rays" />
            <div className="wallet-back"><span className="card card-one">M</span><span className="card card-two"><BadgeCheck size={18} /></span></div>
            <div className="wallet-flap"><span className="wallet-button" /></div>
            <div className="wallet-front"><Logo light /><span className="wallet-balance">WEALTH WALLET</span></div>
            {Array.from({ length: 7 }, (_, index) => <span key={index} className={`flying-coin flying-coin-${index + 1}`}>{index % 2 ? '₹' : '₿'}</span>)}
          </div>
        </div>
      </div>
      <div className="entry-progress"><span style={{ width: `${(elapsed / 30) * 100}%` }} /><small>{30 - elapsed}s</small></div>
    </div>
  );
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state"><span><Wallet size={22} /></span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
