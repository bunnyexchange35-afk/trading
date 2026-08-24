import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Blocks, Check, ChevronRight, CircleDollarSign, Clock3, Globe2,
  Landmark, LineChart, LockKeyhole, Play, ShieldCheck, Sparkles, TrendingUp, WalletCards,
  Music, Headphones, Zap
} from 'lucide-react';
import { CoinIcon } from './components';
import { INR_RATE, money } from './data';
import { useMarket } from './market-context';
import { useApp } from './app-context';

function TradeCenterStage() {
  const navigate = useNavigate();
  const { user, openAuth } = useApp();
  const handleTrade = () => {
    if (!user) { openAuth('signup'); return; }
    navigate('/instant-order');
  };
  return (
    <section className="trade-center-section">
      <div className="container trade-center-container">
        <div className="trade-center-label">
          <span className="eyebrow">Feel the rhythm</span>
          <h2>Trade in tune with the market</h2>
          <p>Tap to start — live pricing, instant preview, zero noise.</p>
        </div>
        <div className="trade-stage">
          {/* Sound waves */}
          <div className="sound-waves">
            <span className="wave wave-1" />
            <span className="wave wave-2" />
            <span className="wave wave-3" />
            <span className="wave wave-4" />
            <span className="wave wave-5" />
          </div>

          {/* Central Trade Button */}
          <div className="trade-center-core">
            <button className="trade-center-btn" onClick={handleTrade} aria-label="Trade now">
              <span className="trade-btn-glow" />
              <span className="trade-btn-inner">
                <Zap size={22} />
                <b>TRADE</b>
                <small>LIVE</small>
              </span>
            </button>
            <div className="trade-orbit orbit-1" />
            <div className="trade-orbit orbit-2" />
          </div>

          {/* Little Angel enjoying music */}
          <div className="music-angel-wrap">
            <div className="music-notes">
              <i className="note n1">♪</i>
              <i className="note n2">♫</i>
              <i className="note n3">♪</i>
              <i className="note n4">♫</i>
            </div>
            <div className="angel">
              <div className="angel-halo" />
              <div className="angel-wings">
                <i className="wing left" />
                <i className="wing right" />
              </div>
              <div className="angel-head">
                <div className="angel-face">
                  <span className="eye closed left" />
                  <span className="eye closed right" />
                  <span className="smile" />
                  <span className="blush left" />
                  <span className="blush right" />
                </div>
                <div className="angel-hair" />
                <div className="angel-headphones">
                  <i className="hp-band" />
                  <i className="hp-cup left"><Headphones size={10} /></i>
                  <i className="hp-cup right"><Headphones size={10} /></i>
                </div>
              </div>
              <div className="angel-body">
                <div className="angel-robe" />
                <div className="angel-arms">
                  <i className="arm left" />
                  <i className="arm right" />
                </div>
              </div>
              <div className="angel-music-bar">
                <i /><i /><i /><i />
              </div>
            </div>
            <div className="angel-shadow" />
            <div className="angel-label">
              <Music size={12} /> vibing to market beats
            </div>
          </div>

          {/* Floating mini coins around */}
          <div className="trade-floaters">
            <span className="tf tf-btc">₿</span>
            <span className="tf tf-eth">Ξ</span>
            <span className="tf tf-sol">S</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PingPongMobile() {
  return (
    <section className="pingpong-mobile-section">
      <div className="container">
        <div className="pp-header">
          <span className="pp-kicker"><span className="pp-dot" /> Live in mobile</span>
          <h3>Ping-pong markets</h3>
          <p>Quick bounce, just like price action on your phone.</p>
        </div>
        <div className="pp-arena">
          <div className="pp-table-surface">
            <div className="pp-table-inner">
              <div className="pp-center-line" />
              <div className="pp-net">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="pp-ball" />
              <div className="pp-paddle pp-left">
                <span className="paddle-face" />
                <span className="paddle-handle" />
              </div>
              <div className="pp-paddle pp-right">
                <span className="paddle-face" />
                <span className="paddle-handle" />
              </div>
            </div>
            <div className="pp-table-edge" />
          </div>
          <div className="pp-score">
            <span>12</span>
            <em>:</em>
            <span>09</span>
          </div>
          <div className="pp-crowd">
            <i /><i /><i /><i /><i />
          </div>
        </div>
        <div className="pp-cta">
          <span>Tap to trade while you play</span>
          <Link to="/instant-order" className="btn btn-dark btn-sm">Open desk <ArrowRight size={14} /></Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { quotes, source } = useMarket();
  const { openAuth } = useApp();
  const top = quotes.slice(0, 4);
  return (
    <main>
      <section className="home-hero">
        <div className="hero-mesh" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker"><span><i /> Live markets</span><b>Powered by Binance public data</b></div>
            <h1>Make your next<br />crypto move with <em>clarity.</em></h1>
            <p>Buy, follow, and understand digital assets from one thoughtfully designed experience. Built for speed, made for everyone.</p>
            <div className="hero-actions"><button className="btn btn-purple btn-lg" onClick={() => openAuth('signup')}>Start earning <ArrowRight size={18} /></button><Link to="/market" className="btn btn-soft btn-lg\">Explore market <BarChart3 size={18} /></Link></div>
            <div className="hero-trust"><span><ShieldCheck /> Security-first experience</span><span><Clock3 /> Live 24/7 pricing</span></div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="orbit-ring ring-a" /><div className="orbit-ring ring-b" />
            <div className="floating-token token-btc"><CoinIcon asset={quotes[0]} size="lg" /><small>BTC</small></div>
            <div className="floating-token token-eth"><CoinIcon asset={quotes[1]} size="md" /><small>ETH</small></div>
            <div className="floating-token token-sol"><CoinIcon asset={quotes[3]} size="md" /><small>SOL</small></div>
            <div className="portfolio-card">
              <div className="portfolio-top"><span>Illustrative portfolio</span><button aria-label="Portfolio options">•••</button></div>
              <small>Estimated balance</small><h3>₹ 2,48,920.40</h3><span className="portfolio-gain"><TrendingUp size={14} /> +8.42% this month</span>
              <div className="mini-chart"><svg viewBox="0 0 320 105" preserveAspectRatio="none"><defs><linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d40f6" stopOpacity=".3"/><stop offset="1" stopColor="#6d40f6" stopOpacity="0"/></linearGradient></defs><path className="chart-fill" d="M0,88 C28,76 34,84 61,65 S99,78 121,52 S151,62 175,40 S215,58 236,32 S278,45 320,8 L320,105 L0,105Z"/><path className="chart-line" d="M0,88 C28,76 34,84 61,65 S99,78 121,52 S151,62 175,40 S215,58 236,32 S278,45 320,8"/></svg></div>
              <div className="portfolio-bottom"><span><i className="purple-dot" />Invested <b>₹2.06L</b></span><span><i className="mint-dot" />Returns <b>₹42.9K</b></span></div>
            </div>
            <div className="hero-profit-card"><span className="profit-icon"><CircleDollarSign /></span><div><small>Today’s movement</small><strong>+₹4,820</strong></div><em>+2.4%</em></div>
          </div>
        </div>
        <button className="watch-intro" onClick={() => window.dispatchEvent(new Event('replay-intro'))}><Play size={14} fill="currentColor" /> Watch 30s experience</button>
      </section>

      {/* Ping Pong Animation - Mobile Only */}
      <PingPongMobile />

      {/* Trade Button Centre with Sound Waves + Angel */}
      <TradeCenterStage />

      <section className="ticker-section">
        <div className="container">
          <div className="section-label"><span>Market pulse</span><i /> <b>{source}</b><Link to="/market">View all markets <ArrowRight size={15} /></Link></div>
          <div className="ticker-grid">
            {top.map((quote) => <Link to={`/instant-order?asset=${quote.symbol}`} className="ticker-card" key={quote.symbol}><div className="ticker-name"><CoinIcon asset={quote} /><span><strong>{quote.name}</strong><small>{quote.symbol} / USDT</small></span></div><div className="ticker-price"><strong>{money(quote.price)}</strong><span className={quote.change >= 0 ? 'up' : 'down'}>{quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%</span></div><div className={`spark spark-${quote.change >= 0 ? 'up' : 'down'}`}><svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d={quote.change >= 0 ? 'M0 25 C15 22, 16 10, 31 16 S47 27, 61 14 S80 18,100 3' : 'M0 5 C17 9, 21 2, 33 12 S52 7, 61 20 S82 12,100 27'} /></svg></div></Link>)}
          </div>
        </div>
      </section>

      <section className="product-section section-pad">
        <div className="container">
          <div className="section-heading centered"><span className="eyebrow">Everything in one place</span><h2>Designed around the way<br />you want to build wealth</h2><p>From your first purchase to advanced market views, every tool stays clear and connected.</p></div>
          <div className="product-grid">
            <article className="product-card product-purple"><div className="product-icon"><LineChart /></div><span>SPOT MARKET</span><h3>Own the assets<br />you believe in.</h3><p>Explore eight leading assets with live prices, simple insights, and a focused order flow.</p><Link to="/market">Explore spot <ArrowRight size={16} /></Link><div className="product-art spot-art"><div className="spot-card"><small>Bitcoin</small><strong>{money(quotes[0].price)}</strong><span>+{quotes[0].change.toFixed(2)}%</span></div><div className="spot-bars">{[34, 62, 46, 78, 56, 91].map((height) => <i key={height} style={{ height: `${height}%` }} />)}</div></div></article>
            <article className="product-card product-mint"><div className="product-icon"><Blocks /></div><span>FUTURES PREVIEW</span><h3>See both sides<br />of the market.</h3><p>Review UP and DOWN scenarios with a live chart and transparent practice controls.</p><Link to="/instant-order">Open instant order <ArrowRight size={16} /></Link><div className="product-art direction-art"><span className="direction-up"><TrendingUp /> BUY UP <b>+8.2%</b></span><span className="direction-down"><TrendingUp /> BUY DOWN <b>3.4%</b></span></div></article>
            <article className="product-card product-peach"><div className="product-icon"><Landmark /></div><span>FLEXIBLE EARN</span><h3>Put idle assets<br />to work.</h3><p>Compare indicative staking rates and understand each vault before you choose.</p><Link to="/market?tab=staking">Discover staking <ArrowRight size={16} /></Link><div className="product-art earn-art"><div><CoinIcon asset={quotes[1]} /><span><small>ETH vault</small><strong>4.7% APY</strong></span></div><div><CoinIcon asset={quotes[3]} /><span><small>SOL vault</small><strong>6.9% APY</strong></span></div></div></article>
          </div>
        </div>
      </section>

      <section className="steps-section section-pad">
        <div className="container steps-grid">
          <div className="steps-copy"><span className="eyebrow eyebrow-light">SIMPLE BY DESIGN</span><h2>From curious to confident in three steps.</h2><p>A calm, guided experience that keeps the important details in sight.</p><ul><li><span><Check /></span><div><strong>Create your profile</strong><p>Set up your account and security preferences.</p></div></li><li><span><Check /></span><div><strong>Fund your wallet</strong><p>Choose INR through bank or UPI, or USDT on TRC20.</p></div></li><li><span><Check /></span><div><strong>Follow the market</strong><p>Use live Binance market data to inform your next move.</p></div></li></ul><button className="btn btn-white btn-lg" onClick={() => openAuth('signup')}>Open free account <ChevronRight size={17} /></button></div>
          <div className="steps-phone"><div className="phone-shell"><div className="phone-top"><i /><span>Mudrexx</span><b>•••</b></div><p>Good morning 👋</p><h3>Your demo wallet</h3><div className="phone-balance"><small>Total balance</small><strong>₹1,82,640</strong><em>+12.4%</em><svg viewBox="0 0 280 70" preserveAspectRatio="none"><path d="M0 60 C31 55 35 35 66 44 S94 57 121 31 S162 46 186 25 S225 31 280 4" /></svg></div><div className="phone-actions"><span><WalletCards />Deposit</span><span><Globe2 />Market</span><span><BarChart3 />Trade</span></div><small>Top assets</small>{quotes.slice(0, 3).map((quote) => <div className="phone-asset" key={quote.symbol}><CoinIcon asset={quote} size="sm"/><span>{quote.symbol}<small>{money(quote.price * INR_RATE, 'INR')}</small></span><b className={quote.change > 0 ? 'up' : 'down'}>{quote.change > 0 ? '+' : ''}{quote.change.toFixed(1)}%</b></div>)}</div><span className="secure-float"><LockKeyhole /> Security first</span></div>
        </div>
      </section>

      <section className="cta-section section-pad"><div className="container cta-card"><div className="cta-spark"><Sparkles /></div><div><span>YOUR NEXT MOVE STARTS HERE</span><h2>Ready to make markets feel simpler?</h2><p>Join Mudrexx Earn and begin with a focused, security-first experience.</p></div><button className="btn btn-white btn-lg" onClick={() => openAuth('signup')}>Create your account <ArrowRight size={17} /></button></div></section>
    </main>
  );
}
