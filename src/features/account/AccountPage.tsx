/**
 * Account — the backend's own account snapshot from `GET /api/user/account`.
 * Read-only; editing lives in Settings (`PUT /api/user/profile`).
 */

import { Link } from 'react-router-dom';
import { BadgeCheck, CalendarDays, Copy, Gauge, IdCard, KeyRound, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { getAccount } from '../../api';
import { useSession } from '../../app/session';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Skeleton, Stat, statusTone } from '../../components/ui';
import { dateLabel, whenLabel } from '../../utils/format';
import { useState } from 'react';

export default function AccountPage() {
  const { wallet, user } = useSession();
  const account = useAsync(() => getAccount().then((r) => r.account), []);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  if (account.unavailable) {
    return (
      <div className="page">
        <Head />
        <Card>
          <EmptyState icon={<IdCard size={20} />} title="Account snapshot unavailable here" body="This deployment does not serve the account API." />
        </Card>
      </div>
    );
  }

  const data = account.data;

  return (
    <div className="page">
      <Head />

      {account.loading && !data && <Skeleton className="sk-block" style={{ height: 220 }} />}
      {account.error && !account.unavailable && (
        <Card>
          <EmptyState icon={<IdCard size={20} />} title="Could not load your account" body={account.error.message} />
        </Card>
      )}

      {data && (
        <>
          <Card style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="row" style={{ gap: 'var(--sp-5)', alignItems: 'center' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 20,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(150deg,var(--gold-300),var(--gold-600))',
                  color: '#1a1408',
                  fontSize: 26,
                  fontWeight: 800,
                  flex: 'none',
                }}
              >
                {(data.name || data.email)[0]?.toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-tight">
                  <h2 style={{ fontSize: 'var(--fs-2xl)' }}>{data.name}</h2>
                  <Badge tone={statusTone(data.status)}>{data.status}</Badge>
                  <Badge tone="brand">{data.category}</Badge>
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {data.email}
                  {data.phone ? ` · ${data.phone}` : ''}
                </div>
                <div className="xs faint" style={{ marginTop: 6 }}>
                  <span className="mono">{data.id}</span>
                  {data.username ? ` · @${data.username}` : ''} · member since {dateLabel(data.createdAt)}
                </div>
              </div>
              <Link to="/settings">
                <Button variant="outline">
                  <SettingsIcon size={15} /> Edit profile
                </Button>
              </Link>
            </div>
          </Card>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginBottom: 'var(--sp-4)' }}>
            <Stat label="Credit score" value={data.creditScore.score} foot={data.creditScore.status} small />
            <Stat label="Category" value={data.category} small />
            <Stat label="Available (INR)" value={wallet ? wallet.realBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'} small />
            <Stat label="Open orders" value={wallet?.openOrders ?? user?.wallet?.frozenItems?.length ?? 0} small />
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))' }}>
            <Card title={<span className="row-tight"><IdCard size={16} className="gold" /> Account record</span>}>
              <div className="kv">
                <span className="kv-key">Account id</span>
                <span className="kv-val mono xs row-tight" style={{ justifyContent: 'flex-end' }}>
                  {data.id}
                  <button className="btn btn-ghost btn-sm" style={{ height: 22, padding: '0 6px' }} onClick={() => copy('id', data.id)} aria-label="Copy account id">
                    <Copy size={11} />
                  </button>
                </span>
              </div>
              <div className="kv">
                <span className="kv-key">Username</span>
                <span className="kv-val">{data.username || '—'}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Email</span>
                <span className="kv-val">{data.email}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Phone</span>
                <span className="kv-val">{data.phone || 'not set'}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Preferred currency</span>
                <span className="kv-val">{user?.preferredCurrency ?? '—'}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Last activity</span>
                <span className="kv-val">{whenLabel(data.lastActivityAt)}</span>
              </div>
              {copied && <p className="xs up" style={{ marginTop: 8 }}>Copied to clipboard.</p>}
            </Card>

            <Card title={<span className="row-tight"><KeyRound size={16} className="gold" /> Invitation & access</span>}>
              <div className="kv">
                <span className="kv-key">Your invitation code</span>
                <span className="kv-val mono row-tight" style={{ justifyContent: 'flex-end' }}>
                  {data.inviteCode || '—'}
                  {data.inviteCode && (
                    <button className="btn btn-ghost btn-sm" style={{ height: 22, padding: '0 6px' }} onClick={() => copy('invite', data.inviteCode)} aria-label="Copy invitation code">
                      <Copy size={11} />
                    </button>
                  )}
                </span>
              </div>
              <div className="kv">
                <span className="kv-key">Registered via</span>
                <span className="kv-val mono xs">{data.invitedBy || '—'}</span>
              </div>
              <div className="kv">
                <span className="kv-key">Invitation type</span>
                <span className="kv-val">
                  <Badge tone={data.invitedByType === 'super' ? 'brand' : 'neutral'}>{data.invitedByType || '—'}</Badge>
                </span>
              </div>
              <div className="kv">
                <span className="kv-key">Registered</span>
                <span className="kv-val">
                  <span className="row-tight" style={{ justifyContent: 'flex-end' }}>
                    <CalendarDays size={12} className="faint" /> {dateLabel(data.createdAt)}
                  </span>
                </span>
              </div>
              <p className="xs faint" style={{ marginTop: 'var(--sp-3)' }}>
                Registration on this platform is invitation-only, and codes are issued by the
                institute. A personal code shown here identifies how you joined; it does not grant
                anyone else registration unless the backend accepts it.
              </p>
            </Card>

            <Card title={<span className="row-tight"><ShieldCheck size={16} className="gold" /> Security notes</span>}>
              <ul className="stack" style={{ gap: 'var(--sp-3)' }}>
                <li className="small muted" style={{ display: 'flex', gap: 8 }}>
                  <BadgeCheck size={15} className="up" style={{ flex: 'none', marginTop: 2 }} />
                  <span>Your session is a bearer token held in this browser only.</span>
                </li>
                <li className="small muted" style={{ display: 'flex', gap: 8 }}>
                  <Gauge size={15} className="gold" style={{ flex: 'none', marginTop: 2 }} />
                  <span>
                    Signing in again rotates the token and ends the previous session — the backend
                    keeps one active token per account.
                  </span>
                </li>
                <li className="small muted" style={{ display: 'flex', gap: 8 }}>
                  <ShieldCheck size={15} className="down" style={{ flex: 'none', marginTop: 2 }} />
                  <span>
                    Wallet and order routes are token-gated, cross-account access is refused, and
                    the two reported authorization holes are now closed: sign-in can no longer
                    create accounts (registration stays invitation-only), and deposit approval
                    requires a staff code instead of accepting the account holder's own session.
                    One known limitation remains: sign-in still verifies no credential, so
                    whoever knows a registered email can open its session. Treat the account as
                    demonstration-grade until real credentials exist.
                  </span>
                </li>
              </ul>
              <Link to="/settings" style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
                <Button variant="ghost" size="sm">
                  Session & preferences
                </Button>
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Head() {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">Account</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          Your account
        </h1>
        <p className="page-sub">Identity, status, invitation record and credit profile as the backend holds them.</p>
      </div>
    </header>
  );
}
