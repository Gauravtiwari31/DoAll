import {
  defaultRule,
  describeRule,
  localDate,
  nextOccurrence,
  occurrencesAfter,
  Recurrence,
  retargetRule,
} from '../recurrence';
import { fromWallTime, toWallTime } from '../../../utils/timezone';

const KOLKATA = 'Asia/Kolkata';
const NEW_YORK = 'America/New_York';
const BERLIN = 'Europe/Berlin';

/** The instant of a local time in a zone: at('2026-01-31 09:00', KOLKATA). */
const at = (local: string, timeZone: string) => {
  const [date, time = '00:00'] = local.split(' ');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return fromWallTime({ year, month, day, hour, minute, second: 0 }, timeZone);
};

/** Occurrences as "YYYY-MM-DD HH:mm" in the zone. */
const local = (instants: number[], timeZone: string) =>
  instants.map(t => {
    const w = toWallTime(t, timeZone);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(
      w.minute,
    )}`;
  });

const rule = (overrides: Partial<Recurrence>): Recurrence => ({
  freq: 'daily',
  interval: 1,
  byWeekday: [],
  byMonthDay: null,
  ...overrides,
});

const series = (
  start: string,
  r: Recurrence,
  timeZone: string,
  count: number,
  after = at(start, timeZone) - 1,
) => local(occurrencesAfter(at(start, timeZone), r, timeZone, after, count), timeZone);

describe('time zones', () => {
  it('converts wall time to instants and back', () => {
    const t = at('2026-10-06 09:00', KOLKATA);
    expect(new Date(t).toISOString()).toBe('2026-10-06T03:30:00.000Z');
    expect(local([t], KOLKATA)).toEqual(['2026-10-06 09:00']);
    expect(local([t], NEW_YORK)).toEqual(['2026-10-05 23:30']);
  });

  it('moves a time that falls in a daylight saving gap to just after it', () => {
    // New York skipped 2:00-3:00 on 8 March 2026.
    expect(local([at('2026-03-08 02:30', NEW_YORK)], NEW_YORK)).toEqual([
      '2026-03-08 03:30',
    ]);
  });

  it('picks the first of a time that happens twice', () => {
    // 1:30 happened twice in New York on 1 November 2026.
    const t = at('2026-11-01 01:30', NEW_YORK);
    expect(new Date(t).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('occurrences', () => {
  it('starts with the scheduled time itself', () => {
    expect(series('2026-10-06 09:00', rule({}), KOLKATA, 3)).toEqual([
      '2026-10-06 09:00',
      '2026-10-07 09:00',
      '2026-10-08 09:00',
    ]);
  });

  it('repeats hourly by real hours', () => {
    expect(
      series(
        '2026-03-08 00:30',
        rule({ freq: 'hourly', interval: 1 }),
        NEW_YORK,
        3,
      ),
    ).toEqual(['2026-03-08 00:30', '2026-03-08 01:30', '2026-03-08 03:30']);
  });

  it('keeps the local time across daylight saving changes', () => {
    expect(series('2026-03-28 09:00', rule({}), BERLIN, 3)).toEqual([
      '2026-03-28 09:00',
      '2026-03-29 09:00', // clocks went forward that night
      '2026-03-30 09:00',
    ]);
    expect(series('2026-10-31 09:00', rule({ interval: 2 }), NEW_YORK, 3)).toEqual([
      '2026-10-31 09:00',
      '2026-11-02 09:00', // clocks went back on the 1st
      '2026-11-04 09:00',
    ]);
  });

  it('keeps the time of the zone the task was planned in, wherever the phone is', () => {
    const start = at('2026-10-06 09:00', KOLKATA);
    const [, next] = occurrencesAfter(start, rule({}), KOLKATA, start - 1, 2);
    expect(local([next], KOLKATA)).toEqual(['2026-10-07 09:00']);
    expect(local([next], NEW_YORK)).toEqual(['2026-10-06 23:30']);
  });

  it('repeats weekly on chosen days, with weeks starting on Monday', () => {
    // 6 October 2026 is a Tuesday.
    expect(
      series(
        '2026-10-06 09:00',
        rule({ freq: 'weekly', byWeekday: [1, 3, 5] }),
        KOLKATA,
        5,
      ),
    ).toEqual([
      '2026-10-06 09:00', // the scheduled time comes first, even on a Tuesday
      '2026-10-07 09:00',
      '2026-10-09 09:00',
      '2026-10-12 09:00',
      '2026-10-14 09:00',
    ]);
    expect(
      series(
        '2026-10-05 09:00',
        rule({ freq: 'weekly', interval: 2, byWeekday: [0, 1] }),
        KOLKATA,
        4,
      ),
    ).toEqual([
      '2026-10-05 09:00',
      '2026-10-11 09:00', // Sunday ends the first week
      '2026-10-19 09:00',
      '2026-10-25 09:00',
    ]);
  });

  it("repeats weekly on the scheduled day when no days are chosen", () => {
    expect(
      series('2026-10-06 09:00', rule({ freq: 'weekly' }), KOLKATA, 2),
    ).toEqual(['2026-10-06 09:00', '2026-10-13 09:00']);
  });

  it('uses the last day of shorter months for "monthly on the 31st"', () => {
    expect(
      series(
        '2026-01-31 18:00',
        rule({ freq: 'monthly', byMonthDay: 31 }),
        KOLKATA,
        5,
      ),
    ).toEqual([
      '2026-01-31 18:00',
      '2026-02-28 18:00',
      '2026-03-31 18:00',
      '2026-04-30 18:00',
      '2026-05-31 18:00',
    ]);
  });

  it('keeps the day of the month after the task moved to a short month', () => {
    // Completing the January task moved it to 28 February; the rule still says 31.
    expect(
      series(
        '2026-02-28 18:00',
        rule({ freq: 'monthly', byMonthDay: 31 }),
        KOLKATA,
        2,
      ),
    ).toEqual(['2026-02-28 18:00', '2026-03-31 18:00']);
  });

  it('repeats 29 February on 28 February in other years', () => {
    expect(
      series(
        '2028-02-29 08:00',
        rule({ freq: 'yearly', byMonthDay: 29 }),
        KOLKATA,
        5,
      ),
    ).toEqual([
      '2028-02-29 08:00',
      '2029-02-28 08:00',
      '2030-02-28 08:00',
      '2031-02-28 08:00',
      '2032-02-29 08:00',
    ]);
  });

  it('skips ahead from an old start without walking every occurrence', () => {
    const start = at('2020-01-31 09:00', KOLKATA);
    const after = at('2026-10-06 12:00', KOLKATA);
    const r = rule({ freq: 'monthly', byMonthDay: 31 });
    expect(local(occurrencesAfter(start, r, KOLKATA, after, 2), KOLKATA)).toEqual([
      '2026-10-31 09:00',
      '2026-11-30 09:00',
    ]);
    expect(
      local([nextOccurrence(start, rule({}), KOLKATA, after)!], KOLKATA),
    ).toEqual(['2026-10-07 09:00']);
    expect(
      local(
        [nextOccurrence(start, rule({ freq: 'hourly', interval: 5 }), KOLKATA, after)!],
        KOLKATA,
      ),
    ).toEqual(['2026-10-06 14:00']);
  });

  it('returns occurrences strictly after the given time', () => {
    const start = at('2026-10-06 09:00', KOLKATA);
    expect(
      local(occurrencesAfter(start, rule({}), KOLKATA, start, 1), KOLKATA),
    ).toEqual(['2026-10-07 09:00']);
  });
});

describe('rules', () => {
  it('derives a default rule from the scheduled time', () => {
    const start = at('2026-10-06 09:00', KOLKATA); // a Tuesday
    expect(defaultRule('weekly', start, KOLKATA)).toEqual(
      rule({ freq: 'weekly', byWeekday: [2] }),
    );
    expect(defaultRule('monthly', start, KOLKATA)).toEqual(
      rule({ freq: 'monthly', byMonthDay: 6 }),
    );
    expect(
      retargetRule(defaultRule('monthly', start, KOLKATA), at('2026-10-31 09:00', KOLKATA), KOLKATA),
    ).toEqual(rule({ freq: 'monthly', byMonthDay: 31 }));
  });

  it('describes rules', () => {
    const start = at('2026-10-06 09:00', KOLKATA);
    const describe_ = (r: Partial<Recurrence>) => describeRule(rule(r), start, KOLKATA);
    expect(describe_({})).toBe('Every day');
    expect(describe_({ interval: 3 })).toBe('Every 3 days');
    expect(describe_({ freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] })).toBe('Every weekday');
    expect(describe_({ freq: 'weekly', interval: 2, byWeekday: [0, 3] })).toBe(
      'Every 2 weeks on Wed, Sun',
    );
    expect(describe_({ freq: 'monthly', byMonthDay: 31 })).toBe('Every month on the 31st');
    expect(describe_({ freq: 'monthly', byMonthDay: 12 })).toBe('Every month on the 12th');
    expect(describe_({ freq: 'yearly', byMonthDay: 6 })).toBe('Every year on 6 Oct');
    expect(localDate(start, KOLKATA)).toBe('2026-10-06');
  });
});
