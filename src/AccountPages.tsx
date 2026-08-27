import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Award, Banknote, Bell, BookOpen,
  Check, ChevronRight, CircleHelp, Coins, Copy, CreditCard, Download, ExternalLink, FileText,
  Flame, Gauge, Globe2, Headphones, History, Info, KeyRound, Layers3, Link2, ListChecks, Lock, LockKeyhole,
  MessageCircle, MessagesSquare, Plus, RefreshCcw, RotateCcw, Search, Settings, ShieldCheck,
  Sparkles, TrendingUp, Unlock, User, Users, Wallet as WalletIcon, X, Zap,
} from 'lucide-react';
import { CoinIcon, EmptyState, PageHero } from './components';
import { useApp, type FrozenFundItem } from './app-context';
import {
  apiMessage,
  getWalletSummary,
  getAccountStatement,
  getAccountProof,
  getAccountAgreement,
  getAccountInvoice,
  getAccountSnapshot,
  getCreditScore,
  getCreditScoreHistory,
  getSupportTickets,
  createSupportTicket,
  requestWithdrawalReview,
  type WalletSummaryResponse,
  type AccountStatement,
  type AccountProof,
  type AccountAgreement,
  type AccountInvoice,
  type AccountSnapshot,
  type CreditHistoryPoint,
  type SupportTicket,
} from './api';
import type { CreditSnapshot } from './types';
import { INR_RATE, money } from './data';
import { useMarket } from './market-context';
import {
  generateStatementPDF,
  generateProofPDF,
  generateAgreementPDF,
  generateInvoicePDF,
  downloadPDF,
} from './pdf-utils';

const TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_URL || 'https://t.me/MEDRIXEARN';

/** Backend user-category badge (New / Active / VIP / High Value / At Risk / Inactive / Restricted). */
export function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  return <span className={`user-category-badge ucb-${category.toLowerCase().replace(/\s+/g, '-')}`}>{category}</span>;
}

/** Credit score figure + status + history sparkline — all values from the backend. */
function CreditScoreCard({ credit, history }: { credit?: CreditSnapshot; history: CreditHistoryPoint[] }) {
  if (!credit) {
    return (
      <div className="settings-card credit-score-card" id="credit-score">
        <div className="card-heading">
          <div>
            <h3>Credit score</h3>
            <p>Computed and updated by the backend for your account.</p>
          </div>
          <Gauge />
        </div>
        <p className="credit-unavailable">
          Your credit score is not available from the backend yet. It appears here once the desk publishes it.
        </p>
      </div>
    );
  }
  const points = [...(history.length ? history : [{ ...credit, at: credit.updatedAt || '' }])].reverse();
  const min = Math.min(...points.map((point) => point.score));
  const max = Math.max(...points.map((point) => point.score));
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = points.length > 1 ? (index / (points.length - 1)) * 260 : 130;
      const y = 40 - ((point.score - min) / range) * 32;
      return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className="settings-card credit-score-card" id="credit-score">
      <div className="card-heading">
        <div>
          <h3>Credit score</h3>
          <p>Backend-computed — you cannot edit it from the website.</p>
        </div>
        <Gauge />
      </div>
      <div className="credit-score-body">
        <div className="credit-score-figure">
          <strong className={
            credit.status === 'excellent' || credit.status === 'good' ? 'up' : credit.status === 'fair' ? 'text-amber' : 'down'
          }>{credit.score}</strong>
          <span className={`credit-status credit-${credit.status}`}>{credit.status}</span>
          {credit.updatedAt && (
            <small>Last updated {new Date(credit.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small>
          )}
        </div>
        {points.length > 1 && (
          <svg viewBox="0 0 260 46" preserveAspectRatio="none" className="credit-history-chart" aria-label="Credit score history">
            <path d={path} />
            {points.map((point, index) => {
              const x = (index / (points.length - 1)) * 260;
              const y = 40 - ((point.score - min) / range) * 32;
              return <circle key={`${point.at}-${index}`} cx={x} cy={y} r={2.2} />;
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ProfilePage() {
  const { user, openAuth, notify, saveProfile } = useApp();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [creditHistory, setCreditHistory] = useState<CreditHistoryPoint[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', preferredCurrency: 'INR' as 'INR' | 'USDT' });

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      phone: user.phone || '',
      preferredCurrency: user.preferredCurrency || 'INR',
    });
    let active = true;
    (async () => {
      try {
        const snap = await getAccountSnapshot();
        if (active && snap.success && snap.account) setAccount(snap.account);
      } catch {
        /* profile falls back to the /api/auth/me snapshot already in context */
      }
      try {
        const history = await getCreditScoreHistory();
        if (active && history.success && history.history) setCreditHistory(history.history);
      } catch {
        /* history is optional */
      }
    })();
    return () => {
      active = false;
    };
  }, [user, user?.name, user?.phone, user?.preferredCurrency]);

  const copyValue = async (label: string, value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      notify('Copied', `${label} copied to clipboard.`, 'info');
    } catch {
      notify('Copy failed', 'Select the value and copy it manually.', 'warning');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    await saveProfile({
      name: form.name,
      phone: form.phone,
      preferredCurrency: form.preferredCurrency,
    });
    setSavingProfile(false);
  };

  const credit = account?.creditScore ?? user?.creditScore;
  const category = account?.category ?? user?.category;
  const accountStatus = account?.status ?? user?.status ?? 'active';
  const createdAt = account?.createdAt ?? user?.registeredAt;
  const lastActivity = account?.lastActivityAt ?? user?.lastActivityAt;

  return (
    <main>
      <PageHero
        eyebrow="Your account"
        title="Profile settings"
        copy="Keep your personal details, preferences, and security controls up to date."
      />
      <section className="container account-layout">
        <AccountNav active="profile" />
        <div className="settings-content">
          {!user ? (
            <EmptyState
              title="Sign in to view your profile"
              copy="Your settings will appear here after you securely sign in."
              action={
                <button className="btn btn-purple" onClick={() => openAuth('signin')}>
                  Sign in <ArrowRight />
                </button>
              }
            />
          ) : (
            <>
              <div className="settings-card profile-intro">
                <span className="large-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h2>{user.name} <CategoryBadge category={category} /></h2>
                  <p>{user.email}</p>
                  <span>
                    <Check /> {accountStatus === 'active' ? 'Profile active' : `Account ${accountStatus}`} · Joined{' '}
                    {new Date(createdAt || user.registeredAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="profile-actions-right">
                  <Link to="/wallet" className="btn btn-soft">
                    <WalletIcon size={16} /> View Wallet
                  </Link>
                </div>
              </div>

              {/* Account overview — backend snapshot */}
              <div className="settings-card account-overview">
                <div className="card-heading">
                  <div>
                    <h3>Account overview</h3>
                    <p>Your account identity as recorded on the backend. Ownership fields are read-only.</p>
                  </div>
                  <User />
                </div>
                <div className="account-overview-grid">
                  <label>
                    <span>User ID</span>
                    <b>{account?.id || user.id || '—'}</b>
                  </label>
                  <label>
                    <span>Username</span>
                    <b>{account?.username || user.username || '—'}</b>
                  </label>
                  <label>
                    <span>Invitation code</span>
                    <b className="copyable" onClick={() => void copyValue('Invitation code', account?.inviteCode || user.inviteCode)}>
                      {account?.inviteCode || user.inviteCode || '—'} <Copy size={13} />
                    </b>
                  </label>
                  <label>
                    <span>Account status</span>
                    <b className={`account-status as-${accountStatus}`}>{accountStatus}</b>
                  </label>
                  <label>
                    <span>User category</span>
                    <b><CategoryBadge category={category} />{category ? '' : '—'}</b>
                  </label>
                  <label>
                    <span>Credit status</span>
                    <b>{credit ? `${credit.score} · ${credit.status}` : '—'}</b>
                  </label>
                  <label>
                    <span>Account created</span>
                    <b>{formatDateTimeLabel(createdAt || user.registeredAt)}</b>
                  </label>
                  <label>
                    <span>Last activity</span>
                    <b>{formatDateTimeLabel(lastActivity)}</b>
                  </label>
                </div>
                <div className="admin-relationship">
                  <ShieldCheck size={15} />
                  <div>
                    <strong>Admin relationship</strong>
                    {account?.adminUserCode || user.adminUserCode ? (
                      <p>
                        This account is attached to admin code <b>{account?.adminUserCode || user.adminUserCode}</b>
                        {account?.invitedByType === 'super' ? ' (super admin)' : ''}. Assignment is managed by the
                        desk and cannot be changed from the website.
                      </p>
                    ) : account?.invitedBy || user.invitedBy ? (
                      <p>
                        Invited by <b>{account?.invitedBy || user.invitedBy}</b> ({account?.invitedByType || user.invitedByType || 'referral'}).
                        Ownership is managed by the desk and cannot be changed here.
                      </p>
                    ) : (
                      <p>No admin attachment is recorded for this account. Admin assignment is controlled by the backend.</p>
                    )}
                  </div>
                </div>
              </div>

              <CreditScoreCard credit={credit} history={creditHistory} />

              <form className="settings-card settings-form" onSubmit={submit}>
                <div className="card-heading">
                  <div>
                    <h3>Personal information</h3>
                    <p>Used for your profile, transactions, and support requests.</p>
                  </div>
                  <User />
                </div>
                <div className="two-fields">
                  <label>
                    <span>Full name</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    <span>Email address</span>
                    <input defaultValue={user.email} type="email" disabled title="Email is your account identity and is managed by the backend" />
                  </label>
                  <label>
                    <span>Mobile number</span>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="+91 98765 43210"
                    />
                  </label>
                  <label>
                    <span>Preferred currency</span>
                    <select
                      value={form.preferredCurrency}
                      onChange={(event) => setForm((current) => ({ ...current, preferredCurrency: event.target.value as 'INR' | 'USDT' }))}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USDT">USDT (₮)</option>
                    </select>
                  </label>
                </div>
                <button className="btn btn-purple" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </form>

              <div className="settings-card security-settings">
                <div className="card-heading">
                  <div>
                    <h3>Security &amp; Linking</h3>
                    <p>Account protections and verified linking controls.</p>
                  </div>
                  <ShieldCheck />
                </div>
                <SettingRow icon={<Link2 />} title="Demo to Real Account Link" copy="Demo earnings linked for conversion" action={user.wallet.demoLinked ? 'Active' : 'Paused'} />
                <SettingRow icon={<KeyRound />} title="Password" copy="Last changed recently" action="Change" />
                <SettingRow icon={<LockKeyhole />} title="Two-factor authentication" copy="Add an authenticator app" action="Set up" />
                <SettingRow icon={<Bell />} title="Login alerts" copy="Email alerts for new sessions" action="Enabled" />
              </div>

              {/* Account Documents Section */}
              <AccountDocumentsSection />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export function WalletPage() {
  const {
    user,
    openAuth,
    convertDemoToReal,
    approveDeposit,
    cancelOrReleaseFrozen,
    claimDemoCredits,
    setDemoLinked,
    notify,
  } = useApp();
  const { quotes } = useMarket();
  const navigate = useNavigate();

  // State for Conversion Tool
  const [convertAmount, setConvertAmount] = useState('1000');
  const [conversionTab, setConversionTab] = useState<'convert' | 'history'>('convert');
  const [frozenFilter, setFrozenFilter] = useState<'all' | 'deposit' | 'order' | 'staking'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'conversion' | 'deposit' | 'trade'>('all');
  const [accountView, setAccountView] = useState<'all' | 'real' | 'demo'>('all');
  const [summary, setSummary] = useState<WalletSummaryResponse['summary'] | null>(null);
  const [credit, setCredit] = useState<{ score: number; status: string; updatedAt?: string } | null>(null);

  // Balance state (deposit / credit / total / frozen) from the backend summary.
  useEffect(() => {
    if (!user) return;
    let active = true;
    void getWalletSummary(user.email)
      .then((response) => {
        if (active && response.success && response.summary) setSummary(response.summary);
      })
      .catch(() => {
        /* summary stays on wallet-derived fallback below */
      });
    return () => {
      active = false;
    };
  }, [user, user?.wallet.realBalance, user?.wallet.frozenBalance, user?.wallet.demoBalance, user?.wallet.realUsdtBalance, user?.wallet.frozenUsdtBalance]);

  // Credit score & status for the wallet header (backend-computed).
  useEffect(() => {
    if (!user) return;
    let active = true;
    if (user.creditScore) {
      setCredit(user.creditScore);
      return;
    }
    void getCreditScore()
      .then((response) => {
        if (active && response.creditScore) setCredit(response.creditScore);
      })
      .catch(() => {
        /* credit stays unavailable */
      });
    return () => {
      active = false;
    };
  }, [user, user?.creditScore]);

  if (!user) {
    return (
      <main>
        <PageHero
          eyebrow="Your account"
          title="Wallet"
          copy="A clear view of balances, frozen amounts, demo conversion, and funding options."
        />
        <section className="container account-layout">
          <AccountNav active="wallet" />
          <div className="settings-content">
            <EmptyState
              title="Your wallet is waiting"
              copy="Sign in or create an account to view your balances, manage frozen amounts, and convert demo funds."
              action={
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button className="btn btn-purple" onClick={() => openAuth('signin')}>
                    Sign in <ArrowRight />
                  </button>
                  <button className="btn btn-dark" onClick={() => openAuth('signup')}>
                    Register (₹0 Initial Balance) <Plus />
                  </button>
                </div>
              }
            />
          </div>
        </section>
      </main>
    );
  }

  const wallet = user.wallet;
  const availableRealINR = wallet.realBalance;
  const frozenRealINR = wallet.frozenBalance;
  const totalNetRealINR = availableRealINR + frozenRealINR;
  const demoCredits = wallet.demoBalance;
  const conversionRate = wallet.conversionRate || 0.1; // 100 Demo = 10 INR (0.1 ratio)

  // Conversion calculations
  const parsedConvert = Math.max(0, Number(convertAmount) || 0);
  const estimatedRealGain = Math.round(parsedConvert * conversionRate * 100) / 100;

  const handleConvertSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (parsedConvert <= 0) {
      notify('Invalid amount', 'Please enter demo credits to convert.', 'warning');
      return;
    }
    if (parsedConvert > demoCredits) {
      notify('Insufficient Demo Credits', `You currently have ${demoCredits.toLocaleString()} demo credits.`, 'warning');
      return;
    }
    const result = await convertDemoToReal(parsedConvert);
    if (result.success) {
      setConvertAmount(String(Math.min(1000, demoCredits - parsedConvert)));
    }
  };

  const setPercentConvert = (percent: number) => {
    const calculated = Math.floor((demoCredits * percent) / 100);
    setConvertAmount(String(calculated));
  };

  // Filtered Frozen items
  const filteredFrozen = wallet.frozenItems.filter((item) => {
    if (frozenFilter === 'all') return true;
    return item.category === frozenFilter;
  });

  // Filtered activity transactions
  const filteredActivity = wallet.transactions.filter((tx) => {
    if (activityFilter === 'all') return true;
    return tx.type === activityFilter;
  });

  // Withdrawals are never executed by the website — the student is routed to
  // Customer Support, where a Withdrawal request ticket is created.
  const openWithdrawSupport = () => {
    navigate(
      `/support?category=Withdrawal&currency=INR&available=${encodeURIComponent(String(availableRealINR))}`
    );
  };

  return (
    <main>
      <PageHero
        eyebrow="Your account"
        title="Wallet & Balance Desk"
        copy="Manage real balances, inspect frozen amounts in orders/vaults, and convert demo practice earnings to real wallet funds."
      />
      <section className="container account-layout">
        <AccountNav active="wallet" />
        <div className="settings-content">
          {/* Account Mode Switcher & Linking Status Banner */}
          <div className="wallet-header-toolbar">
            <div className="account-switcher-pills">
              <button className={accountView === 'all' ? 'active' : ''} onClick={() => setAccountView('all')}>
                <Layers3 size={15} /> All Accounts
              </button>
              <button className={accountView === 'real' ? 'active' : ''} onClick={() => setAccountView('real')}>
                <Banknote size={15} /> Real Wallet (₹{totalNetRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </button>
              <button className={accountView === 'demo' ? 'active' : ''} onClick={() => setAccountView('demo')}>
                <Coins size={15} /> Demo Account ({demoCredits.toLocaleString()} Credits)
              </button>
            </div>

            <div className="demo-link-badge">
              <span className={`link-pill ${wallet.demoLinked ? 'linked' : 'unlinked'}`}>
                <Link2 size={13} />
                {wallet.demoLinked ? 'Demo Linked to Real Account' : 'Demo Unlinked'}
              </span>
              <button
                type="button"
                className="link-toggle-btn"
                onClick={() => setDemoLinked(!wallet.demoLinked)}
                title={wallet.demoLinked ? 'Click to pause link' : 'Click to link demo account'}
              >
                {wallet.demoLinked ? 'Linked' : 'Link Now'}
              </button>
            </div>
          </div>

          {/* Balance State — Deposit / Credit / Total / Frozen */}
          <div className="wallet-state-strip">
            <span>
              <small><ArrowDownLeft size={12} /> Deposit</small>
              <strong>₹{Math.floor(summary?.depositCredited ?? 0).toLocaleString('en-IN')}{(summary?.depositCreditedUsdt ?? 0) > 0 ? ` + ₮${Math.floor(summary?.depositCreditedUsdt ?? 0).toLocaleString()}` : ''}</strong>
            </span>
            <span>
              <small><Coins size={12} /> Credit</small>
              <strong>{(summary?.creditTotal ?? wallet.demoBalance).toLocaleString()}</strong>
            </span>
            <span>
              <small><WalletIcon size={12} /> Total</small>
              <strong>₹{Math.floor(summary?.totalBalance ?? totalNetRealINR).toLocaleString('en-IN')}{(summary?.totalUsdtBalance ?? (wallet.realUsdtBalance + wallet.frozenUsdtBalance)) > 0 ? ` + ₮${Math.floor(summary?.totalUsdtBalance ?? (wallet.realUsdtBalance + wallet.frozenUsdtBalance)).toLocaleString()}` : ''}</strong>
            </span>
            <span>
              <small><Lock size={12} /> Frozen</small>
              <strong>₹{Math.floor(summary?.frozenTotal ?? frozenRealINR).toLocaleString('en-IN')}{(summary?.frozenTotalUsdt ?? wallet.frozenUsdtBalance) > 0 ? ` + ₮${Math.floor(summary?.frozenTotalUsdt ?? wallet.frozenUsdtBalance).toLocaleString()}` : ''}</strong>
            </span>
            <span className="state-orders">
              <small><TrendingUp size={12} /> Open orders</small>
              <strong>{summary?.openOrders ?? 0}</strong>
            </span>
            {(summary?.pendingAmount ?? 0) > 0 && (
              <span className="state-pending">
                <small><RefreshCcw size={12} /> Pending</small>
                <strong>₹{Math.floor(summary?.pendingAmount ?? 0).toLocaleString('en-IN')}</strong>
              </span>
            )}
            {credit && (
              <span className="state-credit">
                <small><Award size={12} /> Credit</small>
                <strong>
                  {credit.score} · <em className={`credit-status credit-${credit.status}`}>{credit.status}</em>
                </strong>
              </span>
            )}
          </div>

          {/* Balance Overview Grid */}
          <div className="wallet-balance-grid">
            {/* Total Balance Card */}
            <div className="wallet-balance-card main-balance-card">
              <div className="balance-card-header">
                <span>Total Net Balance <small>Real Account</small></span>
                <span className="live-status-dot"><i /> Live</span>
              </div>
              <h2>₹{totalNetRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div className="balance-breakdown-row">
                <span>
                  <b className="dot-available" /> Available: <strong>₹{availableRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </span>
                <span>
                  <b className="dot-frozen" /> Frozen: <strong>₹{frozenRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
              <div className="balance-card-actions">
                <Link className="btn btn-white" to="/deposit">
                  <Plus size={15} /> Deposit INR / USDT
                </Link>
                <a className="btn btn-glass" href="#conversion-desk">
                  <RefreshCcw size={15} /> Convert Demo to Real
                </a>
                <button className="btn btn-glass" onClick={openWithdrawSupport}>
                  <ArrowDownLeft size={15} /> Withdraw via Support
                </button>
              </div>
            </div>

            {/* Sub Stat Cards */}
            <div className="wallet-stat-cards-col">
              {/* Available Balance Card */}
              <div className="wallet-stat-card available-card">
                <div className="stat-card-icon"><Banknote size={20} /></div>
                <div>
                  <small>AVAILABLE FOR TRADING / WITHDRAWAL</small>
                  <h3>₹{availableRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p>100% liquid & ready for instant scenario execution</p>
                </div>
                <Link to="/instant-order" className="stat-quick-link">Trade <ArrowRight size={13} /></Link>
              </div>

              {/* Frozen Amount Card */}
              <div className="wallet-stat-card frozen-card">
                <div className="stat-card-icon frozen-icon"><Lock size={20} /></div>
                <div>
                  <div className="stat-title-wrap">
                    <small>FROZEN AMOUNT (LOCKED FUNDS)</small>
                    {wallet.frozenItems.length > 0 && (
                      <span className="frozen-count-badge">{wallet.frozenItems.length} active hold{wallet.frozenItems.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <h3>₹{frozenRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <p>Locked in limit scenarios, earn vaults, or pending verification</p>
                </div>
                <a href="#frozen-section" className="stat-quick-link">View Frozen <ChevronRight size={13} /></a>
              </div>

              {/* Demo Practice Card */}
              <div className="wallet-stat-card demo-card">
                <div className="stat-card-icon demo-icon"><Coins size={20} /></div>
                <div>
                  <div className="stat-title-wrap">
                    <small>LINKED DEMO CREDITS</small>
                    <span className="convert-rate-badge">100 Demo = ₹10 Real</span>
                  </div>
                  <h3>{demoCredits.toLocaleString()} <span className="currency-unit">CREDITS</span></h3>
                  <p>≈ ₹{(demoCredits * conversionRate).toFixed(2)} convertible to real wallet</p>
                </div>
                <button className="claim-demo-btn" onClick={() => claimDemoCredits(5000)}>
                  <Sparkles size={13} /> +5,000 Free Demo
                </button>
              </div>
            </div>
          </div>

          {/* New User Welcome / Getting Started Banner when balance is 0 */}
          {totalNetRealINR === 0 && (
            <div className="new-user-wallet-banner">
              <div className="banner-icon-badge"><Sparkles size={22} /></div>
              <div className="banner-text">
                <h4>Welcome! Your newly registered account starts with ₹0.00 balance</h4>
                <p>
                  You have <strong>{demoCredits.toLocaleString()} demo practice credits</strong> linked to your profile.
                  Practice trading in Instant Order / Flight Lab, convert your demo balance to real INR, or make your first deposit!
                </p>
              </div>
              <div className="banner-actions">
                <a href="#conversion-desk" className="btn btn-purple btn-sm">
                  Convert Demo to Real ₹ <ArrowRight size={14} />
                </a>
                <Link to="/deposit" className="btn btn-soft btn-sm">
                  Deposit Funds
                </Link>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 1: LINK DEMO TO REAL CONVERSION DESK                              */}
          {/* ========================================================================= */}
          <div className="settings-card conversion-desk-card" id="conversion-desk">
            <div className="card-heading">
              <div>
                <div className="heading-tag"><Link2 size={13} /> LINKED CONVERSION DESK</div>
                <h3>Convert Demo Credits to Real Wallet Balance</h3>
                <p>
                  Seamlessly bridge your demo trading success into real funds. Convert practice earnings and demo credits at an indicative 10:1 ratio.
                </p>
              </div>
              <div className="conversion-ratio-box">
                <span>CONVERSION RATIO</span>
                <strong>100 DEMO = ₹10 Real INR</strong>
                <small>1 Demo Credit = ₹0.10 Real Balance</small>
              </div>
            </div>

            <div className="conversion-interface-grid">
              <form className="conversion-form" onSubmit={handleConvertSubmit}>
                <div className="conversion-inputs-row">
                  {/* From: Demo Account */}
                  <div className="conversion-box from-box">
                    <div className="box-header">
                      <span>FROM: DEMO ACCOUNT</span>
                      <small>Available: <b>{demoCredits.toLocaleString()} credits</b></small>
                    </div>
                    <div className="input-group-large">
                      <Coins size={20} className="input-icon" />
                      <input
                        type="number"
                        min="10"
                        max={demoCredits}
                        value={convertAmount}
                        onChange={(e) => setConvertAmount(e.target.value)}
                        placeholder="Amount of demo credits"
                        required
                      />
                      <span className="unit-label">DEMO</span>
                    </div>
                    <div className="percent-chips">
                      <button type="button" onClick={() => setPercentConvert(25)}>25%</button>
                      <button type="button" onClick={() => setPercentConvert(50)}>50%</button>
                      <button type="button" onClick={() => setPercentConvert(75)}>75%</button>
                      <button type="button" onClick={() => setPercentConvert(100)}>100% (MAX)</button>
                    </div>
                  </div>

                  <div className="conversion-arrow-divider">
                    <div className="arrow-circle">
                      <RefreshCcw size={18} />
                    </div>
                  </div>

                  {/* To: Real Account */}
                  <div className="conversion-box to-box">
                    <div className="box-header">
                      <span>TO: REAL WALLET (AVAILABLE)</span>
                      <small>Current Real: <b>₹{availableRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></small>
                    </div>
                    <div className="input-group-large preview-group">
                      <Banknote size={20} className="input-icon" />
                      <div className="calculated-gain">
                        +₹{estimatedRealGain.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="unit-label">INR (₹)</span>
                    </div>
                    <div className="conversion-meta-note">
                      <Check size={13} /> Instantly credited to Available Real Balance upon conversion
                    </div>
                  </div>
                </div>

                <div className="conversion-submit-bar">
                  <div className="conversion-summary-note">
                    <Info size={14} />
                    <span>
                      You will convert <strong>{parsedConvert.toLocaleString()} Demo Credits</strong> into{' '}
                      <strong className="text-green">₹{estimatedRealGain.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Real INR</strong>.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-purple btn-lg convert-action-btn"
                    disabled={parsedConvert <= 0 || parsedConvert > demoCredits}
                  >
                    <Link2 size={16} /> Link & Convert to Real Wallet Now <ArrowRight size={16} />
                  </button>
                </div>
              </form>

              <div className="conversion-side-tips">
                <div className="tip-card">
                  <div className="tip-icon"><Award size={18} /></div>
                  <div>
                    <strong>Earn more demo credits</strong>
                    <p>Practice trading on BTC/ETH charts or test your timing in the Flight Lab multiplier game.</p>
                  </div>
                </div>
                <div className="tip-card">
                  <div className="tip-icon mint"><RotateCcw size={18} /></div>
                  <div>
                    <strong>Instant real crediting</strong>
                    <p>Converted funds reflect in your real available balance immediately with no waiting period.</p>
                  </div>
                </div>
                <div className="tip-card">
                  <div className="tip-icon"><ShieldCheck size={18} /></div>
                  <div>
                    <strong>Account safety check</strong>
                    <p>Demo linking ensures test achievements stay synced with your verified profile.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: DEDICATED FROZEN AMOUNT SECTION                                */}
          {/* ========================================================================= */}
          <div className="settings-card frozen-funds-section" id="frozen-section">
            <div className="card-heading">
              <div>
                <div className="heading-tag frozen-tag"><Lock size={13} /> FROZEN AMOUNT BREAKDOWN</div>
                <h3>Locked & Escrowed Funds Section</h3>
                <p>
                  Review all funds temporarily frozen for open limit orders, pending deposit verifications, or flexible staking vaults.
                </p>
              </div>
              <div className="frozen-total-stat">
                <small>TOTAL FROZEN</small>
                <strong>₹{frozenRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <span>{wallet.frozenItems.length} active hold{wallet.frozenItems.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {/* Frozen Explanatory Info Card */}
            <div className="frozen-info-banner">
              <LockKeyhole size={18} />
              <div>
                <strong>How does the Frozen Amount section work?</strong>
                <p>
                  When you submit a deposit for review, place an order scenario, or stake in earn vaults, the required funds are frozen to protect the transaction.
                  Frozen funds are never lost—they automatically unlock or can be released back to your Available Balance below.
                </p>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="frozen-filter-toolbar">
              <div className="frozen-filter-tabs">
                <button
                  className={frozenFilter === 'all' ? 'active' : ''}
                  onClick={() => setFrozenFilter('all')}
                >
                  All Locked ({wallet.frozenItems.length})
                </button>
                <button
                  className={frozenFilter === 'deposit' ? 'active' : ''}
                  onClick={() => setFrozenFilter('deposit')}
                >
                  Pending Deposits ({wallet.frozenItems.filter((i) => i.category === 'deposit').length})
                </button>
                <button
                  className={frozenFilter === 'order' ? 'active' : ''}
                  onClick={() => setFrozenFilter('order')}
                >
                  Active Orders ({wallet.frozenItems.filter((i) => i.category === 'order').length})
                </button>
                <button
                  className={frozenFilter === 'staking' ? 'active' : ''}
                  onClick={() => setFrozenFilter('staking')}
                >
                  Staking Vaults ({wallet.frozenItems.filter((i) => i.category === 'staking').length})
                </button>
              </div>
            </div>

            {/* Frozen Items List */}
            {filteredFrozen.length === 0 ? (
              <div className="empty-frozen-state">
                <ShieldCheck size={36} className="empty-shield" />
                <h4>No funds currently frozen</h4>
                <p>
                  100% of your real wallet balance (₹{availableRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) is available.
                  Funds locked in active trading scenarios, deposit verifications, or earn vaults will appear here.
                </p>
                <div className="empty-actions">
                  <Link to="/instant-order" className="btn btn-soft btn-sm">
                    Open Instant Order
                  </Link>
                  <Link to="/market?tab=staking" className="btn btn-soft btn-sm">
                    Explore Staking Vaults
                  </Link>
                </div>
              </div>
            ) : (
              <div className="frozen-items-list">
                {filteredFrozen.map((item) => (
                  <FrozenItemRow
                    key={item.id}
                    item={item}
                    onApproveDeposit={() => approveDeposit(item.id)}
                    onRelease={() => cancelOrReleaseFrozen(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: YOUR ASSET HOLDINGS                                            */}
          {/* ========================================================================= */}
          <div className="settings-card">
            <div className="card-heading">
              <div>
                <h3>Your Crypto Holdings</h3>
                <p>Real and tracked cryptocurrency balances in your wallet.</p>
              </div>
              <WalletIcon />
            </div>
            <div className="wallet-assets">
              {quotes.slice(0, 6).map((quote) => {
                const userQty = wallet.assetHoldings[quote.symbol] || 0;
                const valueINR = userQty * quote.price * INR_RATE;
                return (
                  <div key={quote.symbol} className="asset-row-item">
                    <CoinIcon asset={quote} />
                    <span className="asset-info-col">
                      <strong>{quote.name}</strong>
                      <small>
                        {userQty.toFixed(4)} {quote.symbol} · Rate: {money(quote.price * INR_RATE, 'INR')}
                      </small>
                    </span>
                    <b className="asset-val-col">
                      {money(valueINR, 'INR')}
                      <small className={quote.change >= 0 ? 'up' : 'down'}>
                        {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%
                      </small>
                    </b>
                    <Link
                      to={`/instant-order?asset=${quote.symbol}`}
                      className="asset-action-btn"
                      title={`Trade ${quote.symbol}`}
                    >
                      Trade <ChevronRight size={13} />
                    </Link>
                  </div>
                );
              })}
            </div>
            {totalNetRealINR === 0 && (
              <div className="asset-empty-helper">
                <Info size={14} />
                <span>All coin balances are currently 0.00. Fund your wallet or convert demo credits to trade.</span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: ACTIVITY & TRANSACTION HISTORY                                */}
          {/* ========================================================================= */}
          <div className="settings-card">
            <div className="card-heading">
              <div>
                <h3>Recent Wallet Activity</h3>
                <p>Audit trail of conversions, deposits, orders, and unlocked funds.</p>
              </div>
              <div className="activity-filter-pills">
                <button
                  className={activityFilter === 'all' ? 'active' : ''}
                  onClick={() => setActivityFilter('all')}
                >
                  All
                </button>
                <button
                  className={activityFilter === 'conversion' ? 'active' : ''}
                  onClick={() => setActivityFilter('conversion')}
                >
                  Conversions
                </button>
                <button
                  className={activityFilter === 'deposit' ? 'active' : ''}
                  onClick={() => setActivityFilter('deposit')}
                >
                  Deposits
                </button>
                <button
                  className={activityFilter === 'trade' ? 'active' : ''}
                  onClick={() => setActivityFilter('trade')}
                >
                  Trades
                </button>
              </div>
            </div>

            {filteredActivity.length === 0 ? (
              <div className="empty-activity-log">
                <History size={28} />
                <p>No activity records in this category yet.</p>
              </div>
            ) : (
              <div className="activity-list">
                {filteredActivity.map((tx) => (
                  <div key={tx.id} className="activity-row">
                    <span className={`activity-icon-badge ${tx.type}`}>
                      {tx.type === 'conversion' ? (
                        <RefreshCcw size={16} />
                      ) : tx.type === 'deposit' ? (
                        <ArrowDownLeft size={16} />
                      ) : tx.type === 'stake' ? (
                        <Sparkles size={16} />
                      ) : tx.type === 'release' ? (
                        <Unlock size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                    </span>
                    <div className="activity-details">
                      <strong>{tx.title}</strong>
                      <small>{tx.description} · {tx.time}</small>
                    </div>
                    <div className="activity-amount-col">
                      <b className={tx.tone || ''}>
                        {tx.amount > 0 && tx.tone === 'up' ? '+' : ''}
                        {tx.currency === 'INR' ? '₹' : tx.currency === 'USDT' ? '₮' : ''}
                        {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: tx.currency === 'CREDITS' ? 0 : 2 })}
                        {tx.currency === 'CREDITS' ? ' DEMO' : ''}
                      </b>
                      <span className={`status-badge status-${tx.status}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Withdrawals are handled by Customer Support — see /support?category=Withdrawal */}
    </main>
  );
}

function FrozenItemRow({
  item,
  onApproveDeposit,
  onRelease,
}: {
  item: FrozenFundItem;
  onApproveDeposit: () => void;
  onRelease: () => void;
}) {
  const isDeposit = item.category === 'deposit';
  const isStaking = item.category === 'staking';
  const isOrder = item.category === 'order';

  return (
    <div className={`frozen-item-card category-${item.category}`}>
      <div className="frozen-item-left">
        <span className={`frozen-category-icon ${item.category}`}>
          {isDeposit ? <ArrowDownLeft size={18} /> : isStaking ? <Sparkles size={18} /> : <Lock size={18} />}
        </span>
        <div className="frozen-item-info">
          <div className="frozen-title-row">
            <strong>{item.title}</strong>
            <span className={`frozen-badge-pill badge-${item.status}`}>
              {item.status === 'processing' ? '⏳ Verification Pending' : item.status === 'accruing' ? `✨ Accruing ${item.apy || 4.7}% APY` : '🔒 Locked in Order'}
            </span>
          </div>
          <p>{item.reason} · {item.date}</p>
        </div>
      </div>

      <div className="frozen-item-right">
        <div className="frozen-amount-val">
          <strong>
            {item.currency === 'INR' ? '₹' : '₮'}{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </strong>
          <small>Frozen hold</small>
        </div>

        <div className="frozen-action-buttons">
          {isDeposit ? (
            <button
              type="button"
              className="btn btn-sm btn-green-action"
              onClick={onApproveDeposit}
              title="Sandbox verification shortcut to credit available balance"
            >
              <Check size={13} /> Verify & Credit Now
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-soft-action"
              onClick={onRelease}
              title="Unlock and return funds to available balance"
            >
              <Unlock size={13} /> {isStaking ? 'Unstake & Release' : 'Cancel & Release'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SupportPage() {
  const { user, openAuth, notify } = useApp();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<string[]>(['Withdrawal', 'Account', 'Order', 'Wallet', 'Documents', 'Other']);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => ({
    category: params.get('category') || '',
    subject: '',
    message: params.get('message') || '',
    currency: params.get('currency') === 'USDT' ? 'USDT' : 'INR',
    amount: '',
  }));

  const faqs = [
    'How do INR deposits work?',
    'How do I convert demo credits to real wallet balance?',
    'Why is an amount marked as Frozen in my wallet?',
    'Which network should I use for USDT?',
    'How are live Coinbase prices calculated?',
    'How can I secure my account?',
  ];

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    setTicketsError('');
    try {
      const response = await getSupportTickets();
      if (!response.success || !response.tickets) {
        throw new Error(response.error || 'Tickets are unavailable right now.');
      }
      setTickets(response.tickets);
      if (response.categories?.length) setCategories(response.categories);
    } catch (error) {
      setTicketsError(apiMessage(error));
    } finally {
      setLoadingTickets(false);
    }
  }, [user]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      openAuth('signin');
      return;
    }
    const category = form.category || 'Other';
    setSubmitting(true);
    try {
      let response;
      if (category === 'Withdrawal' && form.amount.trim()) {
        response = await requestWithdrawalReview({
          currency: form.currency,
          amount: Number(form.amount),
          note: form.message.trim() || undefined,
        });
      } else {
        response = await createSupportTicket({
          category,
          subject: form.subject.trim() || `${category} request`,
          message: form.message.trim(),
        });
      }
      if (!response.success) throw new Error(response.error || 'The request could not be created.');
      notify('Request sent', response.message || 'Support will respond on your ticket.', 'success');
      setForm((current) => ({ ...current, subject: '', message: '', amount: '' }));
      await loadTickets();
    } catch (error) {
      notify('Request failed', apiMessage(error), 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtTicketDate = (value: string) =>
    new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <main>
      <PageHero
        eyebrow="We’re here to help"
        title="How can we support you?"
        copy="Raise a request, track your tickets, or reach the team on Telegram. Withdrawals are reviewed here."
      >
        <label className="support-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for an answer (e.g. frozen amount, conversion, deposit)"
          />
        </label>
      </PageHero>
      <section className="container support-content">
        <div className="support-actions">
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            <span className="support-action-icon telegram">
              <MessageCircle />
            </span>
            <div>
              <small>FASTEST RESPONSE</small>
              <h3>Chat on Telegram</h3>
              <p>Connect with our support channel for account and product help.</p>
              <b>
                Open @MEDRIXEARN <ExternalLink />
              </b>
            </div>
          </a>
          <a href="#new-ticket">
            <span className="support-action-icon">
              <MessagesSquare />
            </span>
            <div>
              <small>HELP CENTRE</small>
              <h3>Raise a request</h3>
              <p>Withdrawal, account, order, wallet, documents and other requests — answered on your ticket.</p>
              <b>
                Create ticket <ArrowRight />
              </b>
            </div>
          </a>
          <article>
            <span className="support-action-icon mint">
              <Headphones />
            </span>
            <div>
              <small>ACCOUNT HELP</small>
              <h3>Track your tickets</h3>
              <p>Every request and the support response appears in your ticket history below.</p>
              <b>
                View tickets <ArrowRight />
              </b>
            </div>
          </article>
        </div>

        {/* Ticket creation */}
        <form className="support-ticket-card" id="new-ticket" onSubmit={submitTicket}>
          <div className="card-heading">
            <div>
              <h3>Create a support request</h3>
              <p>Requests are stored on the backend against your account. Never include passwords or OTPs.</p>
            </div>
            <CircleHelp />
          </div>
          <div className="ticket-form-grid">
            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                required
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                    {category === 'Withdrawal' ? ' (withdrawals are processed by the desk)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Subject</span>
              <input
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder={
                  form.category === 'Withdrawal' ? 'Withdrawal request' : 'Short summary of your request'
                }
              />
            </label>
            {form.category === 'Withdrawal' && (
              <>
                <label>
                  <span>Requested currency</span>
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, currency: event.target.value as 'INR' | 'USDT' }))
                    }
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USDT">USDT (₮)</option>
                  </select>
                </label>
                <label>
                  <span>Requested amount (optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="e.g. 2500"
                  />
                </label>
              </>
            )}
            <label className="ticket-message-label">
              <span>How can we help?</span>
              <textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder={
                  form.category === 'Withdrawal'
                    ? 'Preferred payout destination and any notes for the desk (reviewed by support).'
                    : 'Describe your request in detail…'
                }
                rows={4}
                required={form.category !== 'Withdrawal' || !form.amount.trim()}
              />
            </label>
          </div>
          <button className="btn btn-purple" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit request'} <ArrowRight size={15} />
          </button>
          <p className="ticket-form-note">
            <ShieldCheck size={13} /> The website cannot approve or complete withdrawals — every withdrawal is
            reviewed and settled by the desk through this ticket.
          </p>
        </form>

        {/* Ticket history */}
        <div className="support-tickets-card">
          <div className="card-heading">
            <div>
              <h3>Your tickets</h3>
              <p>Request date, requested currency &amp; amount, status and the support response.</p>
            </div>
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => void loadTickets()}
              disabled={loadingTickets}
            >
              <RefreshCcw size={13} className={loadingTickets ? 'spin' : ''} /> Refresh
            </button>
          </div>
          {!user && (
            <div className="tickets-empty">
              <p>Sign in to create and track support requests.</p>
              <button className="btn btn-purple btn-sm" onClick={() => openAuth('signin')}>
                Sign in <ArrowRight size={14} />
              </button>
            </div>
          )}
          {user && ticketsError && <div className="tickets-error"><AlertCircle size={15} /> {ticketsError}</div>}
          {user && !ticketsError && loadingTickets && tickets.length === 0 && (
            <div className="tickets-empty"><p>Loading your tickets…</p></div>
          )}
          {user && !ticketsError && !loadingTickets && tickets.length === 0 && (
            <div className="tickets-empty"><p>No tickets yet — your requests will appear here with their status.</p></div>
          )}
          {tickets.length > 0 && (
            <div className="tickets-list">
              {tickets.map((ticket) => (
                <article className="ticket-row" key={ticket.id}>
                  <header>
                    <span className={`ticket-cat tc-${ticket.category.toLowerCase()}`}>{ticket.category}</span>
                    <strong>{ticket.subject}</strong>
                    <span className={`ticket-status ts-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
                  </header>
                  <p>{ticket.message}</p>
                  <footer>
                    <span>Requested {fmtTicketDate(ticket.createdAt)}</span>
                    {ticket.request?.currency && (
                      <span>
                        Currency <b>{ticket.request.currency}</b>
                      </span>
                    )}
                    {ticket.request?.amount != null && (
                      <span>
                        Amount{' '}
                        <b>
                          {ticket.request.currency === 'USDT' ? '₮' : '₹'}
                          {ticket.request.amount.toLocaleString('en-IN')}
                        </b>
                      </span>
                    )}
                    <span>Updated {fmtTicketDate(ticket.updatedAt)}</span>
                  </footer>
                  {ticket.response && (
                    <div className="ticket-response">
                      <Headphones size={14} />
                      <div>
                        <strong>Support response</strong>
                        <p>{ticket.response}</p>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="faq-card">
          <div className="card-heading">
            <div>
              <h3>Frequently asked questions</h3>
              <p>Answers to common questions from the community.</p>
            </div>
            <CircleHelp />
          </div>
          {faqs
            .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
            .map((item) => (
              <details key={item}>
                <summary>
                  {item}
                  <Plus />
                </summary>
                <p>
                  {item.includes('Frozen')
                    ? 'Frozen amounts are funds temporarily held in pending orders, staking vaults, or unverified deposits to protect transactions. They unlock automatically or can be released from your Wallet page.'
                    : item.includes('convert')
                    ? 'You can convert your practice demo trading profits and credits into real wallet INR balance at a 10:1 ratio directly from the Wallet page Conversion Desk.'
                    : 'This demo experience shows the complete interface. Connect your verified payment, custody, and support providers before a production launch.'}
                </p>
              </details>
            ))}
        </div>
        <div className="safety-callout">
          <ShieldCheck />
          <div>
            <strong>Support will never ask for your OTP or seed phrase.</strong>
            <p>
              Only use links shown inside the application and verify Telegram handles before starting a conversation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function CommunityPage() {
  return (
    <main>
      <PageHero
        eyebrow="Mudrexx community"
        title="Learn together. Grow together."
        copy="Join market conversations, practical learning sessions, and product updates."
      />
      <section className="container community-content">
        <div className="community-feature">
          <div>
            <span className="eyebrow eyebrow-light">COMMUNITY SPOTLIGHT</span>
            <h2>Crypto feels clearer when no one learns alone.</h2>
            <p>
              Get weekly market explainers, security tips, and live product walkthroughs—without hype or guaranteed-return claims.
            </p>
            <a className="btn btn-white btn-lg" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
              Join on Telegram <ExternalLink />
            </a>
          </div>
          <div className="community-orbit">
            <span>
              <Users />
            </span>
            <i />
            <i />
            <i />
            <b>
              12K<small>learning moments</small>
            </b>
          </div>
        </div>
        <div className="community-grid">
          <CommunityCard
            icon={<BookOpen />}
            label="LEARN"
            title="Market basics"
            copy="Short, practical explainers for spot, futures scenarios, staking, and wallet safety."
          />
          <CommunityCard
            icon={<Globe2 />}
            label="CONNECT"
            title="Weekly office hours"
            copy="Bring questions and learn how product features work with a guided walkthrough."
          />
          <CommunityCard
            icon={<ShieldCheck />}
            label="STAY SAFE"
            title="Security watch"
            copy="Recognise impersonation, phishing, and promises that sound too good to be true."
          />
        </div>
        <div className="community-guidelines">
          <div>
            <h3>Built for useful conversations</h3>
            <p>Our community principles keep every space respectful and practical.</p>
          </div>
          {['No guaranteed-return claims', 'No unsolicited direct messages', 'Never share account secrets', 'Respect every learning level'].map(
            (item) => (
              <span key={item}>
                <Check />
                {item}
              </span>
            )
          )}
        </div>
      </section>
    </main>
  );
}

function AccountDocumentsSection() {
  const { user, notify } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [proof, setProof] = useState<AccountProof | null>(null);
  const [agreement, setAgreement] = useState<AccountAgreement | null>(null);
  const [invoice, setInvoice] = useState<AccountInvoice | null>(null);

  const handleGenerateInvoice = async () => {
    if (!user) return;
    setLoading('invoice');
    try {
      const response = await getAccountInvoice(user.email);
      if (response.success && response.invoice) {
        setInvoice(response.invoice);
        const doc = generateInvoicePDF(response.invoice);
        downloadPDF(doc, `invoice-${response.invoice.invoiceId}.pdf`);
        notify('Invoice Generated', 'Your invoice has been downloaded as PDF.', 'success');
      } else {
        notify('Error', response.error || 'Failed to generate invoice', 'warning');
      }
    } catch {
      notify('Error', 'Failed to generate invoice. Please try again.', 'warning');
    } finally {
      setLoading(null);
    }
  };

  const handleGeneratePayoutAgreement = async () => {
    if (!user) return;
    setLoading('payout');
    try {
      const response = await getAccountAgreement(user.email);
      if (response.success && response.agreement) {
        const doc = generateAgreementPDF(response.agreement, 'Agreement / Payout Terms');
        downloadPDF(doc, `payout-agreement-${response.agreement.agreementId}.pdf`);
        notify('Payout Terms Generated', 'Your payout agreement has been downloaded as PDF.', 'success');
      } else {
        notify('Error', response.error || 'Failed to generate payout agreement', 'warning');
      }
    } catch {
      notify('Error', 'Failed to generate payout agreement. Please try again.', 'warning');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateStatement = async () => {
    if (!user) return;
    setLoading('statement');
    try {
      const response = await getAccountStatement(user.email);
      if (response.success && response.statement) {
        setStatement(response.statement);
        const doc = generateStatementPDF(response.statement);
        downloadPDF(doc, `account-statement-${statement?.statementId || Date.now()}.pdf`);
        notify('Statement Generated', 'Your account statement has been downloaded as PDF.', 'success');
      } else {
        notify('Error', response.error || 'Failed to generate statement', 'warning');
      }
    } catch (error) {
      notify('Error', 'Failed to generate statement. Please try again.', 'warning');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateProof = async () => {
    if (!user) return;
    setLoading('proof');
    try {
      const response = await getAccountProof(user.email);
      if (response.success && response.proof) {
        setProof(response.proof);
        const doc = generateProofPDF(response.proof);
        downloadPDF(doc, `proof-of-account-${response.proof.proofId}.pdf`);
        notify('Proof Generated', 'Your proof of account has been downloaded as PDF.', 'success');
      } else {
        notify('Error', response.error || 'Failed to generate proof', 'warning');
      }
    } catch (error) {
      notify('Error', 'Failed to generate proof. Please try again.', 'warning');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateAgreement = async () => {
    if (!user) return;
    setLoading('agreement');
    try {
      const response = await getAccountAgreement(user.email);
      if (response.success && response.agreement) {
        setAgreement(response.agreement);
        const doc = generateAgreementPDF(response.agreement);
        downloadPDF(doc, `account-agreement-${response.agreement.agreementId}.pdf`);
        notify('Agreement Generated', 'Your account agreement has been downloaded as PDF.', 'success');
      } else {
        notify('Error', response.error || 'Failed to generate agreement', 'warning');
      }
    } catch (error) {
      notify('Error', 'Failed to generate agreement. Please try again.', 'warning');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="settings-card account-documents-section" id="documents">
      <div className="card-heading">
        <div>
          <h3>Account Documents</h3>
          <p>Backend-generated documents: statement, proof, agreements and invoices — download as PDF.</p>
        </div>
        <FileText />
      </div>

      <div className="documents-grid">
        {/* Account Statement */}
        <div className="document-card">
          <div className="document-icon">
            <History size={24} />
          </div>
          <div className="document-info">
            <h4>Account Statement</h4>
            <p>Comprehensive transaction history, balance summary, and frozen funds details.</p>
            <ul>
              <li>Complete transaction history</li>
              <li>Balance breakdown (Real, Frozen, Demo)</li>
              <li>Frozen funds details</li>
              <li>Asset holdings summary</li>
            </ul>
          </div>
          <button
            className="btn btn-purple btn-sm"
            onClick={handleGenerateStatement}
            disabled={loading === 'statement'}
          >
            {loading === 'statement' ? (
              <>
                <RefreshCcw size={14} className="spinning" /> Generating...
              </>
            ) : (
              <>
                <Download size={14} /> Download Statement
              </>
            )}
          </button>
        </div>

        {/* Proof of Account */}
        <div className="document-card">
          <div className="document-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="document-info">
            <h4>Proof of Account</h4>
            <p>Official verification document confirming your account status and details.</p>
            <ul>
              <li>Account verification status</li>
              <li>Current balance snapshot</li>
              <li>KYC verification details</li>
              <li>Account age and activity</li>
            </ul>
          </div>
          <button
            className="btn btn-purple btn-sm"
            onClick={handleGenerateProof}
            disabled={loading === 'proof'}
          >
            {loading === 'proof' ? (
              <>
                <RefreshCcw size={14} className="spinning" /> Generating...
              </>
            ) : (
              <>
                <Download size={14} /> Download Proof
              </>
            )}
          </button>
        </div>

        {/* Account Agreement */}
        <div className="document-card">
          <div className="document-icon">
            <BookOpen size={24} />
          </div>
          <div className="document-info">
            <h4>Account Agreement</h4>
            <p>Terms and conditions, trading risks, and platform policies.</p>
            <ul>
              <li>Terms and conditions</li>
              <li>Trading risk disclosure</li>
              <li>Privacy policy summary</li>
              <li>User acceptance record</li>
            </ul>
          </div>
          <button
            className="btn btn-purple btn-sm"
            onClick={handleGenerateAgreement}
            disabled={loading === 'agreement'}
          >
            {loading === 'agreement' ? (
              <>
                <RefreshCcw size={14} className="spinning" /> Generating...
              </>
            ) : (
              <>
                <Download size={14} /> Download Agreement
              </>
            )}
          </button>
        </div>

        {/* Agreement / Payout document */}
        <div className="document-card">
          <div className="document-icon">
            <Banknote size={24} />
          </div>
          <div className="document-info">
            <h4>Agreement / Payout Terms</h4>
            <p>Payout, settlement and withdrawal-review terms attached to your account.</p>
            <ul>
              <li>Payout &amp; settlement rules</li>
              <li>Withdrawal review process</li>
              <li>Frozen funds handling</li>
              <li>Dispute &amp; contact route</li>
            </ul>
          </div>
          <button
            className="btn btn-purple btn-sm"
            onClick={handleGeneratePayoutAgreement}
            disabled={loading === 'payout'}
          >
            {loading === 'payout' ? (
              <>
                <RefreshCcw size={14} className="spinning" /> Generating...
              </>
            ) : (
              <>
                <Download size={14} /> Download Payout Terms
              </>
            )}
          </button>
        </div>

        {/* Invoice */}
        <div className="document-card">
          <div className="document-icon">
            <CreditCard size={24} />
          </div>
          <div className="document-info">
            <h4>Invoice</h4>
            <p>Invoice for deposits and conversions credited to your account (fees from the backend).</p>
            <ul>
              <li>Line items from credited funds</li>
              <li>Platform fee &amp; tax totals</li>
              <li>Billing identity from the backend</li>
              <li>Balance due status</li>
            </ul>
          </div>
          <button
            className="btn btn-purple btn-sm"
            onClick={handleGenerateInvoice}
            disabled={loading === 'invoice'}
          >
            {loading === 'invoice' ? (
              <>
                <RefreshCcw size={14} className="spinning" /> Generating...
              </>
            ) : (
              <>
                <Download size={14} /> Download Invoice
              </>
            )}
          </button>
        </div>
      </div>

      {/* Document History */}
      {(statement || proof || agreement || invoice) && (
        <div className="document-history">
          <h4>Recently Generated Documents</h4>
          <div className="history-list">
            {statement && (
              <div className="history-item">
                <FileText size={16} />
                <div>
                  <strong>Account Statement</strong>
                  <small>ID: {statement.statementId} • Generated: {new Date(statement.generatedAt).toLocaleString()}</small>
                </div>
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    const doc = generateStatementPDF(statement);
                    downloadPDF(doc, `account-statement-${statement.statementId}.pdf`);
                  }}
                >
                  <Download size={12} /> Re-download
                </button>
              </div>
            )}
            {proof && (
              <div className="history-item">
                <ShieldCheck size={16} />
                <div>
                  <strong>Proof of Account</strong>
                  <small>ID: {proof.proofId} • Valid until: {new Date(proof.validUntil).toLocaleDateString()}</small>
                </div>
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    const doc = generateProofPDF(proof);
                    downloadPDF(doc, `proof-of-account-${proof.proofId}.pdf`);
                  }}
                >
                  <Download size={12} /> Re-download
                </button>
              </div>
            )}
            {agreement && (
              <div className="history-item">
                <BookOpen size={16} />
                <div>
                  <strong>Account Agreement</strong>
                  <small>ID: {agreement.agreementId} • Version: {agreement.terms.version}</small>
                </div>
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    const doc = generateAgreementPDF(agreement);
                    downloadPDF(doc, `account-agreement-${agreement.agreementId}.pdf`);
                  }}
                >
                  <Download size={12} /> Re-download
                </button>
              </div>
            )}
            {invoice && (
              <div className="history-item">
                <CreditCard size={16} />
                <div>
                  <strong>Invoice</strong>
                  <small>ID: {invoice.invoiceId} • Issued: {new Date(invoice.issuedAt).toLocaleDateString()}</small>
                </div>
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    const doc = generateInvoicePDF(invoice);
                    downloadPDF(doc, `invoice-${invoice.invoiceId}.pdf`);
                  }}
                >
                  <Download size={12} /> Re-download
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="documents-info-banner">
        <Info size={16} />
        <div>
          <strong>About Account Documents</strong>
          <p>
            All documents are generated in real-time from your account data. Statements include your complete
            transaction history, while proof of account serves as official verification. The agreement document
            contains the terms you accepted during registration.
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountNav({ active }: { active: 'profile' | 'wallet' }) {
  const { user } = useApp();
  const totalNet = user ? (user.wallet.realBalance + user.wallet.frozenBalance) : 0;
  const frozen = user ? user.wallet.frozenBalance : 0;

  return (
    <aside className="account-nav">
      <span>ACCOUNT</span>
      <Link className={active === 'profile' ? 'active' : ''} to="/profile">
        <Settings size={16} /> Profile settings <ChevronRight size={14} />
      </Link>
      <Link className={active === 'wallet' ? 'active' : ''} to="/wallet">
        <WalletIcon size={16} /> Wallet
        {frozen > 0 && <span className="nav-frozen-badge">🔒</span>}
        <ChevronRight size={14} />
      </Link>
      <Link to="/orders">
        <History size={16} /> Order history <ChevronRight size={14} />
      </Link>
      <Link to="/tasks">
      <ListChecks size={16} /> Tasks <ChevronRight size={14} />
      </Link>
      <Link to="/support">
        <Headphones size={16} /> Support <ChevronRight size={14} />
      </Link>
      <Link to="/community">
        <Users size={16} /> Community <ChevronRight size={14} />
      </Link>
      <div>
        <ShieldCheck size={16} />
        <p>
          <strong>Security tip</strong>
          Enable two-factor authentication before funding your account.
        </p>
      </div>
    </aside>
  );
}

function SettingRow({
  icon,
  title,
  copy,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  action: string;
}) {
  return (
    <div className="setting-row">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{copy}</small>
      </div>
      <button>
        {action} <ChevronRight />
      </button>
    </div>
  );
}

function CommunityCard({
  icon,
  label,
  title,
  copy,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  copy: string;
}) {
  return (
    <article>
      <span>{icon}</span>
      <small>{label}</small>
      <h3>{title}</h3>
      <p>{copy}</p>
      <button>
        Explore <ArrowRight />
      </button>
    </article>
  );
}
