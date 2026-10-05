import {
  daysInMonth,
  fromWallTime,
  toWallTime,
  WallTime,
  wallTimeAsUtc,
} from '../../utils/timezone';

export const FREQUENCIES = [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/**
 * How a task repeats, starting from its `scheduledAt` in its time zone.
 *
 * - hourly: every `interval` hours (real hours, so 23 or 25 a day around
 *   daylight saving changes).
 * - daily, weekly, monthly, yearly: at scheduledAt's local time of day.
 * - weekly: on `byWeekday` (0 = Sunday ... 6 = Saturday), or scheduledAt's
 *   weekday when empty. Weeks start on Monday, which matters for "every 2
 *   weeks on Sun and Mon".
 * - monthly: on day `byMonthDay` (or scheduledAt's day). Shorter months use
 *   their last day: "the 31st" is 30 April and 28 February.
 * - yearly: scheduledAt's month, on day `byMonthDay`. 29 February repeats
 *   on 28 February in other years.
 *
 * scheduledAt itself is always the first occurrence.
 */
export interface Recurrence {
  freq: Frequency;
  interval: number;
  byWeekday: number[];
  byMonthDay: number | null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Stops a broken rule from looping forever. */
const MAX_STEPS = 5000;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Calendar arithmetic on dates alone (no zone involved). */
const addDays = ({ year, month, day }: DateParts, days: number): DateParts => {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
};

const weekdayOf = ({ year, month, day }: DateParts) =>
  new Date(Date.UTC(year, month - 1, day)).getUTCDay();

/** 0 for Monday ... 6 for Sunday. */
const mondayIndex = (weekday: number) => (weekday + 6) % 7;

const clampDay = (year: number, month: number, day: number) =>
  Math.min(day, daysInMonth(year, month));

/** A sensible rule for a frequency, matching the task's scheduled time. */
export function defaultRule(
  freq: Frequency,
  scheduledAt: number,
  timeZone: string,
): Recurrence {
  const wall = toWallTime(scheduledAt, timeZone);
  return {
    freq,
    interval: 1,
    byWeekday: freq === 'weekly' ? [weekdayOf(wall)] : [],
    byMonthDay: freq === 'monthly' || freq === 'yearly' ? wall.day : null,
  };
}

/**
 * Re-aims a rule at a new scheduled time, as when the user moves the task:
 * monthly and yearly rules follow the new day of the month.
 */
export function retargetRule(
  rule: Recurrence,
  scheduledAt: number,
  timeZone: string,
): Recurrence {
  if (rule.freq !== 'monthly' && rule.freq !== 'yearly') {
    return rule;
  }
  return { ...rule, byMonthDay: toWallTime(scheduledAt, timeZone).day };
}

/** Occurrence candidates in order (may include some before `start`). */
function* candidates(
  start: number,
  rule: Recurrence,
  timeZone: string,
  after: number,
): Generator<number> {
  const interval = Math.max(1, Math.floor(rule.interval));
  const wall = toWallTime(start, timeZone);
  const at = (date: DateParts): number =>
    fromWallTime(
      {
        ...date,
        hour: wall.hour,
        minute: wall.minute,
        second: wall.second,
      } as WallTime,
      timeZone,
    );
  const elapsed = Math.max(0, after - start);

  switch (rule.freq) {
    case 'hourly': {
      const step = interval * HOUR_MS;
      for (let k = Math.floor(elapsed / step); ; k++) {
        yield start + k * step;
      }
    }
    case 'daily': {
      // Start a step early: a daylight saving change can move a day by an hour.
      const first = Math.max(0, Math.floor(elapsed / (interval * DAY_MS)) - 1);
      for (let k = first; ; k++) {
        yield at(addDays(wall, k * interval));
      }
    }
    case 'weekly': {
      const days = (
        rule.byWeekday.length > 0 ? rule.byWeekday : [weekdayOf(wall)]
      )
        .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
        .map(mondayIndex)
        .sort((a, b) => a - b);
      const weekStart = addDays(wall, -mondayIndex(weekdayOf(wall)));
      const first = Math.max(
        0,
        Math.floor(elapsed / (interval * 7 * DAY_MS)) - 1,
      );
      for (let k = first; ; k++) {
        for (const offset of [...new Set(days)]) {
          yield at(addDays(weekStart, k * interval * 7 + offset));
        }
      }
    }
    case 'monthly': {
      const dayOfMonth = rule.byMonthDay ?? wall.day;
      const firstMonth = wall.year * 12 + (wall.month - 1);
      // No month is longer than 31 days, so this skip never overshoots.
      const first = Math.max(
        0,
        Math.floor(elapsed / (interval * 31 * DAY_MS)) - 1,
      );
      for (let k = first; ; k++) {
        const index = firstMonth + k * interval;
        const year = Math.floor(index / 12);
        const month = (index % 12) + 1;
        yield at({ year, month, day: clampDay(year, month, dayOfMonth) });
      }
    }
    case 'yearly': {
      const dayOfMonth = rule.byMonthDay ?? wall.day;
      const first = Math.max(
        0,
        Math.floor(elapsed / (interval * 366 * DAY_MS)) - 1,
      );
      for (let k = first; ; k++) {
        const year = wall.year + k * interval;
        yield at({
          year,
          month: wall.month,
          day: clampDay(year, wall.month, dayOfMonth),
        });
      }
    }
  }
}

/**
 * Up to `count` occurrences strictly after `after`, in order, for a task
 * scheduled at `start` (which is itself the first occurrence).
 */
export function occurrencesAfter(
  start: number,
  rule: Recurrence,
  timeZone: string,
  after: number,
  count: number,
): number[] {
  const found: number[] = [];
  if (count <= 0) {
    return found;
  }
  if (start > after) {
    found.push(start);
  }
  let last = Math.max(start, after);
  let steps = 0;
  for (const t of candidates(start, rule, timeZone, after)) {
    if (found.length >= count || ++steps > MAX_STEPS) {
      break;
    }
    if (t > last) {
      found.push(t);
      last = t;
    }
  }
  return found;
}

/** The first occurrence after `after`, or null if the rule can't produce one. */
export const nextOccurrence = (
  start: number,
  rule: Recurrence,
  timeZone: string,
  after: number,
): number | null => occurrencesAfter(start, rule, timeZone, after, 1)[0] ?? null;

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const UNITS: Record<Frequency, [string, string]> = {
  hourly: ['hour', 'hours'],
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) {
    return `${n}th`;
  }
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/** "Every day", "Every 2 weeks on Mon, Wed", "Monthly on the 31st"... */
export function describeRule(
  rule: Recurrence,
  start: number,
  timeZone: string,
): string {
  const wall = toWallTime(start, timeZone);
  const [one, many] = UNITS[rule.freq];
  const every =
    rule.interval === 1 ? `Every ${one}` : `Every ${rule.interval} ${many}`;
  switch (rule.freq) {
    case 'hourly':
    case 'daily':
      return every;
    case 'weekly': {
      const days = (
        rule.byWeekday.length > 0 ? rule.byWeekday : [weekdayOf(wall)]
      )
        .slice()
        .sort((a, b) => mondayIndex(a) - mondayIndex(b));
      if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) {
        return rule.interval === 1 ? 'Every weekday' : `${every} on weekdays`;
      }
      return `${every} on ${days.map(d => WEEKDAY_NAMES[d]).join(', ')}`;
    }
    case 'monthly':
      return `${every} on the ${ordinal(rule.byMonthDay ?? wall.day)}`;
    case 'yearly':
      return `${every} on ${rule.byMonthDay ?? wall.day} ${
        MONTH_NAMES[wall.month - 1]
      }`;
  }
}

/** Whether two rules repeat the same way. */
export const sameRule = (a: Recurrence | null, b: Recurrence | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The local date of an instant as "YYYY-MM-DD", for tests and logs. */
export const localDate = (instant: number, timeZone: string) => {
  const w = toWallTime(instant, timeZone);
  return new Date(wallTimeAsUtc(w)).toISOString().slice(0, 10);
};
