import { makeTask } from '../../../test-utils/fixtures';
import { describeOffset, planReminders } from '../planner';

const NOW = Date.parse('2026-10-06T03:30:00.000Z'); // 9:00 in Kolkata
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();

describe('planReminders', () => {
  it('reminds of one-off tasks ahead of time, once', () => {
    const task = makeTask({
      title: 'Call the bank',
      scheduledAt: iso(NOW + 60 * MIN),
      reminderOffset: 10,
    });
    const plan = planReminders([task], NOW);
    expect(plan).toEqual([
      expect.objectContaining({
        taskId: task.id,
        title: 'Call the bank',
        fireAt: NOW + 50 * MIN,
      }),
    ]);
    expect(plan[0].body).toMatch(/^Coming up in 10 min, at /);
  });

  it('skips done tasks, tasks without a reminder and reminders already past', () => {
    const soon = iso(NOW + 5 * MIN);
    expect(
      planReminders(
        [
          makeTask({ scheduledAt: soon, reminderOffset: 0, completed: true }),
          makeTask({ scheduledAt: soon, reminderOffset: null }),
          makeTask({ scheduledAt: soon, reminderOffset: 10 }), // was due 5 min ago
          makeTask({ scheduledAt: iso(NOW - DAY), reminderOffset: 0 }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it('plans every upcoming occurrence of a repeating task, within limits', () => {
    const task = makeTask({
      scheduledAt: iso(NOW - 3 * DAY), // started 3 days ago, still open
      reminderOffset: 0,
      recurrence: { freq: 'daily', interval: 1, byWeekday: [], byMonthDay: null },
      timeZone: 'Asia/Kolkata',
    });
    const plan = planReminders([task], NOW, {
      perTask: 5,
      total: 100,
      horizon: 30 * DAY,
    });
    expect(plan.map(r => r.fireAt)).toEqual(
      [1, 2, 3, 4, 5].map(d => NOW + d * DAY),
    );
    expect(new Set(plan.map(r => r.id)).size).toBe(5);

    const shortHorizon = planReminders([task], NOW, {
      perTask: 5,
      total: 100,
      horizon: 2.5 * DAY,
    });
    expect(shortHorizon).toHaveLength(2);
  });

  it('keeps the soonest reminders when there are too many', () => {
    const tasks = [3, 1, 2].map(h =>
      makeTask({ title: `in ${h}h`, scheduledAt: iso(NOW + h * 60 * MIN), reminderOffset: 0 }),
    );
    const plan = planReminders(tasks, NOW, { perTask: 5, total: 2, horizon: DAY });
    expect(plan.map(r => r.title)).toEqual(['in 1h', 'in 2h']);
  });
});

describe('describeOffset', () => {
  it('reads naturally', () => {
    expect(describeOffset(0)).toBe('At the time');
    expect(describeOffset(10)).toBe('10 min before');
    expect(describeOffset(60)).toBe('1 hour before');
    expect(describeOffset(120)).toBe('2 hours before');
    expect(describeOffset(24 * 60)).toBe('1 day before');
  });
});
