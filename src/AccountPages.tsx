import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Award, Banknote, Bell, BookOpen,
  Check, ChevronRight, CircleHelp, Coins, Copy, CreditCard, Download, ExternalLink, FileText,
  Flame, Globe2, Headphones, History, Info, KeyRound, Layers3, Link2, Lock, LockKeyhole,
  MessageCircle, MessagesSquare, Plus, RefreshCcw, RotateCcw, Search, Settings, ShieldCheck,
  Sparkles, TrendingUp, Unlock, User, Users, Wallet as WalletIcon, X, Zap,
} from 'lucide-react';
import { CoinIcon, EmptyState, PageHero } from './components';
import { useApp, type FrozenFundItem } from './app-context';
import {
  getWalletSummary,
  getAccountStatement,
  getAccountProof,
  getAccountAgreement,
  type WalletSummaryResponse,
  type AccountStatement,
  type AccountProof,
  type AccountAgreement,
} from './api';
import { INR_RATE, money } from './data';
import { useMarket } from './market-context';
import {
  generateStatementPDF,
  generateProofPDF,
  generateAgreementPDF,
  downloadPDF,
} from './pdf-utils';

const TELEGRAM_URL = import.meta.env.VITE_TELEGRAM_URL || 'https://t.me/MEDRIXEARN';

export function ProfilePage() {
  const { user, openAuth, notify } = useApp();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    notify('Settings saved', 'Your profile preferences have been updated.');
  };

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
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                  <span>
                    <Check /> Profile active · Joined {new Date(user.registeredAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="profile-actions-right">
                  <Link to="/wallet" className="btn btn-soft">
                    <WalletIcon size={16} /> View Wallet
                  </Link>
                </div>
              </div>

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
                    <input defaultValue={user.name} required />
                  </label>
                  <label>
                    <span>Email address</span>
                    <input defaultValue={user.email} type="email" required />
                  </label>
                  <label>
                    <span>Mobile number</span>
                    <input defaultValue={user.phone || ''} placeholder="+91 98765 43210" />
                  </label>
                  <label>
                    <span>Preferred currency</span>
                    <select defaultValue={user.preferredCurrency || 'INR'}>
                      <option value="INR">INR (₹)</option>
                      <option value="USDT">USDT (₮)</option>
                    </select>
                  </label>
                </div>
                <button className="btn btn-purple">Save changes</button>
              </form>

              <div className="settings-card security-settings">
                <div className="card-heading">
                  <div>
                    <h3>Security & Linking</h3>
                    <p>Account protections and verified linking controls.</p>
                  </div>
                  <ShieldCheck />
                </div>
                <SettingRow icon={<Link2 />} title="Demo to Real Account Link" copy="Demo earnings linked for conversion" action="Active" />
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

  // State for Conversion Tool
  const [convertAmount, setConvertAmount] = useState('1000');
  const [conversionTab, setConversionTab] = useState<'convert' | 'history'>('convert');
  const [frozenFilter, setFrozenFilter] = useState<'all' | 'deposit' | 'order' | 'staking'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'conversion' | 'deposit' | 'trade'>('all');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [accountView, setAccountView] = useState<'all' | 'real' | 'demo'>('all');
  const [summary, setSummary] = useState<WalletSummaryResponse['summary'] | null>(null);

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

  const handleWithdrawSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      notify('Invalid amount', 'Enter a valid withdrawal amount.', 'warning');
      return;
    }
    if (amt > availableRealINR) {
      notify('Insufficient available balance', `You have ₹${availableRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} available to withdraw. Frozen funds (₹${frozenRealINR.toLocaleString()}) cannot be withdrawn until released.`, 'warning');
      return;
    }
    notify('Withdrawal submitted', `₹${amt.toLocaleString('en-IN')} withdrawal request submitted for sandbox processing.`, 'info');
    setShowWithdrawModal(false);
    setWithdrawAmount('');
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
                <button className="btn btn-glass" onClick={() => setShowWithdrawModal(true)}>
                  <ArrowDownLeft size={15} /> Withdraw
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

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="modal-layer">
          <button className="modal-backdrop" onClick={() => setShowWithdrawModal(false)} />
          <div className="withdraw-modal auth-modal">
            <button className="modal-close" onClick={() => setShowWithdrawModal(false)}>
              <X size={18} />
            </button>
            <div className="auth-heading">
              <span className="eyebrow">WITHDRAW FUNDS</span>
              <h2>Withdraw INR / USDT</h2>
              <p>Transfer available balance to your verified bank or crypto wallet.</p>
            </div>

            <div className="withdraw-balance-callout">
              <div>
                <small>AVAILABLE FOR WITHDRAWAL</small>
                <strong>₹{availableRealINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="frozen-notice-mini">
                <Lock size={13} />
                <span>₹{frozenRealINR.toLocaleString()} is frozen in active orders/vaults</span>
              </div>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="withdraw-form">
              <label>
                <span>Amount to withdraw</span>
                <div className="large-amount">
                  <b>₹</b>
                  <input
                    type="number"
                    min="100"
                    max={availableRealINR}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                  />
                  <em>INR</em>
                </div>
              </label>

              <label>
                <span>Payout destination</span>
                <input placeholder="UPI ID (e.g. name@bank) or Bank Account Number" required />
              </label>

              <button
                type="submit"
                className="btn btn-purple btn-full btn-lg"
                disabled={availableRealINR <= 0}
              >
                Submit Withdrawal Request <ArrowRight size={16} />
              </button>
              <p className="form-safe">
                <ShieldCheck size={13} /> Sandbox withdrawal test flow · Account name check required.
              </p>
            </form>
          </div>
        </div>
      )}
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
  const [query, setQuery] = useState('');
  const faqs = [
    'How do INR deposits work?',
    'How do I convert demo credits to real wallet balance?',
    'Why is an amount marked as Frozen in my wallet?',
    'Which network should I use for USDT?',
    'How are live Coinbase prices calculated?',
    'How can I secure my account?',
  ];

  return (
    <main>
      <PageHero
        eyebrow="We’re here to help"
        title="How can we support you?"
        copy="Browse answers or reach the support team on Telegram."
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
          <article>
            <span className="support-action-icon">
              <MessagesSquare />
            </span>
            <div>
              <small>HELP CENTRE</small>
              <h3>Browse quick answers</h3>
              <p>Find guidance on funding, markets, account security, and more.</p>
              <b>
                View articles <ArrowRight />
              </b>
            </div>
          </article>
          <article>
            <span className="support-action-icon mint">
              <Headphones />
            </span>
            <div>
              <small>ACCOUNT HELP</small>
              <h3>Raise a request</h3>
              <p>Sign in and share the details. Never include a password or recovery phrase.</p>
              <b>
                Create request <ArrowRight />
              </b>
            </div>
          </article>
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
    <div className="settings-card account-documents-section">
      <div className="card-heading">
        <div>
          <h3>Account Documents</h3>
          <p>Download official account documents, statements, and agreements in PDF format.</p>
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
      </div>

      {/* Document History */}
      {(statement || proof || agreement) && (
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
