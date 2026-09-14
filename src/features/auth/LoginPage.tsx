/**
 * Sign in.
 *
 * VERIFIED BEHAVIOUR (audit §5): `POST /api/auth/login` accepts only an email.
 * It performs NO password check and creates the account if it does not exist.
 * Rendering a password box here would be fake authentication — the command
 * forbids it — so this form asks for the email only and states plainly what
 * the backend does. If credential checking is added server-side, add the
 * field here and pass it through `api.login`.
 */

import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldAlert } from 'lucide-react';
import { useSession } from '../../app/session';
import { errorMessage } from '../../api/client';
import { Alert, Button, Field, Input } from '../../components/ui';

export default function LoginPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <span className="eyebrow">Sign in</span>
      <h1 className="auth-title" style={{ marginTop: 6 }}>
        Welcome back
      </h1>
      <p className="small muted">Open the desk tied to your account email.</p>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error" title="Could not sign in">{error}</Alert>}

        <Field label="Account email" required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Alert tone="warn" title="This backend does not verify passwords">
          <span className="row-tight" style={{ alignItems: 'flex-start' }}>
            <ShieldAlert size={14} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              The API issues a session for <strong>any</strong> email address without checking a
              credential, and creates the account if it does not exist — so this form does not ask
              for a password. Reported as a backend authorization gap; sign-in here is not proof of
              identity.
            </span>
          </span>
        </Alert>

        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {!busy && <KeyRound size={16} />} Sign in
        </Button>
      </form>

      <p className="small muted" style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }}>
        Have an invitation code?{' '}
        <Link to="/auth/register" className="gold strong">
          Create your account <ArrowRight size={12} style={{ verticalAlign: -1 }} />
        </Link>
      </p>
    </div>
  );
}
