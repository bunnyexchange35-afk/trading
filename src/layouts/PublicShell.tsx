/** Unauthenticated shells: the public landing chrome and the auth card layout. */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useSession } from '../app/session';
import { Button } from '../components/ui';

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Mudrexx Earn home">
      <span className="brand-mark" aria-hidden="true">
        M
      </span>
      <span className="brand-text">
        <span className="brand-name">MUDREXX EARN</span>
        <span className="brand-tag">A Way to Earn in Real Life</span>
      </span>
    </Link>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const { token } = useSession();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <div className="nav-inner">
          <Brand />
          <nav className="nav-links" aria-label="Primary">
            <a className="nav-link" href="/#markets">
              Markets
            </a>
            <a className="nav-link" href="/#how">
              How it works
            </a>
            <a className="nav-link" href="/#features">
              Features
            </a>
          </nav>
          <div className="nav-right">
            {token ? (
              <Link to="/dashboard">
                <Button variant="primary" size="sm">
                  Open dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth/login">
                  <Button variant="ghost" size="sm">
                    <LogIn size={15} /> Sign in
                  </Button>
                </Link>
                <Link to="/auth/register">
                  <Button variant="primary" size="sm">
                    <UserPlus size={15} /> Join
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div
          style={{
            maxWidth: 'var(--shell-max)',
            marginInline: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-4)',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Brand />
              <p className="xs" style={{ marginTop: 'var(--sp-3)', maxWidth: '58ch' }}>
                Mudrexx Earn is a market-tracking and trading desk. Balances, orders and
                settlements are maintained by the platform backend. Nothing here is investment
                advice, and no outcome is guaranteed.
              </p>
          </div>
          <div className="xs">
            © {new Date().getFullYear()} Mudrexx Earn · Access by invitation only
          </div>
        </div>
      </footer>
    </>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-6)' }}>
          <Brand />
        </div>
        {children}
        <p className="xs faint" style={{ textAlign: 'center', marginTop: 'var(--sp-5)' }}>
            Create an account directly to get started.
        </p>
      </div>
    </div>
  );
}
