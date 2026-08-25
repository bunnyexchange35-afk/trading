import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ChevronDown, Clock3, Info,
  Layers3, Lock, Search, ShieldCheck, Sparkles, Star, TrendingUp, Wallet,
} from 'lucide-react';
import { CoinIcon, PageHero } from './components';
import { CATEGORIES, compact, INR_RATE, money } from './data';
import { useMarket } from './market-context';
import { useApp } from './app-context';

type Tab = 'spot' | 'futures' | 'staking';
type VaultTier = 'A' | 'B';

export default function Market() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const [tab, setTab] = useState<Tab>(requested === 'staking' || requested === 'futures' ? requested : 'spot');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [expanded, setExpanded] = useState<string | null>('BTC');
  const [currency, setCurrency] = useState<'USDT' | 'INR'>('INR');
  const { quotes, connected, source, refreshedAt, refresh } = useMarket();
  const { user, openAuth, addStakingVault, notify } = useApp();

  useEffect(() => {
    const next = params.get('tab');
    if (next === 'spot' || next === 'futures' || next === 'staking') setTab(next);
  }, [params]);

  const setActiveTab = (next: Tab) => {
    setTab(next);
    setParams(next === 'spot' ? {} : { tab: next });
    setExpanded(next === 'staking' ? 'ETH' : 'BTC');
  };

  const filtered = useMemo(
    () =>
      quotes.filter((item) => {
        const matchesQuery = `${item.symbol} ${item.name}`.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === 'All' || item.category === category;
        return matchesQuery && matchesCategory;
      }),
    [quotes, query, category]
  );

  const movers = useMemo(() => [...quotes].sort((a, b) => b.change - a.change), [quotes]);
  const topMover = movers[0];
  const totalVolume = quotes.reduce((sum, item) => sum + item.volume, 0);
  const defiCount = quotes.filter((item) => (item.stakingApyLocked ?? 0) >= 5).length;

  return (
    <main className="market-page">
      <PageHero
        eyebrow="India-first crypto desk"
        title="Every market. One live desk."
        copy="Live Coinbase pricing across 30+ assets — INR-settled spot, futures previews and DeFi staking vaults, with zero fees on every practice spot trade."
      >
        <div className="market-status">
          <span className={connected ? 'connected' : ''}>
            <i /> {source}
          </span>
          <small>
            {refreshedAt
              ? `Updated ${refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Connecting…'}
          </small>
          <button onClick={refresh}>Refresh</button>
        </div>
      </PageHero>
      <section className="container market-shell">
        <div className="market-overview">
          <div>
            <span>Assets tracked</span>
            <strong>{quotes.length}</strong>
            <small>Spot · Futures · Staking</small>
          </div>
          <div>
            <span>Live feed</span>
            <strong>{connected ? 'Coinbase' : 'Warm cache'}</strong>
            <small>Public Exchange data</small>
          </div>
          <div>
            <span>Spot fee</span>
            <strong className="positive">0%</strong>
            <small>Zero fees on practice spot</small>
          </div>
          <div>
            <span>Top mover 24h</span>
            <strong className={topMover.change >= 0 ? 'positive' : 'negative'}>
              {topMover.symbol} {topMover.change >= 0 ? '+' : ''}
              {topMover.change.toFixed(2)}%
            </strong>
            <small>${compact(totalVolume)} traded volume</small>
          </div>
        </div>
        <div className="market-card">
          <header className="market-toolbar">
            <div className="market-tabs">
              <button className={tab === 'spot' ? 'active' : ''} onClick={() => setActiveTab('spot')}>
                <BarChart3 /> Spot
              </button>
              <button className={tab === 'futures' ? 'active' : ''} onClick={() => setActiveTab('futures')}>
                <TrendingUp /> Futures
              </button>
              <button className={tab === 'staking' ? 'active' : ''} onClick={() => setActiveTab('staking')}>
                <Sparkles /> DeFi Staking
              </button>
            </div>
            <div className="market-tools">
              <label className="search-box">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" />
              </label>
              {tab !== 'staking' && (
                <div className="currency-toggle">
                  <button
                    className={currency === 'INR' ? 'active' : ''}
                    onClick={() => setCurrency('INR')}
                  >
                    INR
                  </button>
                  <button
                    className={currency === 'USDT' ? 'active' : ''}
                    onClick={() => setCurrency('USDT')}
                  >
                    USDT
                  </button>
                </div>
              )}
            </div>
          </header>
          <div className="category-strip">
            {['All', ...CATEGORIES].map((item) => (
              <button
                key={item}
                className={category === item ? 'active' : ''}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="market-table-wrap">
            <div className={`market-table-head ${tab === 'staking' ? 'staking-head' : ''}`}>
              <span>Asset</span>
              {tab === 'staking' ? (
                <>
                  <span>Flexible APY</span>
                  <span>Locked 30D APY <em className="vault-b">B</em></span>
                  <span>Est. reward /mo</span>
                </>
              ) : (
                <>
                  <span>Price</span>
                  <span>24h change</span>
                  <span>24h high</span>
                  <span>Volume</span>
                </>
              )}
              <span />
            </div>
            <div className="market-rows">
              {filtered.map((quote) => {
                const isExpanded = expanded === quote.symbol;
                const shownPrice = currency === 'INR' ? quote.price * INR_RATE : quote.price;
                return (
                  <div className={`market-row-group ${isExpanded ? 'row-expanded' : ''}`} key={quote.symbol}>
                    <button
                      className={`market-row ${tab === 'staking' ? 'staking-row' : ''}`}
                      onClick={() => setExpanded(isExpanded ? null : quote.symbol)}
                    >
                      <span className="asset-cell">
                        <Star size={15} />
                        <CoinIcon asset={quote} />
                        <span>
                          <strong>{quote.name}</strong>
                          <small>
                            {quote.symbol}{' '}
                            {tab === 'futures'
                              ? 'Perpetual'
                              : tab === 'spot'
                              ? `/ ${currency}`
                              : `${quote.category} vault`}
                          </small>
                        </span>
                      </span>
                      {tab === 'staking' ? (
                        <>
                          <span className="apy-cell">
                            {quote.stakingApy?.toFixed(1)}% <small>APY</small>
                          </span>
                          <span className="apy-cell apy-locked">
                            {quote.stakingApyLocked?.toFixed(1)}% <small>APY</small>
                          </span>
                          <span>
                            ₹{(((1000 * (quote.stakingApyLocked || quote.stakingApy || 0)) / 100) / 12).toFixed(0)}{' '}
                            <small>/ ₹1,000</small>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="price-cell">
                            {money(shownPrice, currency === 'INR' ? 'INR' : 'USD')}
                          </span>
                          <span className={quote.change >= 0 ? 'change-up' : 'change-down'}>
                            {quote.change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                            {quote.change >= 0 ? '+' : ''}
                            {quote.change.toFixed(2)}%
                          </span>
                          <span>
                            {money(
                              currency === 'INR' ? quote.high * INR_RATE : quote.high,
                              currency === 'INR' ? 'INR' : 'USD'
                            )}
                          </span>
                          <span>${compact(quote.volume)}</span>
                        </>
                      )}
                      <span className="row-chevron">
                        <ChevronDown />
                      </span>
                    </button>
                    {isExpanded && (
                      <Foldout
                        quote={quote}
                        tab={tab}
                        currency={currency}
                        user={user}
                        onAuth={() => openAuth('signin')}
                        onStake={(asset, amount, apy) => addStakingVault(asset, amount, apy)}
                        notify={notify}
                      />
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="market-empty">
                  No assets match “{query}”. Try another symbol or category.
                </div>
              )}
            </div>
          </div>
          <footer className="market-card-footer">
            <span>
              <Info /> Prices come from Coinbase Exchange public endpoints. Staking vaults place funds in your Wallet's Frozen Amount section while accruing yield.
            </span>
            <strong>
              {filtered.length} assets · {defiCount} B-tier DeFi vaults
            </strong>
          </footer>
        </div>
      </section>
    </main>
  );
}

function Foldout({
  quote,
  tab,
  currency,
  user,
  onAuth,
  onStake,
  notify,
}: {
  quote: ReturnType<typeof useMarket>['quotes'][number];
  tab: Tab;
  currency: 'USDT' | 'INR';
  user: ReturnType<typeof useApp>['user'];
  onAuth: () => void;
  onStake: (asset: string, amount: number, apy: number) => Promise<boolean>;
  notify: ReturnType<typeof useApp>['notify'];
}) {
  const [amount, setAmount] = useState('1000');
  const [tier, setTier] = useState<VaultTier>('A');
  const navigate = useNavigate();
  const display = currency === 'INR' ? quote.price * INR_RATE : quote.price;
  const tierApy = tier === 'A' ? quote.stakingApy || 4.7 : quote.stakingApyLocked || quote.stakingApy || 4.7;

  const handleStakeClick = async () => {
    if (!user) {
      onAuth();
      return;
    }
    const val = Number(amount);
    if (!val || val <= 0) {
      notify('Invalid amount', 'Enter a valid amount to stake in vault.', 'warning');
      return;
    }
    const success = await onStake(quote.symbol, val, tierApy);
    if (success) {
      navigate('/wallet#frozen-section');
    }
  };

  const handleSpotClick = () => {
    if (!user) {
      onAuth();
      return;
    }
    navigate(`/instant-order?asset=${quote.symbol}`);
  };

  if (tab === 'staking') {
    return (
      <div className="row-foldout stake-foldout">
        <div className="foldout-summary">
          <span className="foldout-icon">
            <Layers3 />
          </span>
          <div>
            <strong>{tier === 'A' ? 'Flexible' : 'Locked'} {quote.symbol} vault</strong>
            <p>
              {tier === 'A'
                ? 'Accrues daily yield in your Frozen Balance. Unstake anytime.'
                : '30-day locked DeFi vault with a boosted B-tier rate.'}
            </p>
          </div>
        </div>
        <div className="vault-tier-toggle">
          <button className={tier === 'A' ? 'active' : ''} onClick={() => setTier('A')}>
            <span>A</span> Flexible
          </button>
          <button className={tier === 'B' ? 'active' : ''} onClick={() => setTier('B')}>
            <span>B</span> Locked 30D
          </button>
        </div>
        <div className="stake-facts">
          <span>
            <small>Est. APY</small>
            <b>{tierApy.toFixed(1)}%</b>
          </span>
          <span>
            <small>Lock category</small>
            <b>{tier === 'A' ? 'Flexible Vault' : 'Locked Vault · 30D'}</b>
          </span>
          <span>
            <small>Redemption</small>
            <b>{tier === 'A' ? 'Instant' : 'After 30 days'}</b>
          </span>
        </div>
        <div className="stake-input-wrap">
          <label>
            <input
              type="number"
              min="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in INR"
            />
            <b>INR</b>
          </label>
          <button className="btn btn-purple" onClick={handleStakeClick}>
            <Lock size={14} /> Stake in Vault <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="row-foldout">
      <div className="foldout-summary">
        <span className="foldout-icon">
          <Wallet />
        </span>
        <div>
          <strong>{tab === 'futures' ? `${quote.symbol} UP/DOWN preview` : `Quick buy ${quote.symbol}`}</strong>
          <p>
            {tab === 'futures'
              ? 'Practice both directions of the market from the instant order desk.'
              : 'Enter an amount to see your estimated asset quantity.'}
          </p>
        </div>
      </div>
      <div className="foldout-form">
        <label>
          <span>You pay</span>
          <div>
            <input
              type="number"
              min="100"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <b>{currency}</b>
          </div>
        </label>
        <span className="equals">≈</span>
        <label>
          <span>You receive</span>
          <div>
            <strong>{(Number(amount || 0) / display).toFixed(6)}</strong>
            <b>{quote.symbol}</b>
          </div>
        </label>
      </div>
      {tab === 'futures' && (
        <div className="scenario-strip">
          <span className="scenario-up">
            <TrendingUp size={12} /> UP <b>+{(quote.change >= 0 ? quote.change : Math.abs(quote.change) / 2).toFixed(1)}%</b>
          </span>
          <span className="scenario-down">
            <ArrowDownRight size={12} /> DOWN <b>−{(quote.change < 0 ? Math.abs(quote.change) : quote.change / 2).toFixed(1)}%</b>
          </span>
          <small>Both directions settle on the order desk</small>
        </div>
      )}
      <div className="foldout-meta">
        <span>
          <Clock3 /> Live estimate
        </span>
        <span>
          <ShieldCheck /> Review before confirm
        </span>
      </div>
      {tab === 'futures' ? (
        <Link to={`/instant-order?asset=${quote.symbol}`} className="btn btn-dark">
          Open order desk <ArrowRight />
        </Link>
      ) : (
        <button className="btn btn-purple" onClick={handleSpotClick}>
          {user ? 'Open Order Desk' : 'Sign in to Trade'} <ArrowRight />
        </button>
      )}
    </div>
  );
}
