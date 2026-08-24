import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BadgeIndianRupee, Building2, Check, ChevronRight, Clipboard, Clock3,
  Copy, FileUp, Info, Landmark, Lock, LockKeyhole, QrCode, ShieldCheck, Smartphone,
  Wallet, X,
} from 'lucide-react';
import { PageHero } from './components';
import { useApp } from './app-context';

type Rail = 'inr' | 'usdt';
type InrMethod = 'upi' | 'bank';

export default function Deposit() {
  const [rail, setRail] = useState<Rail>('inr');
  const [method, setMethod] = useState<InrMethod>('upi');
  const [inrAmount, setInrAmount] = useState('5000');
  const [utr, setUtr] = useState('');
  const [done, setDone] = useState(false);

  const { user, openAuth, addDeposit, notify } = useApp();
  const navigate = useNavigate();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      openAuth('signin');
      return;
    }

    const amt = Number(inrAmount || 0);
    if (amt <= 0) {
      notify('Invalid amount', 'Enter a valid deposit amount.', 'warning');
      return;
    }

    const ref = utr || (method === 'upi' ? `UPI-${Date.now().toString().slice(-6)}` : `UTR-${Date.now().toString().slice(-8)}`);
    addDeposit(amt, rail, method, ref);
    setDone(true);
  };

  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
    notify('Copied', 'Sandbox detail copied to clipboard.', 'info');
  };

  return (
    <main className="deposit-page">
      <PageHero
        eyebrow="Fund your wallet"
        title="Deposit, your way."
        copy="Choose INR through UPI or bank transfer, or review the USDT TRC20 funding flow. Submitted deposits are tracked in your Wallet's Frozen Amount section until verified."
      >
        <div className="deposit-security">
          <span>
            <LockKeyhole /> Sandbox payment flow
          </span>
          <span>
            <ShieldCheck /> Account-name check required
          </span>
          <span>
            <Lock /> Recorded in Frozen Balance
          </span>
        </div>
      </PageHero>

      <section className="container deposit-layout">
        <div className="deposit-main-card">
          <div className="deposit-progress">
            <span className="active">
              <i>1</i>Choose method
            </span>
            <b />
            <span>
              <i>2</i>Enter details
            </span>
            <b />
            <span>
              <i>3</i>Track in Frozen Section
            </span>
          </div>

          <div className="deposit-rail-tabs">
            <button
              className={rail === 'inr' ? 'active' : ''}
              onClick={() => setRail('inr')}
            >
              <span className="rail-icon inr-icon">₹</span>
              <div>
                <strong>Deposit INR</strong>
                <small>UPI & bank transfer</small>
              </div>
              <Check />
            </button>
            <button
              className={rail === 'usdt' ? 'active' : ''}
              onClick={() => setRail('usdt')}
            >
              <span className="rail-icon usdt-icon">₮</span>
              <div>
                <strong>Deposit USDT</strong>
                <small>TRC20 network</small>
              </div>
              <Check />
            </button>
          </div>

          {rail === 'inr' ? (
            <div className="deposit-content">
              <div className="content-heading">
                <div>
                  <h2>Add Indian Rupees</h2>
                  <p>Select your preferred payment method.</p>
                </div>
                <span className="inr-badge">
                  <BadgeIndianRupee /> INR
                </span>
              </div>

              <div className="method-cards">
                <button
                  className={method === 'upi' ? 'active' : ''}
                  onClick={() => setMethod('upi')}
                >
                  <span>
                    <Smartphone />
                  </span>
                  <div>
                    <strong>UPI</strong>
                    <small>Fast · Usually instant</small>
                  </div>
                  <Check />
                </button>
                <button
                  className={method === 'bank' ? 'active' : ''}
                  onClick={() => setMethod('bank')}
                >
                  <span>
                    <Building2 />
                  </span>
                  <div>
                    <strong>Bank transfer</strong>
                    <small>IMPS / NEFT / RTGS</small>
                  </div>
                  <Check />
                </button>
              </div>

              {method === 'upi' ? (
                <form className="deposit-form" onSubmit={submit}>
                  <label>
                    <span>Amount to deposit</span>
                    <div className="large-amount">
                      <b>₹</b>
                      <input
                        type="number"
                        min="100"
                        value={inrAmount}
                        onChange={(event) => setInrAmount(event.target.value)}
                        required
                      />
                      <em>INR</em>
                    </div>
                    <small>Minimum ₹100 · Recorded in Frozen Balance until review</small>
                  </label>
                  <div className="amount-suggestions">
                    {[1000, 2500, 5000, 10000].map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => setInrAmount(String(item))}
                      >
                        ₹{item.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                  <label>
                    <span>Your UPI ID</span>
                    <div className="input-with-icon">
                      <Smartphone />
                      <input placeholder="yourname@bank" pattern=".+@.+" required />
                    </div>
                  </label>
                  <label>
                    <span>
                      Reference note <em>Optional</em>
                    </span>
                    <input
                      placeholder="Add a note or UTR"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-purple btn-full btn-lg">
                    Continue to secure payment <ArrowRight />
                  </button>
                  <p className="form-safe">
                    <ShieldCheck /> UPI details are used only to create your sandbox payment request.
                  </p>
                </form>
              ) : (
                <form className="deposit-form" onSubmit={submit}>
                  <div className="sandbox-banner">
                    <Info />
                    <div>
                      <strong>Deployment-safe placeholder</strong>
                      <p>Transfer funds to the sandbox account and submit your reference.</p>
                    </div>
                  </div>
                  <div className="bank-detail-list">
                    <Detail
                      label="Account name"
                      value="Mudrexx Earn — SANDBOX"
                      copy={() => copy('Mudrexx Earn — SANDBOX')}
                    />
                    <Detail
                      label="Account number"
                      value="XXXX XXXX 0101"
                      copy={() => copy('XXXX XXXX 0101')}
                    />
                    <Detail label="IFSC" value="DEMO0000101" copy={() => copy('DEMO0000101')} />
                    <Detail label="Account type" value="Current" />
                  </div>
                  <label>
                    <span>Amount transferred</span>
                    <div className="large-amount">
                      <b>₹</b>
                      <input
                        type="number"
                        min="100"
                        value={inrAmount}
                        onChange={(event) => setInrAmount(event.target.value)}
                        required
                      />
                      <em>INR</em>
                    </div>
                  </label>
                  <label>
                    <span>Bank reference / UTR</span>
                    <div className="input-with-icon">
                      <Clipboard />
                      <input
                        placeholder="Enter 12–22 digit reference"
                        minLength={6}
                        value={utr}
                        onChange={(e) => setUtr(e.target.value)}
                        required
                      />
                    </div>
                  </label>
                  <label className="upload-box">
                    <FileUp />
                    <span>
                      <strong>Upload transfer receipt</strong>
                      <small>PNG, JPG or PDF · Max 5 MB (Optional in sandbox)</small>
                    </span>
                    <input type="file" accept="image/*,.pdf" />
                  </label>
                  <button className="btn btn-purple btn-full btn-lg">
                    Submit for verification <ArrowRight />
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="deposit-content trc-content">
              <div className="content-heading">
                <div>
                  <h2>Deposit USDT</h2>
                  <p>Send only USDT using the selected TRON network.</p>
                </div>
                <span className="network-badge">TRC20</span>
              </div>
              <div className="network-selector">
                <label>Network</label>
                <button type="button">
                  <span className="tron-mark">T</span>
                  <div>
                    <strong>TRON (TRC20)</strong>
                    <small>Fast confirmation · Low network fees</small>
                  </div>
                  <Check />
                  <ChevronRight />
                </button>
              </div>
              <div className="crypto-address-card">
                <div className="fake-qr">
                  <QrPattern />
                  <span>₮</span>
                </div>
                <div className="address-copy">
                  <span>Your USDT TRC20 address</span>
                  {user ? (
                    <>
                      <strong>TDemo7x9MudrexxSandboxOnly00000000</strong>
                      <button type="button" onClick={() => copy('TDemo7x9MudrexxSandboxOnly00000000')}>
                        <Copy /> Copy address
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Sign in to generate a secure, account-specific deposit address.</p>
                      <button className="btn btn-purple" onClick={() => openAuth('signin')}>
                        Sign in to continue <ArrowRight />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="deposit-warning">
                <Info />
                <div>
                  <strong>TRC20 only</strong>
                  <p>
                    Sending assets or using another network can cause permanent loss. Address shown is for sandbox testing.
                  </p>
                </div>
              </div>
              <div className="crypto-facts">
                <span>
                  <small>Minimum deposit</small>
                  <strong>10 USDT</strong>
                </span>
                <span>
                  <small>Confirmations</small>
                  <strong>20 blocks</strong>
                </span>
                <span>
                  <small>Tracking</small>
                  <strong>Frozen Section</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className="deposit-side">
          <div className="deposit-help-card">
            <span className="side-card-icon">
              <ShieldCheck />
            </span>
            <h3>Your safety comes first</h3>
            <ul>
              <li>
                <Check /> Account names must match
              </li>
              <li>
                <Check /> Deposits are locked in Frozen balance
              </li>
              <li>
                <Check /> Never share an OTP or seed phrase
              </li>
            </ul>
          </div>
          <div className="deposit-help-card">
            <span className="side-card-icon mint">
              <Lock size={18} />
            </span>
            <h3>Frozen Deposit Tracking</h3>
            <p>Once submitted, you can monitor and verify your deposit in your Wallet's Frozen Amount section.</p>
            <Link to="/wallet#frozen-section">
              Open Frozen Section <ArrowRight />
            </Link>
          </div>
          <div className="deposit-help-card compact">
            <Landmark />
            <div>
              <strong>Need help funding?</strong>
              <p>The global contact button opens Telegram support.</p>
            </div>
          </div>
        </aside>
      </section>

      {done && (
        <div className="modal-layer">
          <button className="modal-backdrop" onClick={() => setDone(false)} />
          <div className="deposit-success">
            <button className="modal-close" onClick={() => setDone(false)}>
              <X />
            </button>
            <span>
              <Check />
            </span>
            <small>REQUEST RECORDED</small>
            <h2>Deposit submitted</h2>
            <p>
              ₹{Number(inrAmount).toLocaleString('en-IN')} has been recorded in your <strong>Frozen Amount</strong> section pending verification.
            </p>
            <div>
              <Lock size={14} /> Tracked in: Wallet &gt; Frozen Amount Breakdown
            </div>
            <div className="deposit-success-actions">
              <button
                className="btn btn-purple btn-full"
                onClick={() => {
                  setDone(false);
                  navigate('/wallet#frozen-section');
                }}
              >
                View in Frozen Section <ArrowRight size={15} />
              </button>
              <button className="btn btn-soft btn-full" onClick={() => setDone(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({ label, value, copy }: { label: string; value: string; copy?: () => void }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {copy && (
        <button type="button" onClick={copy}>
          <Copy />
        </button>
      )}
    </div>
  );
}

function QrPattern() {
  return (
    <div className="qr-pattern">
      {Array.from({ length: 81 }, (_, i) => (
        <i
          key={i}
          className={
            (i * 7 + Math.floor(i / 9) * 3) % 5 < 2 ||
            [0, 1, 2, 9, 11, 18, 19, 20, 6, 7, 8, 15, 17, 24, 25, 26, 54, 55, 56, 63, 65, 72, 73, 74].includes(
              i
            )
              ? 'filled'
              : ''
          }
        />
      ))}
    </div>
  );
}
