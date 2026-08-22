import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BarChart2, CheckCircle2, ChevronDown,
  Clock3, Coins, Gauge, Gift, Info, Plane, RotateCcw, ShieldCheck, Sparkles, Trophy, Wallet, X,
} from 'lucide-react';
import { CoinIcon } from './components';
import { ASSETS, INR_RATE, money } from './data';
import { useMarket } from './market-context';
import { useApp } from './app-context';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type ResultPopup = { kind: 'order' | 'win' | 'crash'; title: string; copy: string; amount?: number };

export default function InstantOrder() {
  const [params, setParams] = useSearchParams();
  const requested = (params.get('asset') || 'BTC').toUpperCase();
  const [symbol, setSymbol] = useState(ASSETS.some((item) => item.symbol === requested) ? requested : 'BTC');
  const [interval, setIntervalValue] = useState('1m');
  const [side, setSide] = useState<'up' | 'down'>('up');
  const [currency, setCurrency] = useState<'INR' | 'USDT'>('INR');
  const [amount, setAmount] = useState('1000');
  const [duration, setDuration] = useState(60);
  const [profitTarget, setProfitTarget] = useState(5);
  const [popup, setPopup] = useState<ResultPopup | null>(null);
  const { quote } = useMarket();
  const market = quote(symbol);
  const { user, openAuth } = useApp();

  const chooseSymbol = (next: string) => { setSymbol(next); setParams({ asset: next }); };
  const submitOrder = () => {
    if (!user) { openAuth('signin'); return; }
    setPopup({ kind: 'order', title: 'Order preview created', copy: `${side === 'up' ? 'BUY UP' : 'BUY DOWN'} ${symbol} at ${money(market.price)} for ${duration < 60 ? `${duration}s` : `${duration / 60}m`}. No real order was sent.` });
  };

  return (
    <main className="order-page">
      <section className="order-heading container"><div><span className="eyebrow">Instant order desk</span><h1>See the market. Choose your direction.</h1><p>Live Binance charting with a clean practice order flow.</p></div><div className="practice-badge"><ShieldCheck /><span><strong>Preview mode</strong><small>No funds are traded</small></span></div></section>
      <section className="container order-shell">
        <div className="trade-panel">
          <header className="trade-header">
            <div className="pair-selector"><CoinIcon asset={market} size="lg"/><label><span>Selected market</span><select value={symbol} onChange={(event) => chooseSymbol(event.target.value)}>{ASSETS.map((asset) => <option key={asset.symbol} value={asset.symbol}>{asset.symbol} / USDT</option>)}</select></label><ChevronDown /></div>
            <div className="market-price"><span>{money(market.price)}</span><strong className={market.change >= 0 ? 'change-up' : 'change-down'}>{market.change >= 0 ? <ArrowUp /> : <ArrowDown />}{market.change >= 0 ? '+' : ''}{market.change.toFixed(2)}%</strong></div>
            <div className="trade-stats"><span><small>24h high</small><b>{money(market.high)}</b></span><span><small>24h low</small><b>{money(market.low)}</b></span><span><small>24h volume</small><b>${(market.volume / 1e6).toFixed(1)}M</b></span></div>
          </header>
          <LiveChart symbol={symbol} interval={interval} price={market.price} change={market.change} onInterval={setIntervalValue} />
          <div className="chart-disclaimer"><span><Activity /> Streaming {symbol}/USDT public market data</span><span>Chart data is informational only</span></div>
        </div>

        <aside className="order-form-card">
          <header><div><span>New order</span><h2>Set your scenario</h2></div><span className="live-pill"><i /> LIVE</span></header>
          <div className="order-form-body">
            <div className="field-label"><span>1. Select direction</span><small>What do you expect?</small></div>
            <div className="direction-buttons"><button className={side === 'up' ? 'active up-button' : ''} onClick={() => setSide('up')}><span><ArrowUp /></span><div><strong>BUY UP</strong><small>Price may rise</small></div></button><button className={side === 'down' ? 'active down-button' : ''} onClick={() => setSide('down')}><span><ArrowDown /></span><div><strong>BUY DOWN</strong><small>Price may fall</small></div></button></div>
            <div className="field-label"><span>2. Order amount</span><small>Min. {currency === 'INR' ? '₹100' : '1 USDT'}</small></div>
            <div className="amount-field"><span>{currency === 'INR' ? '₹' : '₮'}</span><input type="number" min={currency === 'INR' ? 100 : 1} value={amount} onChange={(event) => setAmount(event.target.value)} /><div className="unit-select"><button className={currency === 'INR' ? 'active' : ''} onClick={() => setCurrency('INR')}>INR</button><button className={currency === 'USDT' ? 'active' : ''} onClick={() => setCurrency('USDT')}>USDT</button></div></div>
            <div className="quick-amounts">{(currency === 'INR' ? [500, 1000, 2500, 5000] : [10, 25, 50, 100]).map((value) => <button key={value} onClick={() => setAmount(String(value))}>+{value}</button>)}</div>
            <div className="form-grid"><div><div className="field-label"><span>3. Time</span></div><div className="choice-row">{[30, 60, 180, 300].map((value) => <button className={duration === value ? 'active' : ''} key={value} onClick={() => setDuration(value)}>{value < 60 ? `${value}s` : `${value / 60}m`}</button>)}</div></div><div><div className="field-label"><span>4. Profit target</span></div><div className="choice-row">{[3, 5, 10].map((value) => <button className={profitTarget === value ? 'active' : ''} key={value} onClick={() => setProfitTarget(value)}>{value}%</button>)}</div></div></div>
            <div className="order-summary"><span><small>Live rate</small><strong>1 {symbol} = {money(currency === 'INR' ? market.price * INR_RATE : market.price, currency === 'INR' ? 'INR' : 'USD')}</strong></span><span><small>Est. target value</small><strong>{currency === 'INR' ? '₹' : '₮'}{(Number(amount || 0) * (1 + profitTarget / 100)).toLocaleString()}</strong></span></div>
            <button className={`submit-order submit-${side}`} onClick={submitOrder}>{side === 'up' ? <ArrowUp /> : <ArrowDown />} {side === 'up' ? 'BUY UP' : 'BUY DOWN'} <span>{currency === 'INR' ? '₹' : '₮'}{Number(amount || 0).toLocaleString()}</span></button>
            <p className="preview-note"><Info /> This creates a practice preview only. It does not place an exchange order or promise a return.</p>
          </div>
        </aside>
      </section>

      <AviatorGame onResult={setPopup} />
      {popup && <ResultModal popup={popup} onClose={() => setPopup(null)} />}
    </main>
  );
}

function LiveChart({ symbol, interval, price, change, onInterval }: { symbol: string; interval: string; price: number; change: number; onInterval: (value: string) => void }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setStreaming(false);
    const loadCandles = () => {
      fetch(`/api/market/klines?symbol=${symbol}&interval=${interval}`)
        .then((response) => response.json())
        .then((body: { data: Candle[] }) => { if (active && Array.isArray(body.data)) setCandles(body.data); })
        .catch(() => undefined)
        .finally(() => { if (active) setLoading(false); });
    };
    loadCandles();
    const poller = window.setInterval(loadCandles, 15_000);
    const socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}usdt@kline_${interval}`);
    socket.onopen = () => setStreaming(true);
    socket.onmessage = (event) => {
      if (!active) return;
      try {
        const packet = JSON.parse(event.data) as { k: { t: number; o: string; h: string; l: string; c: string; v: string } };
        const next = { time: packet.k.t, open: Number(packet.k.o), high: Number(packet.k.h), low: Number(packet.k.l), close: Number(packet.k.c), volume: Number(packet.k.v) };
        setCandles((current) => {
          const trimmed = current.slice(-79);
          if (trimmed.at(-1)?.time === next.time) return [...trimmed.slice(0, -1), next];
          return [...trimmed, next];
        });
      } catch { /* malformed stream packet */ }
    };
    socket.onerror = () => setStreaming(false);
    socket.onclose = () => setStreaming(false);
    return () => { active = false; window.clearInterval(poller); socket.close(); };
  }, [symbol, interval]);

  const geometry = useMemo(() => {
    const values = candles.map((item) => item.close);
    if (!values.length) return { line: '', area: '', high: price, low: price, lastX: 0, lastY: 150 };
    const high = Math.max(...candles.map((item) => item.high));
    const low = Math.min(...candles.map((item) => item.low));
    const range = high - low || 1;
    const coords = values.map((value, index) => ({ x: (index / Math.max(values.length - 1, 1)) * 820, y: 26 + ((high - value) / range) * 232 }));
    const line = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const last = coords.at(-1)!;
    return { line, area: `${line} L820,284 L0,284 Z`, high, low, lastX: last.x, lastY: last.y };
  }, [candles, price]);

  return <div className="live-chart">
    <div className="chart-toolbar"><div className="chart-tabs"><button className="active">Price</button><button>Depth</button></div><div className="interval-tabs">{['1m', '5m', '15m', '1h'].map((value) => <button key={value} className={interval === value ? 'active' : ''} onClick={() => onInterval(value)}>{value}</button>)}<span className={streaming ? 'stream-on' : ''}><i /> {streaming ? 'Streaming' : 'Polling'}</span></div></div>
    <div className="chart-canvas">
      <div className="chart-values"><strong>{money(candles.at(-1)?.close || price)}</strong><span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}% today</span></div>
      {loading && !candles.length ? <div className="chart-loader"><BarChart2 /> Loading chart…</div> : <svg viewBox="0 0 920 310" preserveAspectRatio="none" role="img" aria-label={`${symbol} live price chart`}><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7248f5" stopOpacity=".25"/><stop offset="1" stopColor="#7248f5" stopOpacity=".015"/></linearGradient></defs>{[58, 110, 162, 214, 266].map((y) => <line key={y} x1="0" y1={y} x2="820" y2={y} className="grid-line"/>)}<path d={geometry.area} className="live-area"/><path d={geometry.line} className="live-line"/><line x1={geometry.lastX} y1="20" x2={geometry.lastX} y2="284" className="cross-line"/><circle cx={geometry.lastX} cy={geometry.lastY} r="5" className="live-dot-chart"/><text x="835" y="32">{geometry.high.toFixed(geometry.high < 10 ? 3 : 0)}</text><text x="835" y="272">{geometry.low.toFixed(geometry.low < 10 ? 3 : 0)}</text></svg>}
      <div className="chart-times"><span>Earlier</span><span>-45m</span><span>-30m</span><span>-15m</span><span>Now</span></div>
    </div>
  </div>;
}

function AviatorGame({ onResult }: { onResult: (value: ResultPopup) => void }) {
  const [credits, setCredits] = useState(10000);
  const [bet, setBet] = useState('250');
  const [state, setState] = useState<'idle' | 'flying' | 'crashed' | 'cashed'>('idle');
  const [multiplier, setMultiplier] = useState(1);
  const [history, setHistory] = useState([1.84, 3.12, 1.22, 6.48, 2.09, 1.05]);
  const timer = useRef<number | null>(null);
  const target = useRef(2.2);
  const wager = Number(bet || 0);

  const stopTimer = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null; };
  useEffect(() => stopTimer, []);
  const start = () => {
    if (state === 'flying' || wager < 10 || wager > credits) return;
    setCredits((value) => value - wager);
    setState('flying'); setMultiplier(1);
    target.current = Number((1.05 + Math.pow(Math.random(), 2.1) * 9.5).toFixed(2));
    let elapsed = 0;
    stopTimer();
    timer.current = window.setInterval(() => {
      elapsed += 0.075;
      const next = Number((1 + Math.pow(elapsed, 1.32) * 0.21).toFixed(2));
      if (next >= target.current) {
        stopTimer(); setMultiplier(target.current); setState('crashed');
        setHistory((items) => [target.current, ...items].slice(0, 8));
        onResult({ kind: 'crash', title: `Flew away at ${target.current.toFixed(2)}×`, copy: 'This round ended before cash out. Demo credits have no cash value.' });
      } else setMultiplier(next);
    }, 75);
  };
  const cashOut = () => {
    if (state !== 'flying') return;
    stopTimer();
    const reward = wager * multiplier;
    setCredits((value) => value + reward); setState('cashed');
    setHistory((items) => [multiplier, ...items].slice(0, 8));
    onResult({ kind: 'win', title: `Cashed out at ${multiplier.toFixed(2)}×`, copy: `You earned ${Math.round(reward - wager).toLocaleString()} practice credits this round.`, amount: reward });
  };

  const progress = Math.min(87, Math.max(8, (multiplier - 1) * 22));
  return <section className="aviator-section section-pad"><div className="container">
    <div className="aviator-heading"><div><span className="eyebrow">Practice & play</span><h2>Flight Lab</h2><p>Test your timing in a transparent demo-credit multiplier game.</p></div><div className="demo-wallet"><span><Wallet /></span><div><small>DEMO WALLET</small><strong>{Math.floor(credits).toLocaleString()} credits</strong></div><button onClick={() => setCredits(10000)}><RotateCcw /> Reset</button></div></div>
    <div className="aviator-shell">
      <div className={`flight-stage flight-${state}`}>
        <div className="flight-grid"/><div className="cloud cloud-a"/><div className="cloud cloud-b"/>
        <div className="flight-top"><span>FLIGHT LAB <i>DEMO</i></span><div className="round-history">{history.map((value, index) => <b key={`${value}-${index}`} className={value >= 2 ? 'hot' : ''}>{value.toFixed(2)}×</b>)}</div></div>
        <div className="multiplier-display"><small>{state === 'idle' ? 'READY FOR TAKEOFF' : state === 'crashed' ? 'FLEW AWAY' : state === 'cashed' ? 'REWARD SECURED' : 'CURRENT MULTIPLIER'}</small><strong>{multiplier.toFixed(2)}<em>×</em></strong></div>
        <svg className="flight-curve" viewBox="0 0 700 260" preserveAspectRatio="none"><defs><linearGradient id="flightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a63ff" stopOpacity=".32"/><stop offset="1" stopColor="#8a63ff" stopOpacity="0"/></linearGradient></defs><path d={`M0 245 Q ${Math.max(80, progress * 4)} 230 ${progress * 7} ${250 - progress * 2.4} L${progress * 7} 260 L0 260Z`} fill="url(#flightFill)"/><path d={`M0 245 Q ${Math.max(80, progress * 4)} 230 ${progress * 7} ${250 - progress * 2.4}`} /></svg>
        <div className="demo-plane" style={{ left: `${progress}%`, bottom: `${Math.min(76, 8 + progress * .7)}%`, transform: `rotate(${-8 - progress / 10}deg)` }}><Plane /></div>
        {state === 'crashed' && <div className="crash-cloud"><span>POOF!</span></div>}
        <span className="stage-note">Practice credits only · no monetary value · round result is random</span>
      </div>
      <aside className="flight-controls"><div className="flight-control-title"><div><Gauge /><span><strong>Manual play</strong><small>Choose when to cash out</small></span></div><span className="demo-tag">DEMO</span></div><label className="flight-bet"><span>Entry credits</span><div><Coins /><input type="number" min="10" step="10" value={bet} onChange={(event) => setBet(event.target.value)} disabled={state === 'flying'} /><b>CREDITS</b></div></label><div className="bet-chips">{[100, 250, 500, 1000].map((value) => <button key={value} disabled={state === 'flying'} onClick={() => setBet(String(value))}>{value}</button>)}</div><div className="potential-reward"><span>Current reward</span><strong>{state === 'flying' ? Math.floor(wager * multiplier).toLocaleString() : '—'} <small>credits</small></strong></div>{state === 'flying' ? <button className="cashout-button" onClick={cashOut}><Gift /> CASH OUT <span>{Math.floor(wager * multiplier).toLocaleString()}</span></button> : <button className="launch-button" onClick={start} disabled={wager < 10 || wager > credits}><Plane /> {state === 'idle' ? 'LAUNCH' : 'PLAY AGAIN'} <span>{wager.toLocaleString()}</span></button>}<p><AlertTriangle /> This is a simulated mini-game. It is not linked to deposits, real trading, or withdrawable rewards.</p><Link to="/deposit">View deposit methods <ArrowRight /></Link></aside>
    </div>
  </div></section>;
}

function ResultModal({ popup, onClose }: { popup: ResultPopup; onClose: () => void }) {
  const isWin = popup.kind === 'win';
  return <div className="modal-layer result-layer"><button className="modal-backdrop" onClick={onClose} /><div className={`result-modal result-${popup.kind}`}><button className="modal-close" onClick={onClose}><X /></button><span className="result-icon">{popup.kind === 'order' ? <CheckCircle2 /> : isWin ? <Trophy /> : <Plane />}</span>{isWin && <div className="confetti"><i/><i/><i/><i/><i/><i/></div>}<small>{popup.kind === 'order' ? 'ORDER PREVIEW' : isWin ? 'PRACTICE REWARD' : 'ROUND COMPLETE'}</small><h2>{popup.title}</h2><p>{popup.copy}</p>{popup.amount && <strong className="reward-number">+{Math.floor(popup.amount).toLocaleString()} credits</strong>}<button className="btn btn-purple btn-full" onClick={onClose}>{popup.kind === 'order' ? 'Got it' : 'Continue playing'} <ArrowRight /></button></div></div>;
}
