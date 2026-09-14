/**
 * Credit score.
 *
 * Audit F13: `server.mjs` states "the frontend never computes these". The score
 * (base 420, activity, win rate, tasks, account age, deposit tier, clamped
 * 300–900) and its band are produced by the backend. This page renders what
 * arrives and does NOT reimplement the formula, recompute a band, or project a
 * future score. The band labels shown on the scale are the backend's published
 * thresholds, used for display only.
 */

import { useMemo } from 'react';
import { Gauge, Info, RefreshCw, TrendingUp } from 'lucide-react';
import { getCreditHistory, getCreditScore } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Meter, Skeleton, Stat, statusTone } from '../../components/ui';
import { whenLabel } from '../../utils/format';

const BANDS = [
  { min: 800, label: 'Excellent' },
  { min: 700, label: 'Good' },
  { min: 600, label: 'Fair' },
  { min: 300, label: 'Poor' },
];

export default function CreditPage() {
  const score = useAsync(() => getCreditScore().then((r) => r.creditScore), []);
  const history = useAsync(() => getCreditHistory().then((r) => r.history), []);

  const current = score.data;
  const series = history.data ?? [];

  const delta = useMemo(() => {
    if (series.length < 2) return null;
    return series[0].score - series[1].score;
  }, [series]);

  if (score.unavailable) {
    return (
      <div className="page">
        <Head onRefresh={score.refresh} loading={score.loading} />
        <Card>
          <EmptyState
            icon={<Gauge size={20} />}
            title="Credit scoring unavailable here"
            body="This deployment does not serve the credit-score API. It is provided by the primary backend."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <Head onRefresh={score.refresh} loading={score.loading} />

      {score.error && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <EmptyState icon={<Gauge size={20} />} title="Could not load your score" body={score.error.message} />
        </Card>
      )}

      {current && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
          <Card title={<span className="row-tight"><Gauge size={16} className="gold" /> Current score</span>}>
            {score.loading && !score.data ? (
              <Skeleton className="sk-block" />
            ) : (
              <>
                <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 'var(--sp-5)' }}>
                  <div>
                    <div className="stat-value num" style={{ fontSize: 'clamp(56px,9vw,84px)', lineHeight: 1 }}>
                      {current.score}
                    </div>
                    <div className="xs faint" style={{ marginTop: 6 }}>
                      Updated {whenLabel(current.updatedAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge tone={statusTone(current.status)}>{current.status}</Badge>
                    {current.category && (
                      <div style={{ marginTop: 6 }}>
                        <Badge tone="brand">{current.category}</Badge>
                      </div>
                    )}
                    {delta !== null && delta !== 0 && (
                      <div className={`small strong ${delta > 0 ? 'up' : 'down'}`} style={{ marginTop: 8 }}>
                        <TrendingUp size={13} style={{ verticalAlign: -2 }} /> {delta > 0 ? '+' : ''}
                        {delta} since last update
                      </div>
                    )}
                  </div>
                </div>

                <Meter pct={((current.score - 300) / 600) * 100} />
                <div className="spread xs faint" style={{ marginTop: 8 }}>
                  {BANDS.slice().reverse().map((band) => (
                    <span key={band.label}>
                      {band.min} · {band.label}
                    </span>
                  ))}
                </div>

                <div className="panel" style={{ marginTop: 'var(--sp-5)' }}>
                  <span className="eyebrow">What the backend weighs</span>
                  <p className="small muted" style={{ marginTop: 'var(--sp-2)', lineHeight: 'var(--lh-body)' }}>
                    Settled order volume, your win rate across settled orders, completed tasks,
                    account age and verified deposit totals. The score is clamped between 300 and
                    900 and recalculated by the backend on each read.
                  </p>
                  <p className="xs faint" style={{ marginTop: 'var(--sp-3)' }}>
                    <Info size={11} style={{ verticalAlign: -1 }} /> This page performs no scoring
                    maths. Nothing here is a credit rating from a bureau, and it is not used for
                    lending decisions.
                  </p>
                </div>
              </>
            )}
          </Card>

          <div className="stack">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Stat label="Score" value={current.score} small />
              <Stat label="Band" value={current.status} small />
              <Stat label="Category" value={current.category ?? '—'} small />
              <Stat label="Updates recorded" value={series.length} small />
            </div>

            <Card title="History" pad={false}>
              {history.loading && !history.data && (
                <div style={{ padding: 'var(--sp-5)' }}>
                  <Skeleton className="sk-block" />
                </div>
              )}
              {series.length === 0 && !history.loading && (
                <EmptyState icon={<TrendingUp size={20} />} title="No history yet" body="Score updates are recorded as your account activity changes." />
              )}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {series.map((point, index) => {
                  const previous = series[index + 1];
                  const change = previous ? point.score - previous.score : 0;
                  return (
                    <div
                      key={`${point.at}-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-5)',
                        borderBottom: '1px solid var(--line-hair)',
                      }}
                    >
                      <span className="num strong" style={{ width: 46 }}>
                        {point.score}
                      </span>
                      <span style={{ flex: 1 }}>
                        <Badge tone={statusTone(point.status)}>{point.status}</Badge>
                        <span className="xs faint" style={{ marginLeft: 8 }}>
                          {whenLabel(point.at)}
                        </span>
                      </span>
                      {previous && (
                        <span className={`xs num strong ${change > 0 ? 'up' : change < 0 ? 'down' : 'faint'}`}>
                          {change > 0 ? '+' : ''}
                          {change}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Head({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">Credit</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          Credit profile
        </h1>
        <p className="page-sub">
          A backend-computed view of how consistently you use the desk. It is not a bureau score.
        </p>
      </div>
      <Button variant="ghost" onClick={onRefresh}>
        <RefreshCw size={15} className={loading ? 'spin' : undefined} /> Refresh
      </Button>
    </header>
  );
}
