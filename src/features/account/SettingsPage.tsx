/**
 * Settings.
 *
 * The profile form is limited to the fields `PUT /api/user/profile` actually
 * reads (verified at server.mjs:1011): `email`, `name`, `phone`,
 * `preferredCurrency`. Nothing else is offered, because the backend would
 * silently ignore it.
 *
 * There is NO logout endpoint — sign-out clears this browser's token and state
 * only, and the page says so rather than implying the token was revoked.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, KeyRound, LogOut, Save, Smartphone } from 'lucide-react';
import { updateProfile } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import { whenLabel } from '../../utils/format';

const PREFS_KEY = 'mudrexx.prefs.v1';

type Prefs = { compactNumbers: boolean; reduceMotion: boolean };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      return {
        compactNumbers: parsed.compactNumbers ?? false,
        reduceMotion: parsed.reduceMotion ?? false,
      };
    }
  } catch {
    /* ignore */
  }
  return { compactNumbers: false, reduceMotion: false };
}

export default function SettingsPage() {
  const { user, email, token, signOut, refreshUser } = useSession();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [preferredCurrency, setPreferredCurrency] = useState<'INR' | 'USDT'>(
    (user?.preferredCurrency as 'INR' | 'USDT') ?? 'INR',
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<Prefs>(readPrefs);

  const togglePref = (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    if (key === 'reduceMotion') {
      document.documentElement.style.setProperty(
        '--dur',
        next.reduceMotion ? '0.01ms' : '200ms',
      );
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        preferredCurrency,
      });
      await refreshUser();
      setSaved('Profile updated.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = () => {
    signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Preferences & session
          </h1>
          <p className="page-sub">Profile details the backend stores, and how this browser holds your session.</p>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <Card title="Profile">
          <div className="stack">
            {error && <Alert tone="error">{error}</Alert>}
            {saved && <Alert tone="success">{saved}</Alert>}

            <Alert tone="info" title="Email cannot be changed">
              Your email is the account key on the backend, so the profile endpoint updates name,
              phone and preferred currency only.
            </Alert>

            <Field label="Email">
              {({ id }) => (
                <Input id={id} value={email ?? ''} disabled readOnly aria-describedby={`${id}-hint`} />
              )}
            </Field>

            <Field label="Full name">
              {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
            </Field>

            <Field label="Phone" hint="Optional — used by support to reach you.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+91 …"
                  prefix={<Smartphone size={14} />}
                />
              )}
            </Field>

            <Field label="Preferred currency" hint="Sets the default ledger shown across the desk.">
              {({ id }) => (
                <Select
                  id={id}
                  value={preferredCurrency}
                  onChange={(e) => setPreferredCurrency(e.target.value as 'INR' | 'USDT')}
                >
                  <option value="INR">₹ INR</option>
                  <option value="USDT">₮ USDT</option>
                </Select>
              )}
            </Field>

            <Button variant="primary" onClick={save} loading={busy}>
              {!busy && <Save size={15} />} Save profile
            </Button>
          </div>
        </Card>

        <div className="stack">
          <Card title={<span className="row-tight"><KeyRound size={16} className="gold" /> Session</span>}>
            <div className="kv">
              <span className="kv-key">Signed in as</span>
              <span className="kv-val">{email}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Token</span>
              <span className="kv-val mono xs">{token ? `${token.slice(0, 10)}…${token.slice(-4)}` : '—'}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Stored in</span>
              <span className="kv-val">this browser only</span>
            </div>
            <div className="kv">
              <span className="kv-key">Last activity</span>
              <span className="kv-val">{whenLabel(user?.lastActivityAt)}</span>
            </div>

            <div style={{ marginTop: 'var(--sp-4)' }}>
              <Alert tone="warn" title="Sign-out is local">
                <span className="row-tight" style={{ alignItems: 'flex-start' }}>
                  <Info size={14} style={{ flex: 'none', marginTop: 2 }} />
                  <span>
                    The backend has no logout endpoint, so signing out clears the token from this
                    browser — it does not revoke the token server-side. Signing in again rotates
                    it, which is what actually invalidates the old one.
                  </span>
                </span>
              </Alert>
            </div>

            <Button variant="down" block onClick={onSignOut} style={{ marginTop: 'var(--sp-4)' }}>
              <LogOut size={15} /> Sign out
            </Button>
          </Card>

          <Card title="Display">
            <p className="xs faint" style={{ marginBottom: 'var(--sp-3)' }}>
              Browser-only preferences, stored on this device. The backend does not track them.
            </p>
            <label className="panel row spread" style={{ cursor: 'pointer', marginBottom: 'var(--sp-2)' }}>
              <span className="small">Compact number formatting</span>
              <input type="checkbox" checked={prefs.compactNumbers} onChange={() => togglePref('compactNumbers')} />
            </label>
            <label className="panel row spread" style={{ cursor: 'pointer' }}>
              <span className="small">Reduce motion</span>
              <input type="checkbox" checked={prefs.reduceMotion} onChange={() => togglePref('reduceMotion')} />
            </label>
          </Card>
        </div>
      </div>
    </div>
  );
}
