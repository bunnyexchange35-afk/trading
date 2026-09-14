/**
 * Frozen funds — the single escrow view for order holds, pending deposits,
 * staking vaults and withdrawal holds.
 *
 * `POST /api/wallet/frozen/release` is the ONE release mechanism: it unstakes a
 * vault (audit F3), cancels an open order, or pulls a pending deposit back out.
 *
 * 🔴 There is deliberately NO "approve deposit" control here. The backend's
 * `POST /api/wallet/deposit/approve` needs a token but performs NO staff-role
 * check, so an account can approve its own pending deposit and inflate the
 * credit-score input (audit F10, verified live: score 420 -> 480). It is not
 * exported by the API client and must never be reachable from a user surface.
 */

import { useState } from 'react';
import { Coins, Landmark, Loader2, Lock, Unlock, Wallet as WalletIcon } from 'lucide-react';
import { releaseFrozen, type FrozenFundItem } from '../../api';
import { errorMessage } from '../../api/client';
import { Alert, Badge, Button, Card, EmptyState, Modal, statusTone } from '../../components/ui';
import { money, whenLabel } from '../../utils/format';

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  order: { label: 'Order hold', icon: <Lock size={14} /> },
  deposit: { label: 'Pending deposit', icon: <Landmark size={14} /> },
  staking: { label: 'Vault', icon: <Coins size={14} /> },
  withdrawal: { label: 'Withdrawal hold', icon: <WalletIcon size={14} /> },
};

export function FrozenPanel({
  items,
  onChanged,
}: {
  items: FrozenFundItem[];
  onChanged: () => void | Promise<void>;
}) {
  const [target, setTarget] = useState<FrozenFundItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = items.reduce(
    (acc, item) => {
      acc[item.currency] = (acc[item.currency] ?? 0) + item.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  const confirmRelease = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await releaseFrozen(target.id);
      setTarget(null);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={
        <span className="row-tight">
          <Lock size={16} className="gold" /> Frozen funds
          <Badge tone="neutral">{items.length}</Badge>
        </span>
      }
      action={
        <span className="xs faint num">
          {totals.INR ? `${money(totals.INR)} ` : ''}
          {totals.USDT ? `₮${totals.USDT.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}
          {!totals.INR && !totals.USDT ? 'nothing held' : ''}
        </span>
      }
      pad={false}
    >
      {items.length === 0 && (
        <EmptyState
          icon={<Unlock size={20} />}
          title="No frozen funds"
          body="Order stakes, pending deposits and vaults appear here while they are held."
        />
      )}

      {items.map((item) => {
        const meta = CATEGORY_META[item.category] ?? { label: item.category, icon: <Lock size={14} /> };
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              gap: 'var(--sp-3)',
              alignItems: 'center',
              padding: 'var(--sp-3) var(--sp-5)',
              borderBottom: '1px solid var(--line-hair)',
              flexWrap: 'wrap',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--surface-raised)',
                border: '1px solid var(--line-hair)',
                color: 'var(--text-secondary)',
                flex: 'none',
              }}
            >
              {meta.icon}
            </span>

            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div className="row-tight">
                <strong className="small">{item.title}</strong>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                {item.apy !== undefined && <Badge tone="brand">{item.apy}% APY indicative</Badge>}
              </div>
              <div className="xs faint">
                {meta.label} · {item.reason || '—'} · {whenLabel(item.date)}
                {item.asset ? ` · ${item.asset}` : ''}
              </div>
            </div>

            <div className="num strong small" style={{ textAlign: 'right' }}>
              {money(item.amount, item.currency)}
            </div>

            {/* Deposits are released (withdrawn from the queue), never self-approved. */}
            {item.canRelease && (
              <Button variant="ghost" size="sm" onClick={() => setTarget(item)}>
                <Unlock size={13} />
                {item.category === 'deposit' ? 'Withdraw request' : 'Release'}
              </Button>
            )}
          </div>
        );
      })}

      <Modal
        open={Boolean(target)}
        onClose={() => !busy && setTarget(null)}
        title={target?.category === 'deposit' ? 'Withdraw this deposit request' : 'Release frozen funds'}
      >
        {target && (
          <div className="stack">
            {error && <Alert tone="error">{error}</Alert>}

            {target.category === 'order' && (
              <Alert tone="warn" title="This cancels the order">
                Releasing an order hold cancels that order and refunds the stake to your available
                balance. The backend marks it cancelled — it will not settle.
              </Alert>
            )}

            {target.category === 'staking' && (
              <Alert tone="info" title="Vault release">
                Returns your principal to available balance. Yield is not credited by the backend,
                so you receive exactly what you staked.
              </Alert>
            )}

            {target.category === 'deposit' && (
              <Alert tone="info" title="Removes the pending request">
                This takes the deposit out of the verification queue and returns the amount to your
                available balance. It does not approve or credit the deposit — approval is a manual
                back-office step.
              </Alert>
            )}

            <div className="panel">
              <div className="kv">
                <span className="kv-key">Item</span>
                <span className="kv-val">{target.title}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Reference</span>
                <span className="kv-val mono xs">{target.id}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Amount</span>
                <span className="kv-val">{money(target.amount, target.currency)}</span>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
                Keep it frozen
              </Button>
              <Button variant="primary" onClick={confirmRelease} loading={busy}>
                {!busy && <Unlock size={15} />} Release {money(target.amount, target.currency)}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {busy && (
        <div className="card-foot xs faint row-tight" style={{ justifyContent: 'center' }}>
          <Loader2 size={12} className="spin" /> Releasing…
        </div>
      )}
    </Card>
  );
}
