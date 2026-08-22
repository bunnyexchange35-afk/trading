import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ChevronDown, Clock3, Info,
  Layers3, Search, ShieldCheck, Sparkles, Star, TrendingUp, Wallet,
} from 'lucide-react';
import { CoinIcon, PageHero } from './components';
import { compact, INR_RATE, money } from './data';
import { useMarket } from './market-context';
import { useApp } from './app-context';

type Tab = 'spot' | 'futures' | 'staking';

export default function Market() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const [tab, setTab] = useState<Tab>(requested === 'staking' || requested === 'futures' ? requested : 'spot');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>('BTC');
  const [currency, setCurrency] = useState<'USDT' | 'INR'>('USDT');
  const { quotes, connected, source, refreshedAt, refresh } = useMarket();
  const { openAuth } = useApp();

  useEffect(() => {
    const next = params.get('tab');
    if (next === 'spot' || next === 'futures' || next === 'staking') setTab(next);
  }, [params]);
  const setActiveTab = (next: Tab) => { setTab(next); setParams(next === 'spot' ? {} : { tab: next }); setExpanded(next === 'staking' ? 'SOL' : 'BTC'); };
  const filtered = useMemo(() => quotes.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(query.toLowerCase())), [quotes, query]);

  return (
    <main className="market-page">
      <PageHero eyebrow="Live market" title="Market, at a glance." copy="Track prices, compare opportunities, and open a focused order form without losing your place.">
        <div className="market-status"><span className={connected ? 'connected' : ''}><i /> {source}</span><small>{refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting…'}</small><button onClick={refresh}>Refresh</button></div>
      </PageHero>
      <section className="container market-shell">
        <div className="market-overview">
          <div><span>Total tracked volume</span><strong>${compact(quotes.reduce((sum, item) => sum + item.volume, 0))}</strong><small>Across selected USDT pairs</small></div>
          <div><span>Market leaders</span><strong>{quotes.filter((item) => item.change >= 0).length} <em>/ {quotes.length}</em></strong><small>Assets positive in 24h</small></div>
          <div><span>Top mover</span><strong className="positive">{[...quotes].sort((a, b) => b.change - a.change)[0].symbol} +{[...quotes].sort((a, b) => b.change - a.change)[0].change.toFixed(2)}%</strong><small>Past 24 hours</small></div>
        </div>
        <div className="market-card">
          <header className="market-toolbar">
            <div className="market-tabs"><button className={tab === 'spot' ? 'active' : ''} onClick={() => setActiveTab('spot')}><BarChart3 /> Spot</button><button className={tab === 'futures' ? 'active' : ''} onClick={() => setActiveTab('futures')}><TrendingUp /> Futures</button><button className={tab === 'staking' ? 'active' : ''} onClick={() => setActiveTab('staking')}><Sparkles /> Staking</button></div>
            <div className="market-tools"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" /></label>{tab !== 'staking' && <div className="currency-toggle"><button className={currency === 'USDT' ? 'active' : ''} onClick={() => setCurrency('USDT')}>USDT</button><button className={currency === 'INR' ? 'active' : ''} onClick={() => setCurrency('INR')}>INR</button></div>}</div>
          </header>
          <div className="market-table-wrap">
            <div className={`market-table-head ${tab === 'staking' ? 'staking-head' : ''}`}><span>Asset</span>{tab === 'staking' ? <><span>Est. APY</span><span>Term</span><span>Est. reward</span></> : <><span>Price</span><span>24h change</span><span>24h high</span><span>Volume</span></>}<span /></div>
            <div className="market-rows">
              {filtered.map((quote) => {
                const isExpanded = expanded === quote.symbol;
                const shownPrice = currency === 'INR' ? quote.price * INR_RATE : quote.price;
                return <div className={`market-row-group ${isExpanded ? 'row-expanded' : ''}`} key={quote.symbol}>
                  <button className={`market-row ${tab === 'staking' ? 'staking-row' : ''}`} onClick={() => setExpanded(isExpanded ? null : quote.symbol)}>
                    <span className="asset-cell"><Star size={15} /><CoinIcon asset={quote} /><span><strong>{quote.name}</strong><small>{quote.symbol} {tab === 'futures' ? 'Perpetual' : tab === 'spot' ? `/ ${currency}` : 'Flexible vault'}</small></span></span>
                    {tab === 'staking' ? <><span className="apy-cell">{quote.stakingApy?.toFixed(1)}% <small>APY</small></span><span>Flexible</span><span>{(1000 * (quote.stakingApy || 0) / 100 / 12).toFixed(2)} {quote.symbol}/mo</span></> : <><span className="price-cell">{money(shownPrice, currency === 'INR' ? 'INR' : 'USD')}</span><span className={quote.change >= 0 ? 'change-up' : 'change-down'}>{quote.change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}{quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%</span><span>{money((currency === 'INR' ? quote.high * INR_RATE : quote.high), currency === 'INR' ? 'INR' : 'USD')}</span><span>${compact(quote.volume)}</span></>}
                    <span className="row-chevron"><ChevronDown /></span>
                  </button>
                  {isExpanded && <Foldout quote={quote} tab={tab} currency={currency} onAuth={() => openAuth('signup')} />}
                </div>;
              })}
            </div>
          </div>
          <footer className="market-card-footer"><span><Info /> Prices come from Binance public endpoints and may be delayed during provider outages.</span><strong>{filtered.length} assets</strong></footer>
        </div>
      </section>
    </main>
  );
}

function Foldout({ quote, tab, currency, onAuth }: { quote: ReturnType<typeof useMarket>['quotes'][number]; tab: Tab; currency: 'USDT' | 'INR'; onAuth: () => void }) {
  const [amount, setAmount] = useState('1000');
  const display = currency === 'INR' ? quote.price * INR_RATE : quote.price;
  if (tab === 'staking') return <div className="row-foldout stake-foldout"><div className="foldout-summary"><span className="foldout-icon"><Layers3 /></span><div><strong>Flexible {quote.symbol} vault</strong><p>Rewards accrue daily. The displayed APY is indicative and can change.</p></div></div><div className="stake-facts"><span><small>Est. APY</small><b>{quote.stakingApy}%</b></span><span><small>Lock period</small><b>None</b></span><span><small>Redemption</small><b>Up to 48h</b></span></div><button className="btn btn-purple" onClick={onAuth}>Start earning <ArrowRight /></button></div>;
  return <div className="row-foldout"><div className="foldout-summary"><span className="foldout-icon"><Wallet /></span><div><strong>{tab === 'futures' ? `${quote.symbol} scenario` : `Quick buy ${quote.symbol}`}</strong><p>{tab === 'futures' ? 'Preview an UP or DOWN direction from the instant order desk.' : 'Enter an amount to see your estimated asset quantity.'}</p></div></div><div className="foldout-form"><label><span>You pay</span><div><input type="number" min="100" value={amount} onChange={(event) => setAmount(event.target.value)} /><b>{currency}</b></div></label><span className="equals">≈</span><label><span>You receive</span><div><strong>{(Number(amount || 0) / display).toFixed(6)}</strong><b>{quote.symbol}</b></div></label></div><div className="foldout-meta"><span><Clock3 /> Live estimate</span><span><ShieldCheck /> Review before confirm</span></div>{tab === 'futures' ? <Link to={`/instant-order?asset=${quote.symbol}`} className="btn btn-dark">Open order desk <ArrowRight /></Link> : <button className="btn btn-purple" onClick={onAuth}>Continue <ArrowRight /></button>}</div>;
}
