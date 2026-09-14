/**
 * Withdrawals — decision S1 resolved: the TICKET path.
 *
 * Audit F8: the backend never executes payouts. Two endpoints exist:
 *   - `POST /api/withdrawal/support` (auth-gated, does NOT debit, INR + USDT,
 *     files a Withdrawal support ticket)   ← USED HERE
 *   - `POST /api/withdraw/submit` (token-gated, debits real balance
 *     immediately, INR only, no destination validation, still never pays
 *     out)                                                    ← NOT USED
 *
 * The ticket path is chosen because it cannot silently take funds from a user
 * for a payout that no code path performs. This panel says so explicitly and
 * never implies an automated bank or crypto transfer.
 */

import { useState } from 'react';
import { Info, LifeBuoy, Loader2 } from 'lucide-react';
import { requestWithdrawal } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { Alert, Button, Field, Input, Select, Textarea } from '../../components/ui';
import { money } from '../../utils/format';

export function WithdrawPanel({ onDone }: { onDone: () => void | Promise<void> }) {
  const { wallet } = useSession();
  const [currency, setCurrency] = useState<'INR' | 'USDT'>('INR');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; message: string } | null>(null);

  const available = currency === 'USDT' ? (wallet?.realUsdtBalance ?? 0) : (wallet?.realBalance ?? 0);
  const frozen = currency === 'USDT' ? (wallet?.frozenUsdtBalance ?? 0) : (wallet?.frozenBalance ?? 0);
  const numeric = Number(amount || 0);

  const amountError = !amount.trim()
    ? null
    : !Number.isFinite(numeric) || numeric <= 0
      ? 'Enter a positive amount.'
      : numeric > available
        ? `That exceeds your available ${currency} balance of ${money(available, currency)}.`
        : null;

  const submit = async () => {
    if (amountError) {
      setError(amountError);
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await requestWithdrawal({
        currency,
        ...(amount.trim() ? { amount: numeric } : {}),
        note: note.trim() || undefined,
      });
      setDone({ id: response.ticket.id, message: response.message });
      setAmount('');
      setNote('');
      await onDone();
    } catch (err) {
      // 409 = amount exceeds available balance, per the backend's own check.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {error && <Alert tone="error" title="Request not sent">{error}</Alert>}
      {done && (
        <Alert tone="success" title="Sent to support">
          {done.message}
          <div className="xs" style={{ marginTop: 4, opacity: 0.85 }}>
            Ticket <code className="mono">{done.id}</code> · track it under Support
          </div>
        </Alert>
      )}

      <Alert tone="warn" title="Withdrawals are reviewed, not automated">
        <span className="row-tight" style={{ alignItems: 'flex-start' }}>
          <Info size={14} style={{ flex: 'none', marginTop: 2 }} />
          <span>
            This sends a withdrawal request to the support team for review. It does{' '}
            <strong>not</strong> debit your balance and it does <strong>not</strong> trigger an
            automatic bank or on-chain transfer — the platform never executes payouts itself.
            Frozen funds cannot be withdrawn until they are released.
          </span>
        </span>
      </Alert>

      <Field label="Currency">
        {({ id }) => (
          <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value as 'INR' | 'USDT')}>
            <option value="INR">₹ INR — available {money(wallet?.realBalance ?? 0)}</option>
            <option value="USDT">₮ USDT — available ₮{(wallet?.realUsdtBalance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</option>
          </Select>
        )}
      </Field>

      <Field
        label={`Amount (${currency})`}
        error={amountError}
        hint={`Available ${money(available, currency)} · frozen ${money(frozen, currency)} cannot be withdrawn`}
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
            placeholder={String(Math.min(1000, Math.floor(available) || 1))}
            prefix={currency === 'USDT' ? '₮' : '₹'}
          />
        )}
      </Field>

      <Field label="Where should it go?" hint="Bank account, UPI ID or wallet address — reviewed by a person, so write it in full.">
        {({ id }) => (
          <Textarea
            id={id}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              currency === 'INR'
                ? 'e.g. HDFC Bank •••• 4471, IFSC HDFC0001234, holder name'
                : 'e.g. USDT TRC-20 address T9y…'
            }
          />
        )}
      </Field>

      <Button variant="primary" size="lg" block onClick={submit} loading={busy} disabled={Boolean(amountError)}>
        {!busy && <LifeBuoy size={16} />} Send withdrawal request
      </Button>
      {busy && (
        <span className="xs faint row-tight" style={{ justifyContent: 'center' }}>
          <Loader2 size={12} className="spin" /> Sending…
        </span>
      )}
    </div>
  );
}
