import {
  DEADLINE_PRESETS,
  describeDeadline,
  formatDay,
  greeting,
  SCHEDULE_PRESETS,
} from '../dates';

const now = new Date(2026, 0, 10, 12, 0); // Sat 10 Jan 2026, noon
const plus = (hours: number) => new Date(now.getTime() + hours * 3600_000);

describe('dates', () => {
  it('formats relative days', () => {
    expect(formatDay(now, now)).toBe('Today');
    expect(formatDay(plus(24), now)).toBe('Tomorrow');
    expect(formatDay(plus(-24), now)).toBe('Yesterday');
    expect(formatDay(plus(72), now)).toBe('Tue 13 Jan');
    expect(formatDay(new Date(2027, 2, 1), now)).toBe('1 Mar 2027');
  });

  it('describes deadlines with a tone', () => {
    expect(describeDeadline(plus(0.5), now)).toEqual({
      text: 'Due in 30m',
      tone: 'soon',
    });
    expect(describeDeadline(plus(48), now)).toEqual({
      text: 'Due in 2d',
      tone: 'later',
    });
    expect(describeDeadline(plus(-3), now)).toEqual({
      text: '3h late',
      tone: 'overdue',
    });
  });

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 10, 9))).toBe('Morning');
    expect(greeting(new Date(2026, 0, 10, 20))).toBe('Evening');
  });

  it('builds sensible presets', () => {
    const tonight = SCHEDULE_PRESETS.find(p => p.key === 'evening')!.value(now);
    expect(tonight.getHours()).toBe(18);
    expect(tonight.getDate()).toBe(10);
    const nextWeek = SCHEDULE_PRESETS.find(p => p.key === 'nextweek')!.value(
      now,
    );
    expect(nextWeek.getDay()).toBe(1); // Monday
    const endOfToday = DEADLINE_PRESETS[0].value(now);
    expect(endOfToday.getHours()).toBe(23);
    expect(endOfToday.getMinutes()).toBe(59);
  });
});
