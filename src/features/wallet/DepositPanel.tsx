/**
 * Deposits.
 *
 * Audit F9: `POST /api/deposit/submit` books a frozen entry marked
 * "Verification in progress (Sandbox)". There is NO payment gateway, NO UPI
 * collect, NO wallet address and the backend returns NO payment instructions
 * of any kind. So this form must not invent any — no UPI ID, no address, no QR.
 *
 * 🔴 Audit F10: no approve/verify control is rendered here or anywhere else.
 * `/api/wallet/deposit/approve` is staff-only (admin code) since the security
 * fix — it used to accept the account holder's own session, which meant
 * self-crediting real balance plus `depositCreditedTotal` (a credit-score
 * input). It is not exported by the API client, so this page cannot reach it
 * even by accident.
 */

import { useState } from 'react';
import { Info, Landmark, Loader2 } from 'lucide-react';
import { submitDeposit, type DepositRail } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { money } from '../../utils/format';

export function DepositPanel({ onDone }: { onDone: () => void | Promise<void> }) {
  const { wallet } = useSession();
  const [rail, setRail] = useState<DepositRail>('inr');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; message: string } | null>(null);

  const numeric = Number(amount || 0);
  const amountError =
    !amount.trim()
      ? null
      : !Number.isFinite(numeric) || numeric <= 0
        ? 'Enter a positive amount.'
        : null;

  const submit = async () => {
    if (amountError || !numeric) {
      setError(amountError ?? 'Enter an amount to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await submitDeposit({ amount: numeric, rail, method, reference: reference.trim() });
      setDone({ id: response.depositId, message: response.message });
      setAmount('');
      setReference('');
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {error && <Alert tone="error" title="Deposit not submitted">{error}</Alert>}
      {done && (
        <Alert tone="success" title="Recorded as pending">
          {done.message}
          <div className="xs" style={{ marginTop: 4, opacity: 0.85 }}>
            Reference <code className="mono">{done.id}</code> · visible under Frozen funds
          </div>
        </Alert>
      )}

      <Alert tone="warn" title="How deposits actually work here">
        <span className="row-tight" style={{ alignItems: 'flex-start' }}>
          <Info size={14} style={{ flex: 'none', marginTop: 2 }} />
          <span>
            Submitting records the amount in your <strong>frozen</strong> balance as pending.
            The platform does not collect payment through this site and does not publish a UPI
            ID, bank account or wallet address here — transfer details are provided out of band
            by the institute or support. A deposit becomes available only after the team verifies
            it; that step is not something you can trigger yourself.
          </span>
        </span>
      </Alert>

      <Field label="Rail">
        {({ id }) => (
          <div className="tabs" id={id} role="tablist" aria-label="Deposit rail">
            {(
              [
                { id: 'inr', label: '₹ INR' },
                { id: 'usdt', label: '₮ USDT' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                role="tab"
                type="button"
                aria-selected={rail === option.id}
                className={`tab ${rail === option.id ? 'tab-active' : ''}`}
                onClick={() => {
                  setRail(option.id);
                  setMethod(option.id === 'inr' ? 'upi' : 'trc20');
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label={`Amount (${rail === 'inr' ? 'INR' : 'USDT'})`} error={amountError} required>
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
            placeholder={rail === 'inr' ? '5000' : '100'}
            prefix={rail === 'inr' ? '₹' : '₮'}
          />
        )}
      </Field>

      <Field
        label="Method"
        hint="Recorded on the entry so the team can match your transfer."
      >
        {({ id }) => (
          <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
            {rail === 'inr' ? (
              <>
                <option value="upi">UPI</option>
                <option value="neft">NEFT / IMPS</option>
                <option value="rtgs">RTGS</option>
                <option value="bank">Bank transfer</option>
              </>
            ) : (
              <>
                <option value="trc20">USDT TRC-20</option>
                <option value="erc20">USDT ERC-20</option>
                <option value="bep20">USDT BEP-20</option>
              </>
            )}
          </Select>
        )}
      </Field>

      <Field label="Reference" hint="Optional — your UTR, transaction hash or note.">
        {({ id }) => (
          <Input
            id={id}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. UTR 4023…"
            autoComplete="off"
          />
        )}
      </Field>

      <div className="panel xs faint">
        After submitting: {money(numeric, rail === 'inr' ? 'INR' : 'USDT')} moves to frozen funds
        as <strong>pending</strong>. Currently pending:{' '}
        <strong className="num">
          {money(wallet?.pendingAmount ?? 0, 'INR')}
          {(wallet?.pendingAmountUsdt ?? 0) > 0 && ` + ₮${wallet!.pendingAmountUsdt.toLocaleString('en-US')}`}
        </strong>
      </div>

      <Button variant="primary" size="lg" block onClick={submit} loading={busy} disabled={Boolean(amountError)}>
        {!busy && <Landmark size={16} />} Submit for verification
      </Button>
      {busy && (
        <span className="xs faint row-tight" style={{ justifyContent: 'center' }}>
          <Loader2 size={12} className="spin" /> Recording…
        </span>
      )}
    </div>
  );
}
