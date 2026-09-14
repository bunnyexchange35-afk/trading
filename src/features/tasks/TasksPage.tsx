/**
 * Tasks.
 *
 * VERIFIED: the backend exposes only `GET /api/tasks` (auth-gated). There is no
 * completion, claim or mutation endpoint — tasks are seeded and derived from
 * your account state server-side. So this page is deliberately READ-ONLY: no
 * "complete" button and no "claim reward" control, because either would be a
 * fiction. Progress is shown from the backend's own `summary`.
 */

import { CalendarClock, CheckCircle2, Circle, ListChecks, RefreshCw } from 'lucide-react';
import { getTasks } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Button, Card, EmptyState, Meter, Skeleton, Stat, statusTone } from '../../components/ui';
import { dateLabel } from '../../utils/format';

const PRIORITY_TONE: Record<string, 'danger' | 'warn' | 'neutral'> = {
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
};

export default function TasksPage() {
  const tasks = useAsync(() => getTasks(), []);

  if (tasks.unavailable) {
    return (
      <div className="page">
        <PageHead />
        <Card>
          <EmptyState
            icon={<ListChecks size={20} />}
            title="Tasks unavailable here"
            body="This deployment does not serve the tasks API. Tasks are provided by the primary backend."
          />
        </Card>
      </div>
    );
  }

  const summary = tasks.data?.summary;
  const list = tasks.data?.tasks ?? [];
  const done = summary?.completed ?? 0;
  const total = summary?.total ?? list.length ?? 0;

  return (
    <div className="page">
      <PageHead onRefresh={tasks.refresh} loading={tasks.loading} />

      {tasks.error && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <EmptyState icon={<Circle size={20} />} title="Could not load tasks" body={tasks.error.message} />
        </Card>
      )}

      {summary && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 'var(--sp-4)' }}>
            <Stat label="Completed" value={summary.completed} small />
            <Stat label="In progress" value={summary.inProgress} small />
            <Stat label="Pending" value={summary.pending} small />
            <Stat label="Overdue" value={summary.overdue} small />
          </div>

          <Card style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="spread small" style={{ marginBottom: 'var(--sp-3)' }}>
              <span className="muted">
                {done} of {total} complete
              </span>
              <span className="faint xs">{total ? Math.round((done / total) * 100) : 0}%</span>
            </div>
            <Meter pct={total ? (done / total) * 100 : 0} tone="up" />
            <p className="xs faint" style={{ marginTop: 'var(--sp-3)' }}>
              Task state is maintained by the backend from your account activity — completing an
              order, filling in your profile, and so on. There is no manual completion action.
            </p>
          </Card>
        </>
      )}

      <Card title="Your tasks" pad={false}>
        {tasks.loading && !tasks.data && (
          <div style={{ padding: 'var(--sp-5)' }}>
            <Skeleton className="sk-block" style={{ height: 220 }} />
          </div>
        )}
        {!tasks.loading && list.length === 0 && !tasks.error && (
          <EmptyState icon={<CheckCircle2 size={20} />} title="No tasks" body="The backend has not assigned any tasks to this account." />
        )}
        {list.map((task) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-4) var(--sp-5)',
              borderBottom: '1px solid var(--line-hair)',
              alignItems: 'flex-start',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                marginTop: 2,
                color: task.status === 'completed' ? 'var(--up)' : 'var(--text-faint)',
                flex: 'none',
              }}
            >
              {task.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-tight">
                <strong className="small">{task.title}</strong>
                <Badge tone={statusTone(task.status)}>{task.status.replace('_', ' ')}</Badge>
                <Badge tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>{task.priority}</Badge>
              </div>
              <p className="xs muted" style={{ marginTop: 4, lineHeight: 'var(--lh-body)' }}>
                {task.description}
              </p>
              <div className="xs faint row-tight" style={{ marginTop: 6 }}>
                <span>{task.category}</span>
                {task.dueDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <CalendarClock size={11} /> due {dateLabel(task.dueDate)}
                  </>
                )}
                {task.completedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>completed {dateLabel(task.completedAt)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PageHead({ onRefresh, loading }: { onRefresh?: () => void; loading?: boolean }) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">Tasks</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          Your tasks
        </h1>
        <p className="page-sub">
          Onboarding and activity tasks the backend tracks for your account. Completion feeds your
          credit score.
        </p>
      </div>
      {onRefresh && (
        <Button variant="ghost" onClick={onRefresh}>
          <RefreshCw size={15} className={loading ? 'spin' : undefined} /> Refresh
        </Button>
      )}
    </header>
  );
}
