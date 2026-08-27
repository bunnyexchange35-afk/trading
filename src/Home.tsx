import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Blocks, Check, ChevronRight, CircleDollarSign, Clock3, Globe2,
  Landmark, LineChart, LockKeyhole, Play, ShieldCheck, Sparkles, TrendingUp, WalletCards,
} from 'lucide-react';
import { CoinIcon } from './components';
import DashboardDesk from './DashboardDesk';
import { INR_RATE, money } from './data';
import { useMarket } from './market-context';
import { useApp } from './app-context';

export default function Home() {
  const { quotes, source } = useMarket();
  const { user, openAuth, accessRequired } = useApp();
  const top = quotes.slice(0, 4);

  const realBalance = user ? user.wallet.realBalance : 0;
  const frozenBalance = user ? user.wallet.frozenBalance : 0;
  const totalNet = realBalance + frozenBalance;

  return (
    <main>
      <section className="home-hero">
        <div className="hero-mesh" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span>
                <i /> Live markets
              </span>
              <b>Powered by Coinbase live data</b>
            </div>
            <h1>
              Make your next<br />crypto move with <em>clarity.</em>
            </h1>
            <p>
              Track live markets, practice trading with demo credits, and link demo earnings for real wallet conversion.
              Clean, transparent, and built for everyone.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/wallet" className="btn btn-purple btn-lg">
                  Open Wallet (₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) <ArrowRight size={18} />
                </Link>
              ) : (
                <button className="btn btn-purple btn-lg" onClick={() => openAuth('signup')}>
                  Start earning (₹0 balance) <ArrowRight size={18} />
                </button>
              )}
              <Link to="/market" className="btn btn-soft btn-lg">
                Explore market <BarChart3 size={18} />
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck /> Security-first experience
              </span>
              <span>
                <Clock3 /> Live 24/7 pricing
              </span>
              <span>
                <Sparkles /> Demo to Real Link
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="orbit-ring ring-a" />
            <div className="orbit-ring ring-b" />
            <div className="floating-token token-btc">
              <CoinIcon asset={quotes[0]} size="lg" />
              <small>BTC</small>
            </div>
            <div className="floating-token token-eth">
              <CoinIcon asset={quotes[1]} size="md" />
              <small>ETH</small>
            </div>
            <div className="floating-token token-sol">
              <CoinIcon asset={quotes[3]} size="md" />
              <small>SOL</small>
            </div>
            <div className="portfolio-card">
              <div className="portfolio-top">
                <span>{user ? 'Your Portfolio Summary' : 'Illustrative portfolio'}</span>
                <button aria-label="Portfolio options">•••</button>
              </div>
              <small>{user ? 'Current Total Balance' : 'Estimated balance'}</small>
              <h3>
                {user
                  ? `₹ ${totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : '₹ 2,48,920.40'}
              </h3>
              <span className="portfolio-gain">
                <TrendingUp size={14} />{' '}
                {user ? (frozenBalance > 0 ? `🔒 ₹${frozenBalance.toLocaleString()} Frozen` : '100% Available') : '+8.42% this month'}
              </span>
              <div className="mini-chart">
                <svg viewBox="0 0 320 105" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#6d40f6" stopOpacity=".3" />
                      <stop offset="1" stopColor="#6d40f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="chart-fill"
                    d="M0,88 C28,76 34,84 61,65 S99,78 121,52 S151,62 175,40 S215,58 236,32 S278,45 320,8 L320,105 L0,105Z"
                  />
                  <path
                    className="chart-line"
                    d="M0,88 C28,76 34,84 61,65 S99,78 121,52 S151,62 175,40 S215,58 236,32 S278,45 320,8"
                  />
                </svg>
              </div>
              <div className="portfolio-bottom">
                <span>
                  <i className="purple-dot" />
                  Available <b>₹{realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                </span>
                <span>
                  <i className="mint-dot" />
                  Frozen <b>₹{frozenBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                </span>
              </div>
            </div>
            <div className="hero-profit-card">
              <span className="profit-icon">
                <CircleDollarSign />
              </span>
              <div>
                <small>Demo Conversion</small>
                <strong>100 DEMO = ₹10</strong>
              </div>
              <em>Linked</em>
            </div>
          </div>
        </div>
        <button className="watch-intro" onClick={() => window.dispatchEvent(new Event('replay-intro'))}>
          <Play size={14} fill="currentColor" /> Watch 10s experience
        </button>
      </section>

      {user && <DashboardDesk />}

      <section className="ticker-section">
        <div className="container">
          <div className="section-label">
            <span>Market pulse</span>
            <i /> <b>{source}</b>
            <Link to="/market">
              View all markets <ArrowRight size={15} />
            </Link>
          </div>
          <div className="ticker-grid">
            {top.map((quote) => (
              <Link to={`/instant-order?asset=${quote.symbol}`} className="ticker-card" key={quote.symbol}>
                <div className="ticker-name">
                  <CoinIcon asset={quote} />
                  <span>
                    <strong>{quote.name}</strong>
                    <small>{quote.symbol} / USDT</small>
                  </span>
                </div>
                <div className="ticker-price">
                  <strong>{money(quote.price * INR_RATE, 'INR')}</strong>
                  <small>{money(quote.price)} USDT</small>
                  <span className={quote.change >= 0 ? 'up' : 'down'}>
                    {quote.change >= 0 ? '+' : ''}
                    {quote.change.toFixed(2)}%
                  </span>
                </div>
                <div className={`spark spark-${quote.change >= 0 ? 'up' : 'down'}`}>
                  <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                    <path
                      d={
                        quote.change >= 0
                          ? 'M0 25 C15 22, 16 10, 31 16 S47 27, 61 14 S80 18,100 3'
                          : 'M0 5 C17 9, 21 2, 33 12 S52 7, 61 20 S82 12,100 27'
                      }
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="product-section section-pad">
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">Everything in one place</span>
            <h2>
              Designed around the way<br />you want to build wealth
            </h2>
            <p>From your first purchase to advanced market views, every tool stays clear and connected.</p>
          </div>
          <div className="product-grid">
            <article className="product-card product-purple">
              <div className="product-icon">
                <LineChart />
              </div>
              <span>SPOT MARKET</span>
              <h3>
                Own the assets<br />you believe in.
              </h3>
              <p>Explore thirty-plus leading assets with live Coinbase prices, category filters, and a focused order flow.</p>
              <Link to="/market">
                Explore spot <ArrowRight size={16} />
              </Link>
              <div className="product-art spot-art">
                <div className="spot-card">
                  <small>Bitcoin</small>
                  <strong>{money(quotes[0].price * INR_RATE, 'INR')}</strong>
                  <span>+{quotes[0].change.toFixed(2)}%</span>
                </div>
                <div className="spot-bars">
                  {[34, 62, 46, 78, 56, 91].map((height) => (
                    <i key={height} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
            </article>
            <article className="product-card product-mint">
              <div className="product-icon">
                <Blocks />
              </div>
              <span>FUTURES PREVIEW</span>
              <h3>
                See both sides<br />of the market.
              </h3>
              <p>Review UP and DOWN scenarios with a live chart and transparent practice controls.</p>
              <Link to="/instant-order">
                Open instant order <ArrowRight size={16} />
              </Link>
              <div className="product-art direction-art">
                <span className="direction-up">
                  <TrendingUp /> BUY UP <b>+8.2%</b>
                </span>
                <span className="direction-down">
                  <TrendingUp /> BUY DOWN <b>3.4%</b>
                </span>
              </div>
            </article>
            <article className="product-card product-peach">
              <div className="product-icon">
                <Landmark />
              </div>
              <span>FLEXIBLE EARN</span>
              <h3>
                Put idle assets<br />to work.
              </h3>
              <p>Compare A-tier flexible and B-tier locked DeFi staking rates before you choose a vault.</p>
              <Link to="/market?tab=staking">
                Discover staking <ArrowRight size={16} />
              </Link>
              <div className="product-art earn-art">
                <div>
                  <CoinIcon asset={quotes[1]} />
                  <span>
                    <small>ETH vault · B tier</small>
                    <strong>6.2% APY</strong>
                  </span>
                </div>
                <div>
                  <CoinIcon asset={quotes[3]} />
                  <span>
                    <small>SOL vault · B tier</small>
                    <strong>8.4% APY</strong>
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="steps-section section-pad">
        <div className="container steps-grid">
          <div className="steps-copy">
            <span className="eyebrow eyebrow-light">SIMPLE BY DESIGN</span>
            <h2>From curious to confident in three steps.</h2>
            <p>A calm, guided experience that keeps the important details in sight.</p>
            <ul>
              <li>
                <span>
                  <Check />
                </span>
                <div>
                  <strong>Create your profile (₹0 initial balance)</strong>
                  <p>Register in seconds and receive 10,000 practice demo credits.</p>
                </div>
              </li>
              <li>
                <span>
                  <Check />
                </span>
                <div>
                  <strong>Practice & Convert Demo to Real ₹</strong>
                  <p>Link your demo account to convert practice earnings into real wallet funds.</p>
                </div>
              </li>
              <li>
                <span>
                  <Check />
                </span>
                <div>
                  <strong>Track Frozen Amounts & Live Markets</strong>
                  <p>Clear inspection of funds locked in orders, staking vaults, or pending verification.</p>
                </div>
              </li>
            </ul>
            {user ? (
              <Link to="/wallet" className="btn btn-white btn-lg">
                View Your Wallet <ChevronRight size={17} />
              </Link>
            ) : (
              <button className="btn btn-white btn-lg" onClick={() => openAuth(accessRequired ? 'signin' : 'signup')}>
                {accessRequired ? 'Enter access link' : 'Open free account (₹0 balance)'} <ChevronRight size={17} />
              </button>
            )}
          </div>
          <div className="steps-phone">
            <div className="phone-shell">
              <div className="phone-top">
                <i />
                <span>Mudrexx</span>
                <b>•••</b>
              </div>
              <p>Good morning 👋</p>
              <h3>Your wallet desk</h3>
              <div className="phone-balance">
                <small>Total Net Balance</small>
                <strong>₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <em>{frozenBalance > 0 ? `🔒 ₹${frozenBalance.toLocaleString()} Frozen` : '100% Available'}</em>
                <svg viewBox="0 0 280 70" preserveAspectRatio="none">
                  <path d="M0 60 C31 55 35 35 66 44 S94 57 121 31 S162 46 186 25 S225 31 280 4" />
                </svg>
              </div>
              <div className="phone-actions">
                <span>
                  <WalletCards />
                  Deposit
                </span>
                <span>
                  <Globe2 />
                  Market
                </span>
                <span>
                  <BarChart3 />
                  Trade
                </span>
              </div>
              <small>Top assets</small>
              {quotes.slice(0, 3).map((quote) => (
                <div className="phone-asset" key={quote.symbol}>
                  <CoinIcon asset={quote} size="sm" />
                  <span>
                    {quote.symbol}
                    <small>{money(quote.price * INR_RATE, 'INR')}</small>
                  </span>
                  <b className={quote.change > 0 ? 'up' : 'down'}>
                    {quote.change > 0 ? '+' : ''}
                    {quote.change.toFixed(1)}%
                  </b>
                </div>
              ))}
            </div>
            <span className="secure-float">
              <LockKeyhole /> Security first
            </span>
          </div>
        </div>
      </section>

      <section className="cta-section section-pad">
        <div className="container cta-card">
          <div className="cta-spark">
            <Sparkles />
          </div>
          <div>
            <span>YOUR NEXT MOVE STARTS HERE</span>
            <h2>Ready to make markets feel simpler?</h2>
            <p>Join Mudrexx Earn, practice with demo credits, and manage real and frozen balances with clarity.</p>
          </div>
          {user ? (
            <Link to="/wallet" className="btn btn-white btn-lg">
              Go to Wallet Desk <ArrowRight size={17} />
            </Link>
          ) : (
            <button className="btn btn-white btn-lg" onClick={() => openAuth(accessRequired ? 'signin' : 'signup')}>
              {accessRequired ? 'Enter access link' : 'Create your account (₹0 balance)'} <ArrowRight size={17} />
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
