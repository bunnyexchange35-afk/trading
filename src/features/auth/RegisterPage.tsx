/**
 * Registration — the invitation code is a first-class, required field.
 *
 * VERIFIED (audit F15): `POST /api/auth/register` rejects a missing or
 * unrecognised code with 403 "Registration is by invitation only…". Codes are
 * institute-issued admin/super-admin codes; the app never generates one and a
 * user's own referral code does NOT grant registration. Success returns a
 * bearer token, so we sign the user straight in.
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Ticket, UserPlus } from 'lucide-react';
import { useSession } from '../../app/session';
import { errorMessage } from '../../api/client';
import { Alert, Button, Field, Input, Select } from '../../components/ui';

export default function RegisterPage() {
  const { signUp } = useSession();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    preferredCurrency: 'INR' as 'INR' | 'USDT',
    inviteCode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter your full name.';
    if (!form.email.trim()) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That email address does not look valid.';
    // The backend hard-requires this; failing client-side is kinder than a 403.
    if (!form.inviteCode.trim()) next.inviteCode = 'An invitation code is required to register.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        preferredCurrency: form.preferredCurrency,
        inviteCode: form.inviteCode.trim(),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Surface the backend's own wording — the 403 message is user-ready.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <span className="eyebrow">Create account</span>
      <h1 className="auth-title" style={{ marginTop: 6 }}>
        Join Mudrexx Earn
      </h1>
      <p className="small muted">
        Your account opens with ₹0.00 available balance and demo credits for practice.
      </p>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error" title="Registration failed">{error}</Alert>}

        {/* Invitation code first: it is the gate on the whole flow. */}
        <div className="panel" style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-soft)' }}>
          <Field
            label="Invitation code"
            required
            error={fieldErrors.inviteCode}
            hint="Issued by the institute. Registration is invitation-only and the app cannot generate a code for you."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid || Boolean(fieldErrors.inviteCode)}
                value={form.inviteCode}
                onChange={set('inviteCode')}
                placeholder="e.g. MUDREXX-ADMIN"
                autoComplete="off"
                spellCheck={false}
                style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}
                prefix={<Ticket size={15} />}
              />
            )}
          </Field>
        </div>

        <Field label="Full name" required error={fieldErrors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid || Boolean(fieldErrors.name)}
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              placeholder="Your name"
            />
          )}
        </Field>

        <Field label="Email" required error={fieldErrors.email}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid || Boolean(fieldErrors.email)}
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="you@example.com"
            />
          )}
        </Field>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          <Field label="Phone" hint="Optional">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                autoComplete="tel"
                placeholder="+91 …"
              />
            )}
          </Field>

          <Field label="Preferred currency">
            {({ id }) => (
              <Select id={id} value={form.preferredCurrency} onChange={set('preferredCurrency')}>
                <option value="INR">INR (₹)</option>
                <option value="USDT">USDT (₮)</option>
              </Select>
            )}
          </Field>
        </div>

        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {!busy && <UserPlus size={16} />} Create account
        </Button>
      </form>

      <p className="small muted" style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }}>
        Already registered?{' '}
        <Link to="/auth/login" className="gold strong">
          Sign in <ArrowRight size={12} style={{ verticalAlign: -1 }} />
        </Link>
      </p>
    </div>
  );
}
