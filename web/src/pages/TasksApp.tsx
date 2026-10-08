import type { SortKey } from '@app/features/tasks/types';
import { SORT_META } from '@app/features/tasks/taskMeta';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, NetworkError } from '../api';
import { AdBreak } from '../components/Ads';
import { FocusMode } from '../components/FocusMode';
import { Footer } from '../components/Footer';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { TaskEditor } from '../components/TaskEditor';
import { TaskItem } from '../components/TaskItem';
import { useToast } from '../components/Toasts';
import { ACCOUNT_DELETION_URL } from '../config';
import { formatRelative, formatWhen, greeting } from '../format';
import { taskStore, useTasks, type SyncStatus } from '../hooks/useTasks';
import { readJson, storage, STORAGE_KEYS } from '../storage';
import { createTask, editTask, setCompleted } from '../taskOps';
import { toTask } from '../taskStore';
import type { Task, TaskInput, TaskView, User } from '../types';
import { viewCounts, VIEWS, visibleTasks, type Filters } from '../views';

const SORTS = Object.keys(SORT_META) as SortKey[];

/** The stored version of a task, which may be newer than the one on screen. */
const latest = (task: Task): Task => {
  const stored = taskStore.get(task.id);
  return stored ? toTask(stored) : task;
};

/** Re-renders every minute, so "overdue" and "in 5m" stay true. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function SyncPill({ status, now, onRetry }: { status: SyncStatus; now: number; onRetry: () => void }) {
  const { state, lastSyncAt, pending } = status;
  if (state === 'syncing') {
    return (
      <span className="pill pill-busy">
        <Icon name="sync" size={14} /> <span className="pill-text">Syncing…</span>
      </span>
    );
  }
  if (state === 'offline' || state === 'error') {
    return (
      <button type="button" className="pill pill-warn" onClick={onRetry} title={status.message ?? undefined}>
        <Icon name={state === 'offline' ? 'offline' : 'alert'} size={14} />
        <span className="pill-text">
          {state === 'offline' ? 'Offline' : "Couldn't sync"}
          {pending > 0 && ` · ${pending} waiting`} · Retry
        </span>
      </button>
    );
  }
  // `now` only moves once a minute, so a sync just now can look like it's in the future.
  const ago = lastSyncAt ? Math.max(now, Date.now()) - Date.parse(lastSyncAt) : null;
  const label =
    pending > 0
      ? `${pending} waiting`
      : ago === null || ago < 60_000
        ? 'Synced'
        : `Synced ${formatRelative(lastSyncAt!, Date.now())}`;
  return (
    <span className="pill" title={lastSyncAt ? `Last synced ${formatWhen(lastSyncAt, Date.now())}` : undefined}>
      <Icon name="check" size={14} />
      <span className="pill-text">{label}</span>
    </span>
  );
}

interface Props {
  user: User;
  focusUnlocked: boolean;
  onLogoTap: () => void;
}

export function TasksApp({ user, focusUnlocked, onLogoTap }: Props) {
  const { tasks, status, save, remove, restore, syncNow } = useTasks(user);
  const toast = useToast();
  const now = useNow();

  const [filters, setFilters] = useState<Filters>({ view: 'today', search: '', priority: null, category: null });
  const [sort, setSortState] = useState<SortKey>(() => {
    const saved = readJson<SortKey>(STORAGE_KEYS.sort);
    return saved && SORTS.includes(saved) ? saved : 'smart';
  });
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [focusing, setFocusing] = useState(false);
  const [resending, setResending] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  const setSort = (next: SortKey) => {
    setSortState(next);
    storage.set(STORAGE_KEYS.sort, JSON.stringify(next));
  };

  const counts = useMemo(() => viewCounts(tasks, now), [tasks, now]);
  const shown = useMemo(() => visibleTasks(tasks, filters, sort, now), [tasks, filters, sort, now]);
  const todayTotal = counts.today;
  const todayDone = useMemo(
    () => tasks.filter(t => t.completed && t.completedAt && Date.parse(t.completedAt) >= new Date(now).setHours(0, 0, 0, 0)).length,
    [tasks, now],
  );

  // N: new task, /: search (outside text fields).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || editing || focusing) return;
      if (target?.closest('input, textarea, select, dialog')) return;
      if (event.key === 'n') {
        event.preventDefault();
        setEditing('new');
      } else if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, focusing]);

  const toggle = useCallback(
    (task: Task) => {
      const updated = setCompleted(task, !task.completed);
      save(updated);
      if (!updated.completed && !task.completed) {
        toast({
          message: `Done. Next: ${formatWhen(updated.scheduledAt)}`,
          tone: 'success',
          action: { label: 'Undo', onClick: () => save(editTask(updated, { scheduledAt: task.scheduledAt, deadline: task.deadline })) },
        });
      } else if (updated.completed) {
        toast({
          message: 'Done and dusted.',
          tone: 'success',
          action: { label: 'Undo', onClick: () => save(setCompleted(updated, false)) },
        });
      }
    },
    [save, toast],
  );

  const deleteTask = useCallback(
    (task: Task) => {
      remove(task.id);
      setEditing(null);
      toast({ message: `Deleted "${task.title}"`, action: { label: 'Undo', onClick: () => restore(task) } });
    },
    [remove, restore, toast],
  );

  const submit = (input: TaskInput) => {
    if (editing === 'new') {
      save(createTask(input));
      toast({ message: 'Task added', tone: 'success' });
    } else if (editing) {
      save(editTask(latest(editing), input));
    }
    setEditing(null);
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.resendVerification();
      toast({ message: `Sent. Check ${user.email}.`, tone: 'success' });
    } catch (error) {
      toast({
        message: error instanceof ApiError || error instanceof NetworkError ? error.message : "Couldn't send it",
        tone: 'error',
      });
    } finally {
      setResending(false);
    }
  };

  const exportData = () => {
    const data = { exportedAt: new Date().toISOString(), account: { name: user.name, email: user.email }, tasks: taskStore.all() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: `doall-tasks-${new Date().toISOString().slice(0, 10)}.json`,
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const signOut = async () => {
    const pending = taskStore.pendingCount();
    if (
      pending > 0 &&
      !window.confirm(
        `${pending} change${pending === 1 ? " hasn't" : "s haven't"} reached your account yet and will be lost if you sign out now. Sign out anyway?`,
      )
    ) {
      return;
    }
    // Nothing of this account stays in the browser after signing out.
    taskStore.clear();
    await api.logout();
  };

  const firstName = user.name.split(' ')[0];
  const empty =
    tasks.length === 0
      ? { title: 'A clean slate', text: 'Add your first task, or open the DoAll app: tasks from your phone show up here.' }
      : filters.search || filters.priority || filters.category
        ? { title: 'Nothing matches', text: 'Try another search or filter.' }
        : {
            today: { title: 'Nothing for today', text: 'Enjoy it, or plan something.' },
            upcoming: { title: 'Nothing planned yet', text: 'Tasks for after today show up here.' },
            overdue: { title: 'Nothing overdue', text: 'Every deadline is in hand.' },
            all: { title: 'No tasks', text: '' },
            done: { title: 'Nothing finished yet', text: 'Ticked-off tasks land here.' },
          }[filters.view];

  return (
    <>
      <header className="topbar">
        <Logo onTap={onLogoTap} />
        <div className="topbar-actions">
          <SyncPill status={status} now={now} onRetry={() => void syncNow()} />
          {focusUnlocked && (
            <button
              type="button"
              className="btn btn-lime btn-small"
              aria-label="Focus mode"
              onClick={() => setFocusing(true)}
            >
              <Icon name="target" size={16} /> <span className="btn-label">Focus</span>
            </button>
          )}
          <details className="menu">
            <summary className="avatar" aria-label="Account">
              {firstName.slice(0, 1).toUpperCase()}
            </summary>
            <div className="menu-panel card">
              <p className="menu-user">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </p>
              <button type="button" className="menu-item" onClick={exportData}>
                <Icon name="download" size={16} /> Export my data
              </button>
              <a className="menu-item" href={ACCOUNT_DELETION_URL} target="_blank" rel="noopener noreferrer">
                <Icon name="trash" size={16} /> Delete account
              </a>
              <button type="button" className="menu-item" onClick={() => void signOut()}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
          </details>
        </div>
      </header>

      {status.unverified && (
        <div className="banner" role="status">
          <Icon name="alert" />
          <span>
            Confirm your email to back up changes made here. Open the link we sent to <strong>{user.email}</strong>.
          </span>
          <button type="button" className="btn btn-ink btn-small" onClick={() => void resend()} disabled={resending}>
            {resending ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}

      <main className="app">
        <section className="app-main">
          <div className="app-heading">
            <div>
              <p className="eyebrow">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <h1>
                {greeting(new Date(now))}, {firstName}.
              </h1>
            </div>
            <button type="button" className="btn btn-signal" onClick={() => setEditing('new')}>
              <Icon name="plus" /> New task
            </button>
          </div>

          <nav className="views" aria-label="Views">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={filters.view === key ? 'view active' : 'view'}
                aria-pressed={filters.view === key}
                onClick={() => setFilters(f => ({ ...f, view: key as TaskView }))}
              >
                {label}
                <span className={key === 'overdue' && counts.overdue > 0 ? 'count count-alert' : 'count'}>{counts[key]}</span>
              </button>
            ))}
          </nav>

          <div className="toolbar">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Search</span>
              <input
                ref={search}
                type="search"
                placeholder="Search tasks or #tags"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </label>
            <label className="sort">
              <span className="sr-only">Order</span>
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)} title={SORT_META[sort].hint}>
                {SORTS.map(key => (
                  <option key={key} value={key}>
                    {SORT_META[key].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {shown.length > 0 ? (
            <ul className="task-list">
              {shown.map(task => (
                <TaskItem key={task.id} task={task} now={now} onToggle={toggle} onEdit={setEditing} onDelete={deleteTask} />
              ))}
            </ul>
          ) : (
            <div className="empty card">
              <h2>{empty.title}</h2>
              {empty.text && <p>{empty.text}</p>}
            </div>
          )}
        </section>

        <aside className="app-side">
          <section className="card stats">
            <div
              className="ring"
              style={{ ['--progress' as string]: `${todayTotal ? (todayDone / todayTotal) * 360 : 0}deg` }}
              aria-hidden="true"
            >
              <span>{todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0}%</span>
            </div>
            <dl>
              <div>
                <dt>Done today</dt>
                <dd>{todayDone}</dd>
              </div>
              <div>
                <dt>Open</dt>
                <dd>{tasks.filter(t => !t.completed).length}</dd>
              </div>
              <div>
                <dt>Overdue</dt>
                <dd className={counts.overdue ? 'alert' : undefined}>{counts.overdue}</dd>
              </div>
            </dl>
          </section>
          <AdBreak compact />
          <p className="hint shortcuts">
            <kbd>N</kbd> new task · <kbd>/</kbd> search
          </p>
        </aside>
      </main>

      <Footer />

      {editing && (
        <TaskEditor
          task={editing === 'new' ? null : editing}
          onSave={submit}
          onDelete={deleteTask}
          onClose={() => setEditing(null)}
        />
      )}
      {focusing && (
        <FocusMode
          tasks={tasks}
          onComplete={task => toggle(latest(task))}
          onClose={() => setFocusing(false)}
        />
      )}
    </>
  );
}
