/**
 * Wallet — balances, ledger, frozen funds, deposits and withdrawal requests.
 *
 * INR and USDT are SEPARATE ledgers on the backend (`realBalance` /
 * `frozenBalance` vs `realUsdtBalance` / `frozenUsdtBalance`); demo credits are
 * a third, non-monetary ledger. The frontend never keeps its own authoritative
 * balance: every figure comes from `/api/wallet/summary` and is refreshed
 * after any action.
 */

import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Landmark,
  LifeBuoy,
  Lock,
  RefreshCw,
  Wallet as WalletIcon,
} from 'lucide-react';
import { convertDemo, getFrozen, getTransactions } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { useAsync } from '../../hooks/useAsync';
import { DepositPanel } from './DepositPanel';
import { WithdrawPanel } from './WithdrawPanel';
import { FrozenPanel } from './FrozenPanel';
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
  Tabs,
  statusTone,
} from '../../components/ui';
import { money, whenLabel } from '../../utils/format';

type WalletTab = 'deposit' | 'withdraw' | 'convert';

export default function WalletPage() {
  const { wallet, refreshWallet } = useSession();
  const [tab, setTab] = useState<WalletTab>('deposit');
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const transactions = useAsync(() => getTransactions().then((r) => r.transactions), []);
  const frozen = useAsync(() => getFrozen().then((r) => r.items), []);

  const refreshAll = async () => {
    await refreshWallet();
    transactions.refresh();
    frozen.refresh();
  };

  const onConvert = async () => {
    const credits = Number(convertAmount || 0);
    if (!Number.isFinite(credits) || credits <= 0) {
      setError('Enter a positive number of credits.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await convertDemo(credits);
      setNotice(response.message ?? 'Credits converted.');
      setConvertOpen(false);
      setConvertAmount('');
      await refreshAll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rate = wallet?.conversionRate ?? 0.1;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Wallet</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Balances & ledger
          </h1>
          <p className="page-sub">
            Available, frozen and credit balances across INR and USDT, with every movement the
            backend has recorded.
          </p>
        </div>
        <Button variant="ghost" onClick={refreshAll}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </header>

      {notice && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* ------------------------------------------------------- balances */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Stat
          label="Available · INR"
          value={wallet ? money(wallet.realBalance) : <Skeleton className="sk-line" style={{ width: 110 }} />}
          foot={`Total incl. frozen ${money(wallet?.totalBalance ?? 0)}`}
        />
        <Stat
          label="Frozen · INR"
          value={wallet ? money(wallet.frozenBalance) : <Skeleton className="sk-line" style={{ width: 110 }} />}
          foot={`${wallet?.frozenItemsCount ?? 0} held item(s)`}
        />
        <Stat
          label="Available · USDT"
          value={wallet ? `₮${wallet.realUsdtBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : <Skeleton className="sk-line" style={{ width: 90 }} />}
          foot={`Frozen ₮${(wallet?.frozenUsdtBalance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        />
        <Stat
          label="Credits"
          value={wallet ? wallet.demoBalance.toLocaleString('en-IN') : <Skeleton className="sk-line" style={{ width: 90 }} />}
          foot={`${rate} credit → ₹1 · ${money(wallet?.totalConverted ?? 0)} converted`}
        />
      </div>

      {(wallet?.depositCredited ?? 0) > 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <div className="panel small row spread">
            <span className="muted">
              <Landmark size={13} style={{ verticalAlign: -2 }} /> Verified deposits credited to
              date
            </span>
            <strong className="num">
              {money(wallet!.depositCredited)}
              {(wallet?.depositCreditedUsdt ?? 0) > 0 && ` + ₮${wallet!.depositCreditedUsdt.toLocaleString('en-US')}`}
            </strong>
          </div>
        </div>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', marginTop: 'var(--sp-4)' }}
      >
        {/* ---------------------------------------------------- transactions */}
        <Card title={<span className="row-tight"><WalletIcon size={16} className="gold" /> Transactions</span>} pad={false}>
          {transactions.loading && !transactions.data && (
            <div style={{ padding: 'var(--sp-5)' }}>
              <Skeleton className="sk-block" style={{ height: 280 }} />
            </div>
          )}
          {!transactions.loading && (transactions.data ?? []).length === 0 && (
            <EmptyState icon={<WalletIcon size={20} />} title="No ledger entries yet" body="Deposits, orders, vaults and releases all land here." />
          )}
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {(transactions.data ?? []).map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-3)',
                  alignItems: 'center',
                  padding: 'var(--sp-3) var(--sp-5)',
                  borderBottom: '1px solid var(--line-hair)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                    background: tx.tone === 'up' ? 'var(--up-soft)' : tx.tone === 'down' ? 'var(--down-soft)' : 'var(--surface-raised)',
                    color: tx.tone === 'up' ? 'var(--up)' : tx.tone === 'down' ? 'var(--down)' : 'var(--text-faint)',
                  }}
                >
                  {tx.tone === 'up' ? <ArrowDownLeft size={15} /> : tx.tone === 'down' ? <ArrowUpRight size={15} /> : <Coins size={15} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-tight">
                    <strong className="small">{tx.title}</strong>
                    <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
                  </div>
                  <div className="xs faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tx.description} · {whenLabel(tx.time)}
                  </div>
                </div>
                <div
                  className={`num strong small ${tx.tone === 'up' ? 'up' : tx.tone === 'down' ? 'down' : 'muted'}`}
                  style={{ textAlign: 'right', flex: 'none' }}
                >
                  {tx.tone === 'up' ? '+' : tx.tone === 'down' ? '−' : ''}
                  {money(tx.amount, tx.currency)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* --------------------------------------------------------- actions */}
        <div className="stack">
          <Card pad={false}>
            <div className="card-head" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <Tabs<WalletTab>
                label="Wallet actions"
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'deposit', label: 'Deposit' },
                  { id: 'withdraw', label: 'Withdraw' },
                  { id: 'convert', label: 'Credits → Real' },
                ]}
              />
            </div>
            <div className="card-body">
              {tab === 'deposit' && <DepositPanel onDone={refreshAll} />}
              {tab === 'withdraw' && <WithdrawPanel onDone={refreshAll} />}
              {tab === 'convert' && (
                <div className="stack">
                  <Alert tone="info" title="Convert credits to INR balance">
                    Convert credits into your real INR balance at the backend's rate of{' '}
                    <strong>{rate}</strong> per credit. The rate and the conversion are applied
                    server-side.
                  </Alert>
                  <div className="panel">
                    <div className="kv">
                      <span className="kv-key">Credits</span>
                      <span className="kv-val num">{(wallet?.demoBalance ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="kv">
                      <span className="kv-key">Worth</span>
                      <span className="kv-val num">{money((wallet?.demoBalance ?? 0) * rate)}</span>
                    </div>
                    <div className="kv">
                      <span className="kv-key">Converted so far</span>
                      <span className="kv-val num">{money(wallet?.totalConverted ?? 0)}</span>
                    </div>
                  </div>
                  <Button variant="primary" block onClick={() => setConvertOpen(true)} disabled={!wallet?.demoBalance}>
                    <Coins size={15} /> Convert credits
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <FrozenPanel items={frozen.data ?? []} onChanged={refreshAll} />
        </div>
      </div>

      <Modal open={convertOpen} onClose={() => !busy && setConvertOpen(false)} title="Convert credits">
        <div className="stack">
          <Alert tone="warn" title="This moves value into your real balance">
            Converted credits become real INR at {rate} per credit. The action cannot be undone
            from the frontend.
          </Alert>
          <Field label="Credits" hint={`Up to ${(wallet?.demoBalance ?? 0).toLocaleString('en-IN')} available`}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="1000"
              />
            )}
          </Field>
          {convertAmount && Number(convertAmount) > 0 && (
            <div className="panel kv">
              <span className="kv-key">You receive</span>
              <span className="kv-val up">{money(Number(convertAmount) * rate)}</span>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConvertOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConvert} loading={busy}>
              {!busy && <Lock size={14} />} Convert
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* Re-exported for the wallet tab icons used in nav affordances. */
export const WALLET_ICONS = { WalletIcon, Landmark, LifeBuoy };
