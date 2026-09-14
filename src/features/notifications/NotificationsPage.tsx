/**
 * Notification centre.
 *
 * Audit F6: `GET /api/notifications` returns `{ notifications, unread: 0 }`
 * where `unread` is HARDCODED to zero, items are derived per request from your
 * own account data, capped at 10, and are not persisted. There is no mutation
 * endpoint. So:
 *   - no "mark as read" / "mark all read" action exists here
 *   - no badge is bound to `unread`
 *   - the 10-item cap and the derived nature are disclosed in the UI
 */

import { Bell, CheckCircle2, Info, Layers, LifeBuoy, RefreshCw, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getNotifications, type StudentNotification } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '../../components/ui';
import { whenLabel } from '../../utils/format';

const KIND_META: Record<string, { icon: React.ReactNode; to: string; tone: 'open' | 'brand' | 'neutral' | 'won' }> = {
  order: { icon: <Layers size={15} />, to: '/orders', tone: 'open' },
  task: { icon: <Star size={15} />, to: '/tasks', tone: 'brand' },
  support: { icon: <LifeBuoy size={15} />, to: '/support', tone: 'neutral' },
  withdrawal: { icon: <LifeBuoy size={15} />, to: '/support', tone: 'neutral' },
  wallet: { icon: <CheckCircle2 size={15} />, to: '/wallet', tone: 'won' },
  credit: { icon: <Star size={15} />, to: '/credit', tone: 'brand' },
};

export default function NotificationsPage() {
  const notifications = useAsync(() => getNotifications(), [], { intervalMs: 60_000 });
  const items = notifications.data?.notifications ?? [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Notifications</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Notifications
          </h1>
          <p className="page-sub">
            Activity derived from your own orders, tasks, wallet and support tickets.
          </p>
        </div>
        <Button variant="ghost" onClick={notifications.refresh}>
          <RefreshCw size={15} className={notifications.loading ? 'spin' : undefined} /> Refresh
        </Button>
      </header>

      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <Alert tone="info" title="About this feed">
          <span className="row-tight" style={{ alignItems: 'flex-start' }}>
            <Info size={14} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              These are generated on demand from your account data and are limited to the newest
              10 — they are not a stored inbox. The backend reports no read/unread state, so there
              is nothing to mark as read here.
            </span>
          </span>
        </Alert>
      </div>

      <Card title={<span className="row-tight"><Bell size={16} className="gold" /> Latest <Badge tone="neutral">{items.length}</Badge></span>} pad={false}>
        {notifications.loading && !notifications.data && (
          <div style={{ padding: 'var(--sp-5)' }}>
            <Skeleton className="sk-block" style={{ height: 200 }} />
          </div>
        )}

        {notifications.unavailable && (
          <EmptyState
            icon={<Bell size={20} />}
            title="Notifications unavailable here"
            body="This deployment does not serve the notifications API."
          />
        )}

        {notifications.error && !notifications.unavailable && (
          <EmptyState icon={<Bell size={20} />} title="Could not load notifications" body={notifications.error.message} />
        )}

        {!notifications.loading && !notifications.error && items.length === 0 && (
          <EmptyState
            icon={<Bell size={20} />}
            title="Nothing to show"
            body="Once you place orders, complete tasks or contact support, activity will appear here."
          />
        )}

        {items.map((item: StudentNotification) => {
          const meta = KIND_META[item.kind] ?? { icon: <Bell size={15} />, to: '/dashboard', tone: 'neutral' as const };
          return (
            <Link
              key={item.id}
              to={meta.to}
              style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                alignItems: 'flex-start',
                padding: 'var(--sp-4) var(--sp-5)',
                borderBottom: '1px solid var(--line-hair)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--line-hair)',
                  color: 'var(--text-secondary)',
                  flex: 'none',
                }}
              >
                {meta.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="row-tight" style={{ justifyContent: 'space-between' }}>
                  <strong className="small">{item.title}</strong>
                  <Badge tone={meta.tone}>{item.kind}</Badge>
                </span>
                <span className="xs muted" style={{ display: 'block', marginTop: 3, lineHeight: 'var(--lh-body)' }}>
                  {item.message}
                </span>
                <span className="xs faint" style={{ display: 'block', marginTop: 4 }}>
                  {whenLabel(item.at)}
                </span>
              </span>
            </Link>
          );
        })}

        {items.length > 0 && (
          <div className="card-foot xs faint" style={{ textAlign: 'center' }}>
            Newest {items.length} shown · the backend caps this feed at 10 items
          </div>
        )}
      </Card>
    </div>
  );
}
