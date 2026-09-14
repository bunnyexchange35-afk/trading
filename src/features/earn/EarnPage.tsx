/**
 * Earn / flexible vaults.
 *
 * Built strictly against what the backend does (audit F3, F4):
 *
 *  - UNSTAKE is `POST /api/wallet/frozen/release` with the `vaultId`.
 *    `/api/staking/unstake` is advertised by `GET /api` but HAS NO HANDLER —
 *    calling it would be a dead button, so the API client does not export it.
 *  - Staking is INR-only: the endpoint debits `wallet.realBalance` and stores
 *    the entry with `currency: 'INR'`. `asset` only labels the vault. USDT
 *    staking is therefore not offered.
 *  - There is NO term and NO accrual engine. Nothing credits yield over time
 *    and releasing returns exactly the principal, so there is no maturity date,
 *    no earned-yield counter and no projected balance anywhere on this page.
 *  - `apy` is accepted from the client without validation. It is NEVER typed by
 *    a user here — it is read from `/api/markets` (`stakingApy`) and labelled
 *    indicative.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Coins, Info, Loader2, Lock, Unlock } from 'lucide-react';
import { getFrozen, getMarkets, stake, unstake } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { useAsync } from '../../hooks/useAsync';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Stat,
} from '../../components/ui';
import { money, whenLabel } from '../../utils/format';

export default function EarnPage() {
  const { wallet, refreshWallet } = useSession();
  const markets = useAsync(() => getMarkets().then((r) => r.data), []);
  const frozen = useAsync(() => getFrozen().then((r) => r.items), []);

  const [asset, setAsset] = useState<string>('BTC');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<{ id: string; title: string; amount: number } | null>(null);

  const assets = markets.data ?? [];
  const chosen = assets.find((a) => a.symbol === asset);
  // APY comes from the backend's own market payload, never from user input.
  const apy = chosen?.stakingApy ?? 0;

  const vaults = useMemo(
    () => (frozen.data ?? []).filter((item) => item.category === 'staking'),
    [frozen.data],
  );
  const stakedTotal = vaults.reduce((sum, v) => sum + v.amount, 0);
  const available = wallet?.realBalance ?? 0;

  const numeric = Number(amount || 0);
  const amountError = !amount.trim()
    ? null
    : !Number.isFinite(numeric) || numeric <= 0
      ? 'Enter a positive amount.'
      : numeric > available
        ? `Only ${money(available)} is available.`
        : null;

  const refreshAll = async () => {
    await refreshWallet();
    frozen.refresh();
  };

  const onStake = async () => {
    if (amountError || !numeric) {
      setError(amountError ?? 'Enter an amount to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await stake({ asset, amount: numeric, apy });
      setDone(response.message);
      setAmount('');
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onRelease = async () => {
    if (!releaseTarget) return;
    setBusy(true);
    setError(null);
    try {
      await unstake(releaseTarget.id);
      setDone(`${money(releaseTarget.amount)} returned to your available balance.`);
      setReleaseTarget(null);
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Earn</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Flexible vaults
          </h1>
          <p className="page-sub">
            Park INR in a flexible vault and release it whenever you want. There is no lock-up
            period and no maturity date.
          </p>
        </div>
      </header>

      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <Alert tone="warn" title="Read this before you stake">
          <span className="row-tight" style={{ alignItems: 'flex-start' }}>
            <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              The APY shown is <strong>indicative</strong> and comes from the platform's market
              data. Yield is <strong>not automatically credited</strong> to your balance — the
              backend has no accrual engine, so releasing a vault returns exactly the amount you
              staked. Do not treat this as a guaranteed or accruing return.
            </span>
          </span>
        </Alert>
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {done && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="success">{done}</Alert>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Available to stake" value={money(available)} foot="INR only" small />
        <Stat label="In vaults" value={money(stakedTotal)} foot={`${vaults.length} vault(s)`} small />
        <Stat label="Indicative APY" value={chosen ? `${apy}%` : '—'} foot={chosen ? chosen.name : undefined} small />
        <Stat label="Total balance" value={money(wallet?.totalBalance ?? 0)} foot="Available + frozen" small />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        {/* ------------------------------------------------------ stake form */}
        <Card title={<span className="row-tight"><Coins size={16} className="gold" /> Open a vault</span>}>
          <div className="stack">
            <Field label="Vault label" hint="Labels the vault only — the stake is always in INR.">
              {({ id }) => (
                <div className="chips" id={id} style={{ maxHeight: 132, overflowY: 'auto' }}>
                  {markets.loading && !markets.data && <Skeleton className="sk-line" style={{ width: 180 }} />}
                  {assets.map((a) => (
                    <button
                      key={a.symbol}
                      type="button"
                      className={`chip ${asset === a.symbol ? 'chip-active' : ''}`}
                      onClick={() => setAsset(a.symbol)}
                      aria-pressed={asset === a.symbol}
                    >
                      {a.symbol} · {a.stakingApy}%
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field
              label="Amount (INR)"
              error={amountError}
              required
              hint={`Available ${money(available)} · moves to frozen funds until you release it`}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid || Boolean(amountError)}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5000"
                  prefix="₹"
                />
              )}
            </Field>

            <div className="chips">
              {[1000, 5000, 25000].filter((v) => v <= available).map((quick) => (
                <button key={quick} type="button" className="chip" onClick={() => setAmount(String(quick))}>
                  {money(quick)}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setAmount(String(Math.floor(available)))}>
                Max
              </button>
            </div>

            <div className="panel">
              <div className="kv">
                <span className="kv-key">Vault</span>
                <span className="kv-val">Flexible {asset} Staking Vault</span>
              </div>
              <div className="kv">
                <span className="kv-key">Indicative APY</span>
                <span className="kv-val gold">{apy}%</span>
              </div>
              <div className="kv">
                <span className="kv-key">Lock-up</span>
                <span className="kv-val">None — release any time</span>
              </div>
              <div className="kv">
                <span className="kv-key">You get back on release</span>
                <span className="kv-val">{money(numeric || 0)}</span>
              </div>
            </div>

            <Button variant="primary" size="lg" block onClick={onStake} loading={busy} disabled={Boolean(amountError)}>
              {!busy && <Lock size={16} />} Stake {numeric > 0 ? money(numeric) : 'INR'}
            </Button>

            <p className="xs faint">
              <Info size={11} style={{ verticalAlign: -1 }} /> Your stake moves from available to
              frozen balance immediately and appears in Wallet → Frozen funds as well as below.
            </p>
          </div>
        </Card>

        {/* ---------------------------------------------------- active vaults */}
        <Card
          title={<span className="row-tight"><Lock size={16} className="gold" /> Your vaults <Badge tone="neutral">{vaults.length}</Badge></span>}
          pad={false}
        >
          {frozen.loading && !frozen.data && (
            <div style={{ padding: 'var(--sp-5)' }}>
              <Skeleton className="sk-block" />
            </div>
          )}
          {!frozen.loading && vaults.length === 0 && (
            <EmptyState
              icon={<Coins size={20} />}
              title="No active vaults"
              body="Open a vault and it will appear here with a release button. There is no term to wait out."
            />
          )}
          {vaults.map((vault) => (
            <div
              key={vault.id}
              style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                alignItems: 'center',
                padding: 'var(--sp-4) var(--sp-5)',
                borderBottom: '1px solid var(--line-hair)',
                flexWrap: 'wrap',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--brand-soft)',
                  border: '1px solid var(--brand-line)',
                  color: 'var(--gold-300)',
                  flex: 'none',
                }}
              >
                <Coins size={16} />
              </span>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div className="row-tight">
                  <strong className="small">{vault.title}</strong>
                  <Badge tone="processing">{vault.status}</Badge>
                  {vault.apy !== undefined && <Badge tone="brand">{vault.apy}% indicative</Badge>}
                </div>
                <div className="xs faint">
                  {vault.reason} · opened {whenLabel(vault.date)}
                  {vault.asset ? ` · labelled ${vault.asset}` : ''}
                </div>
              </div>
              <div className="num strong" style={{ textAlign: 'right' }}>
                {money(vault.amount, vault.currency)}
                <div className="xs faint">principal</div>
              </div>
              {vault.canRelease && (
                <Button variant="outline" size="sm" onClick={() => setReleaseTarget({ id: vault.id, title: vault.title, amount: vault.amount })}>
                  <Unlock size={13} /> Release
                </Button>
              )}
            </div>
          ))}
          {vaults.length > 0 && (
            <div className="card-foot xs faint">
              Releasing returns the principal to your available balance instantly. No yield is
              added because none accrues.
            </div>
          )}
        </Card>
      </div>

      <Modal open={Boolean(releaseTarget)} onClose={() => !busy && setReleaseTarget(null)} title="Release vault">
        {releaseTarget && (
          <div className="stack">
            <Alert tone="info" title="You receive your principal back">
              {money(releaseTarget.amount)} returns to your available INR balance. The backend does
              not add accrued yield, so the amount released equals the amount staked.
            </Alert>
            <div className="panel">
              <div className="kv">
                <span className="kv-key">Vault</span>
                <span className="kv-val">{releaseTarget.title}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Reference</span>
                <span className="kv-val mono xs">{releaseTarget.id}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Released to available</span>
                <span className="kv-val up">{money(releaseTarget.amount)}</span>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setReleaseTarget(null)} disabled={busy}>
                Keep staked
              </Button>
              <Button variant="primary" onClick={onRelease} loading={busy}>
                {!busy && <Unlock size={15} />} Release now
              </Button>
            </div>
            {busy && (
              <span className="xs faint row-tight" style={{ justifyContent: 'center' }}>
                <Loader2 size={12} className="spin" /> Releasing…
              </span>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
