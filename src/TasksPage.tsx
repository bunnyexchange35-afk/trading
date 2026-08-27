import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleDashed, Clock3,
  ListChecks, Loader2, RefreshCcw, XCircle,
} from 'lucide-react';
import { EmptyState, PageHero } from './components';
import { useApp } from './app-context';
import { apiMessage, getTasks, type TasksResponse } from './api';
import type { StudentTask, TasksSummary } from './types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const statusMeta: Record<string, { label: string; className: string; icon: JSX.Element }> = {
  pending: { label: 'Pending', className: 'task-status-pending', icon: <CircleDashed size={13} /> },
  in_progress: { label: 'In Progress', className: 'task-status-progress', icon: <Clock3 size={13} /> },
  completed: { label: 'Completed', className: 'task-status-completed', icon: <CheckCircle2 size={13} /> },
  failed: { label: 'Failed', className: 'task-status-failed', icon: <XCircle size={13} /> },
  overdue: { label: 'Overdue', className: 'task-status-overdue', icon: <AlertTriangle size={13} /> },
};

const priorityClassName: Record<string, string> = {
  high: 'task-priority-high',
  medium: 'task-priority-medium',
  low: 'task-priority-low',
};

export default function TasksPage() {
  const { user, openAuth } = useApp();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [summary, setSummary] = useState<TasksSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response: TasksResponse = await getTasks();
      if (!response.success || !response.tasks) {
        throw new Error(response.error || 'Tasks are not available right now.');
      }
      setTasks(response.tasks);
      setSummary(response.summary ?? null);
    } catch (loadError) {
      setError(apiMessage(loadError));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  if (!user) {
    return (
      <main>
        <PageHero
          eyebrow="Your desk"
          title="Tasks"
          copy="Your assigned tasks appear here once you sign in."
        />
        <section className="container account-layout">
          <div className="settings-content">
            <EmptyState
              title="Sign in to view your tasks"
              copy="Tasks are assigned to your account by the desk and are always in sync with the backend."
              action={
                <button className="btn btn-purple" onClick={() => openAuth('signin')}>
                  Sign in <ArrowRight />
                </button>
              }
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <PageHero
        eyebrow="Your desk"
        title="Tasks"
        copy="Learning and verification tasks assigned to your account. Only your own tasks are ever shown."
      />
      <section className="container tasks-page">
        <div className="tasks-toolbar">
          {summary && (
            <div className="tasks-summary-pills">
              <span>Total <b>{summary.total}</b></span>
              <span className="pill-pending">Pending <b>{summary.pending}</b></span>
              <span className="pill-progress">In Progress <b>{summary.inProgress}</b></span>
              <span className="pill-completed">Completed <b>{summary.completed}</b></span>
              {summary.failed > 0 && <span className="pill-failed">Failed <b>{summary.failed}</b></span>}
              {summary.overdue > 0 && <span className="pill-overdue">Overdue <b>{summary.overdue}</b></span>}
            </div>
          )}
          <button className="btn btn-soft" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />} Refresh
          </button>
        </div>

        {error && <div className="tasks-error"><AlertTriangle size={16} /> {error}</div>}

        {loading && tasks.length === 0 && (
          <div className="tasks-empty"><Loader2 size={26} className="spin" /><p>Loading your tasks from the backend…</p></div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="tasks-empty">
            <ListChecks size={26} />
            <p>No tasks are assigned to your account right now.</p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="tasks-list">
            {tasks.map((task) => {
              const meta = statusMeta[task.status] ?? statusMeta.pending;
              return (
                <article className={`task-card task-${task.status}`} key={task.id}>
                  <header>
                    <div className="task-title-wrap">
                      <h3>{task.title}</h3>
                      <span className={`task-priority ${priorityClassName[task.priority.toLowerCase()] ?? ''}`}>
                        {task.priority}
                      </span>
                    </div>
                    <span className={`task-status ${meta.className}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </header>
                  <p>{task.description}</p>
                  <footer>
                    <span className="task-chip">{task.category}</span>
                    <span className="task-date"><CalendarClock size={13} /> Due {formatDate(task.dueDate)}</span>
                    {task.status === 'completed' ? (
                      <span className="task-date task-done"><CheckCircle2 size={13} /> Completed {formatDate(task.completedAt)}</span>
                    ) : (
                      <span className="task-date task-created">Created {formatDate(task.createdAt)}</span>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        <p className="tasks-note">
          Tasks, statuses and categories are managed by the desk on the backend — the website only
          displays what your account is assigned. <Link to="/support">Need help with a task?</Link>
        </p>
      </section>
    </main>
  );
}
