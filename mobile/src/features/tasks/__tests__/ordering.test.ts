import {
  deadlinePressure,
  OrderableTask,
  scoreBreakdown,
  smartScore,
  sortTasks,
} from '../ordering';

// Same scenarios as backend/src/tasks/task-ordering.spec.ts — the two
// implementations must agree.
const NOW = new Date('2026-01-10T12:00:00Z').getTime();
const H = 60 * 60 * 1000;
const at = (hoursFromNow: number) => new Date(NOW + hoursFromNow * H);

type T = OrderableTask & { id: string };
const task = (id: string, overrides: Partial<T> = {}): T => ({
  id,
  priority: 'medium',
  scheduledAt: at(0),
  deadline: null,
  completed: false,
  completedAt: null,
  createdAt: at(-100),
  ...overrides,
});
const ids = (tasks: T[]) => tasks.map(t => t.id);

describe('deadlinePressure', () => {
  it('is 0 without a deadline and ~1 when due right now', () => {
    expect(deadlinePressure(null, NOW)).toBe(0);
    expect(deadlinePressure(at(0), NOW)).toBeCloseTo(1);
  });

  it('exceeds 1 when overdue and caps at 1.5', () => {
    expect(deadlinePressure(at(-24), NOW)).toBeCloseTo(1.25);
    expect(deadlinePressure(at(-500), NOW)).toBe(1.5);
  });
});

describe('smartScore', () => {
  it('lets an imminent deadline outrank a higher priority with no deadline', () => {
    const urgentLow = task('low', { priority: 'low', deadline: at(2) });
    const relaxedHigh = task('high', {
      priority: 'high',
      scheduledAt: at(24 * 7),
    });
    expect(smartScore(urgentLow, NOW)).toBeGreaterThan(
      smartScore(relaxedHigh, NOW),
    );
  });

  it('breaks the score into weighted parts that add up', () => {
    const parts = scoreBreakdown(
      task('a', { priority: 'high', deadline: at(24) }),
      NOW,
    );
    expect(parts.priority).toBeCloseTo(0.4);
    expect(parts.priority + parts.deadline + parts.schedule).toBeCloseTo(
      parts.total,
    );
  });
});

describe('sortTasks', () => {
  const tasks: T[] = [
    task('done-old', { completed: true, completedAt: at(-10) }),
    task('next-week', {
      priority: 'high',
      deadline: at(24 * 7),
      scheduledAt: at(24 * 6),
    }),
    task('overdue', {
      priority: 'low',
      deadline: at(-3),
      scheduledAt: at(-30),
    }),
    task('done-new', { completed: true, completedAt: at(-1) }),
    task('tomorrow', {
      priority: 'medium',
      deadline: at(20),
      createdAt: at(-1),
    }),
    task('no-deadline', { priority: 'low', scheduledAt: at(48) }),
  ];

  it('smart: overdue first, completed last (most recent first)', () => {
    const sorted = ids(sortTasks(tasks, 'smart', NOW));
    expect(sorted[0]).toBe('overdue');
    expect(sorted.slice(-2)).toEqual(['done-new', 'done-old']);
    expect(sorted.indexOf('tomorrow')).toBeLessThan(
      sorted.indexOf('no-deadline'),
    );
  });

  it('deadline: earliest first, tasks without deadline last', () => {
    expect(ids(sortTasks(tasks, 'deadline', NOW)).slice(0, 4)).toEqual([
      'overdue',
      'tomorrow',
      'next-week',
      'no-deadline',
    ]);
  });

  it('priority: high > medium > low', () => {
    expect(ids(sortTasks(tasks, 'priority', NOW)).slice(0, 2)).toEqual([
      'next-week',
      'tomorrow',
    ]);
  });

  it('created: newest first', () => {
    expect(ids(sortTasks(tasks, 'created', NOW))[0]).toBe('tomorrow');
  });
});
