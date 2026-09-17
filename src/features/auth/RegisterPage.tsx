/** Registration is open: new users can create an account directly. */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus } from 'lucide-react';
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
        Your account opens with ₹0.00 available balance and credits.
      </p>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error" title="Registration failed">{error}</Alert>}

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
