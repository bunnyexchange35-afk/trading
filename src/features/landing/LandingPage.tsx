/**
 * Public landing page.
 *
 * Honesty constraints baked in (audit F4/F8/F9):
 *  - no claim that deposits are collected by a payment gateway
 *  - no claim that withdrawals are paid out automatically
 *  - no claim that staking yields are credited
 *  - no guaranteed-return or risk-free language
 * The market ticker uses live `/api/markets` data only.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Coins,
  FileText,
  LifeBuoy,
  Lock,
  MessageSquare,
  ShieldCheck,
  Star,
  Wallet as WalletIcon,
} from 'lucide-react';
import { getMarkets } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Button, Skeleton } from '../../components/ui';
import { compactNumber, price, signedPercent } from '../../utils/format';

const FEATURES = [
  {
    icon: <BarChart3 size={19} />,
    title: 'Live market desk',
    body: 'Real prices, candles and backend-computed technical analysis across 30 markets — trend, RSI, MACD, support and resistance.',
  },
  {
    icon: <Lock size={19} />,
    title: 'Direction trading',
    body: 'Take an up or down view for 30 seconds to 24 hours. Your stake is held in frozen funds until the backend settles the order at expiry.',
  },
  {
    icon: <WalletIcon size={19} />,
    title: 'One transparent ledger',
    body: 'Available, frozen and credit balances in INR and USDT, with every movement recorded as a ledger entry you can trace.',
  },
  {
    icon: <Coins size={19} />,
    title: 'Flexible vaults',
    body: 'Park INR in a flexible vault and release it whenever you want. Indicative APY is shown; yields are not automatically credited.',
  },
  {
    icon: <Star size={19} />,
    title: 'Tasks & credit profile',
    body: 'Onboarding tasks plus a backend-computed credit score and category that reflect your activity — never calculated in your browser.',
  },
  {
    icon: <FileText size={19} />,
    title: 'Account documents',
    body: 'Statement, proof of account, agreement and invoice generated from your real account data and downloadable as PDF.',
  },
  {
    icon: <LifeBuoy size={19} />,
    title: 'Human support',
    body: 'Raise a ticket by category. Withdrawal requests are reviewed by the support team rather than executed automatically.',
  },
  {
    icon: <MessageSquare size={19} />,
    title: 'NOVA assistant',
    body: 'A grounded assistant that answers from your own account, markets and orders — scoped to the topics the backend allows.',
  },
];

const STEPS = [
  { n: '01', title: 'Create your account', body: 'Start directly at ₹0.00 available balance with credits so you can explore the desk before risking anything.' },
  { n: '02', title: 'Add funds for review', body: 'Submit a deposit and it is booked to frozen funds as pending until the team verifies it.' },
  { n: '03', title: 'Trade and track', body: 'Place directional orders, watch them settle at expiry against the live price, and follow every ledger entry.' },
];

export default function LandingPage() {
  const markets = useAsync(() => getMarkets().then((r) => r.data), []);
  const ticker = (markets.data ?? []).slice(0, 12);

  return (
    <>
      {/* live ticker */}
      <div className="ticker" aria-label="Live market prices">
        {markets.loading && !markets.data && (
          <Skeleton className="sk-line" style={{ width: 320, marginBottom: 0 }} />
        )}
        {markets.error && <span className="xs faint">Live prices unavailable right now.</span>}
        {ticker.map((m) => (
          <span className="ticker-item" key={m.symbol}>
            <strong>{m.symbol}</strong>
            <span className="muted">${price(m.price)}</span>
            <span className={m.change >= 0 ? 'up' : 'down'}>{signedPercent(m.change)}</span>
          </span>
        ))}
      </div>

      <div className="page">
        {/* ---------------------------------------------------------- hero */}
        <section className="hero">
          <h1 className="hero-title">
            A way to earn <em>in real life</em>
          </h1>
          <p className="hero-sub">
            Mudrexx Earn is a market desk that puts live prices, directional orders, a
            transparent ledger and a backend-computed credit profile in one place — built for
            people learning to trade with real discipline, not promises.
          </p>
          <div className="hero-cta">
            <Link to="/auth/register">
              <Button variant="primary" size="lg">
Create your account <ArrowRight size={17} />
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 'var(--sp-8)', maxWidth: 860, marginInline: 'auto' }}>
            {[
              { label: 'Markets tracked', value: String(markets.data?.length ?? '—') },
              { label: 'Order duration', value: '30s – 24h' },
              { label: 'Settlement', value: 'At expiry, live price' },
              { label: 'Ledgers', value: 'INR · USDT · Credit' },
            ].map((s) => (
              <div className="stat" key={s.label}>
                <span className="stat-label">{s.label}</span>
                <span className="stat-value stat-value-sm num">{s.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- top markets */}
        <section id="markets" style={{ marginTop: 'var(--sp-9)' }}>
          <div className="spread" style={{ marginBottom: 'var(--sp-4)' }}>
            <div>
              <span className="eyebrow">Markets</span>
              <h2 style={{ fontSize: 'var(--fs-2xl)', marginTop: 6 }}>Live across the desk</h2>
            </div>
            <Link to="/auth/register">
              <Button variant="ghost" size="sm">
                Open full list <ArrowRight size={14} />
              </Button>
            </Link>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th className="table-numeric">Price</th>
                    <th className="table-numeric">24h</th>
                    <th className="table-numeric">High</th>
                    <th className="table-numeric">Low</th>
                    <th className="table-numeric">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.loading && !markets.data && (
                    <tr>
                      <td colSpan={6}>
                        <Skeleton className="sk-block" />
                      </td>
                    </tr>
                  )}
                  {markets.error && (
                    <tr>
                      <td colSpan={6} className="faint small" style={{ textAlign: 'center', padding: 'var(--sp-6)' }}>
                        Market data is unavailable from the provider right now.
                      </td>
                    </tr>
                  )}
                  {(markets.data ?? []).slice(0, 8).map((m) => (
                    <tr key={m.symbol}>
                      <td>
                        <div className="row-tight">
                          <span
                            aria-hidden="true"
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              background: m.soft || 'var(--surface-raised)',
                              color: m.color || 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {m.mark || m.symbol[0]}
                          </span>
                          <span>
                            <strong>{m.symbol}</strong>
                            <span className="faint xs" style={{ marginLeft: 6 }}>
                              {m.name}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="table-numeric mono">${price(m.price)}</td>
                      <td className={`table-numeric mono ${m.change >= 0 ? 'up' : 'down'}`}>
                        {signedPercent(m.change)}
                      </td>
                      <td className="table-numeric mono muted">${price(m.high)}</td>
                      <td className="table-numeric mono muted">${price(m.low)}</td>
                      <td className="table-numeric mono muted">{compactNumber(m.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ how it works */}
        <section id="how" style={{ marginTop: 'var(--sp-9)' }}>
          <span className="eyebrow">How it works</span>
          <h2 style={{ fontSize: 'var(--fs-2xl)', margin: '6px 0 var(--sp-6)' }}>
            Four steps, no shortcuts
          </h2>
          <div className="feature-grid">
            {STEPS.map((step) => (
              <div className="feature" key={step.n}>
                <span className="eyebrow gold">{step.n}</span>
                <h3 style={{ marginTop: 8 }}>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------- features */}
        <section id="features" style={{ marginTop: 'var(--sp-9)' }}>
          <span className="eyebrow">Platform</span>
          <h2 style={{ fontSize: 'var(--fs-2xl)', margin: '6px 0 var(--sp-6)' }}>
            Everything the desk actually does
          </h2>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <div className="feature" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- disclosure */}
        <section style={{ marginTop: 'var(--sp-9)' }}>
          <div className="card card-pad">
            <div className="row-tight" style={{ marginBottom: 'var(--sp-3)' }}>
              <ShieldCheck size={17} className="gold" />
              <h2 className="card-title">What we do not promise</h2>
            </div>
            <ul className="stack" style={{ gap: 'var(--sp-2)' }}>
              {[
                'No guaranteed profit, guaranteed returns, or risk-free earnings. Directional orders can settle against you and your stake is lost.',
                'Deposits are recorded as pending in your frozen balance and require manual verification — the platform does not collect payment through this site.',
                'Withdrawals are submitted to the support team for review. They are not paid out automatically by the platform.',
                'Vault APY is indicative. Yield is not automatically credited to your balance, and releasing a vault returns your principal.',
                'Nothing here is investment, tax or legal advice.',
              ].map((line) => (
                <li key={line} className="small muted" style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <span className="gold" aria-hidden="true">
                    ·
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --------------------------------------------------------------- cta */}
        <section style={{ marginTop: 'var(--sp-9)', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'var(--fs-3xl)' }}>Ready when you are</h2>
          <p className="hero-sub" style={{ marginTop: 'var(--sp-3)' }}>
            Create your account directly and open your trading desk.
          </p>
          <div className="hero-cta">
            <Link to="/auth/register">
              <Button variant="primary" size="lg">
                Create account <ArrowRight size={17} />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
