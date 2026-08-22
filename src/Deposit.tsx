import { useState, type FormEvent } from 'react';
import {
  ArrowRight, BadgeIndianRupee, Building2, Check, ChevronRight, Clipboard, Clock3,
  Copy, FileUp, Info, Landmark, LockKeyhole, QrCode, ShieldCheck, Smartphone, Wallet, X,
} from 'lucide-react';
import { PageHero } from './components';
import { useApp } from './app-context';

type Rail = 'inr' | 'usdt';
type InrMethod = 'upi' | 'bank';

export default function Deposit() {
  const [rail, setRail] = useState<Rail>('inr');
  const [method, setMethod] = useState<InrMethod>('upi');
  const [inrAmount, setInrAmount] = useState('5000');
  const [done, setDone] = useState(false);
  const { user, openAuth, notify } = useApp();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) { openAuth('signin'); return; }
    setDone(true);
  };
  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
    notify('Copied', 'Sandbox detail copied to clipboard.', 'info');
  };

  return <main className="deposit-page">
    <PageHero eyebrow="Fund your wallet" title="Deposit, your way." copy="Choose INR through UPI or bank transfer, or review the USDT TRC20 funding flow.">
      <div className="deposit-security"><span><LockKeyhole /> Sandbox payment flow</span><span><ShieldCheck /> Account-name check required</span></div>
    </PageHero>
    <section className="container deposit-layout">
      <div className="deposit-main-card">
        <div className="deposit-progress"><span className="active"><i>1</i>Choose method</span><b /><span><i>2</i>Enter details</span><b /><span><i>3</i>Review</span></div>
        <div className="deposit-rail-tabs"><button className={rail === 'inr' ? 'active' : ''} onClick={() => setRail('inr')}><span className="rail-icon inr-icon">₹</span><div><strong>Deposit INR</strong><small>UPI & bank transfer</small></div><Check /></button><button className={rail === 'usdt' ? 'active' : ''} onClick={() => setRail('usdt')}><span className="rail-icon usdt-icon">₮</span><div><strong>Deposit USDT</strong><small>TRC20 network</small></div><Check /></button></div>

        {rail === 'inr' ? <div className="deposit-content">
          <div className="content-heading"><div><h2>Add Indian Rupees</h2><p>Select your preferred payment method.</p></div><span className="inr-badge"><BadgeIndianRupee /> INR</span></div>
          <div className="method-cards"><button className={method === 'upi' ? 'active' : ''} onClick={() => setMethod('upi')}><span><Smartphone /></span><div><strong>UPI</strong><small>Fast · Usually instant</small></div><Check /></button><button className={method === 'bank' ? 'active' : ''} onClick={() => setMethod('bank')}><span><Building2 /></span><div><strong>Bank transfer</strong><small>IMPS / NEFT / RTGS</small></div><Check /></button></div>
          {method === 'upi' ? <form className="deposit-form" onSubmit={submit}><label><span>Amount to deposit</span><div className="large-amount"><b>₹</b><input type="number" min="100" value={inrAmount} onChange={(event) => setInrAmount(event.target.value)} required /><em>INR</em></div><small>Minimum ₹100 · Maximum depends on your verified account</small></label><div className="amount-suggestions">{[1000, 2500, 5000, 10000].map((item) => <button type="button" key={item} onClick={() => setInrAmount(String(item))}>₹{item.toLocaleString('en-IN')}</button>)}</div><label><span>Your UPI ID</span><div className="input-with-icon"><Smartphone /><input placeholder="yourname@bank" pattern=".+@.+" required /></div></label><label><span>Reference note <em>Optional</em></span><input placeholder="Add a note for this deposit" /></label><button className="btn btn-purple btn-full btn-lg">Continue to secure payment <ArrowRight /></button><p className="form-safe"><ShieldCheck /> UPI details are used only to create your payment request.</p></form> : <form className="deposit-form" onSubmit={submit}><div className="sandbox-banner"><Info /><div><strong>Deployment-safe placeholder</strong><p>Replace these sandbox details with your verified banking partner before accepting payments.</p></div></div><div className="bank-detail-list"><Detail label="Account name" value="Mudrexx Earn — SANDBOX" copy={() => copy('Mudrexx Earn — SANDBOX')} /><Detail label="Account number" value="XXXX XXXX 0101" copy={() => copy('XXXX XXXX 0101')} /><Detail label="IFSC" value="DEMO0000101" copy={() => copy('DEMO0000101')} /><Detail label="Account type" value="Current" /></div><label><span>Amount transferred</span><div className="large-amount"><b>₹</b><input type="number" min="100" value={inrAmount} onChange={(event) => setInrAmount(event.target.value)} required /><em>INR</em></div></label><label><span>Bank reference / UTR</span><div className="input-with-icon"><Clipboard /><input placeholder="Enter 12–22 digit reference" minLength={8} required /></div></label><label className="upload-box"><FileUp /><span><strong>Upload transfer receipt</strong><small>PNG, JPG or PDF · Max 5 MB</small></span><input type="file" accept="image/*,.pdf" required /></label><button className="btn btn-purple btn-full btn-lg">Submit for verification <ArrowRight /></button></form>}
        </div> : <div className="deposit-content trc-content">
          <div className="content-heading"><div><h2>Deposit USDT</h2><p>Send only USDT using the selected network.</p></div><span className="network-badge">TRC20</span></div>
          <div className="network-selector"><label>Network</label><button><span className="tron-mark">T</span><div><strong>TRON (TRC20)</strong><small>Fast confirmation · Low network fees</small></div><Check /><ChevronRight /></button></div>
          <div className="crypto-address-card"><div className="fake-qr"><QrPattern /><span>₮</span></div><div className="address-copy"><span>Your USDT TRC20 address</span>{user ? <><strong>TDemo7x9MudrexxSandboxOnly00000000</strong><button onClick={() => copy('TDemo7x9MudrexxSandboxOnly00000000')}><Copy /> Copy address</button></> : <><p>Sign in to generate a secure, account-specific deposit address.</p><button className="btn btn-purple" onClick={() => openAuth('signin')}>Sign in to continue <ArrowRight /></button></>}</div></div>
          <div className="deposit-warning"><Info /><div><strong>TRC20 only</strong><p>Sending assets or using another network can cause permanent loss. The address shown in this demo is intentionally non-operational.</p></div></div>
          <div className="crypto-facts"><span><small>Minimum deposit</small><strong>10 USDT</strong></span><span><small>Confirmations</small><strong>20 blocks</strong></span><span><small>Typical time</small><strong>1–5 minutes</strong></span></div>
        </div>}
      </div>
      <aside className="deposit-side">
        <div className="deposit-help-card"><span className="side-card-icon"><ShieldCheck /></span><h3>Your safety comes first</h3><ul><li><Check /> Account names must match</li><li><Check /> Always verify the network</li><li><Check /> Never share an OTP or seed phrase</li></ul></div>
        <div className="deposit-help-card"><span className="side-card-icon mint"><Clock3 /></span><h3>Deposit status</h3><p>Once submitted, you can track verification from your wallet.</p><a href="/wallet">Open wallet <ArrowRight /></a></div>
        <div className="deposit-help-card compact"><Landmark /><div><strong>Need help funding?</strong><p>The global contact button opens Telegram support.</p></div></div>
      </aside>
    </section>
    {done && <div className="modal-layer"><button className="modal-backdrop" onClick={() => setDone(false)} /><div className="deposit-success"><button className="modal-close" onClick={() => setDone(false)}><X /></button><span><Check /></span><small>REQUEST RECEIVED</small><h2>Deposit submitted</h2><p>Your sandbox deposit request is ready for review. No payment was collected.</p><div><Clock3 /> Estimated review: under 30 minutes</div><button className="btn btn-purple btn-full" onClick={() => setDone(false)}>Done</button></div></div>}
  </main>;
}

function Detail({ label, value, copy }: { label: string; value: string; copy?: () => void }) { return <div><span>{label}</span><strong>{value}</strong>{copy && <button type="button" onClick={copy}><Copy /></button>}</div>; }
function QrPattern() { return <div className="qr-pattern">{Array.from({ length: 81 }, (_, i) => <i key={i} className={(i * 7 + Math.floor(i / 9) * 3) % 5 < 2 || [0,1,2,9,11,18,19,20,6,7,8,15,17,24,25,26,54,55,56,63,65,72,73,74].includes(i) ? 'filled' : ''} />)}</div>; }
