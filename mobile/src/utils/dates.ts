import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfDay,
  format,
  isSameYear,
  nextMonday,
  setHours,
  setMinutes,
  startOfDay,
  startOfMinute,
} from 'date-fns';

const at = (date: Date, hours: number, minutes = 0) =>
  startOfMinute(setMinutes(setHours(date, hours), minutes));

/** "2:30pm" */
export const formatTime = (date: Date) => format(date, 'h:mmaaa');

/** "Today", "Tomorrow", "Yesterday", "Tue 7 Oct" or "7 Oct 2027". */
export function formatDay(date: Date, now: Date = new Date()): string {
  const days = differenceInCalendarDays(date, now);
  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Tomorrow';
  }
  if (days === -1) {
    return 'Yesterday';
  }
  if (Math.abs(days) < 7) {
    return format(date, 'EEE d MMM');
  }
  return isSameYear(date, now)
    ? format(date, 'd MMM')
    : format(date, 'd MMM yyyy');
}

/** "Today · 2:30pm" */
export const formatDateTime = (date: Date, now: Date = new Date()) =>
  `${formatDay(date, now)} · ${formatTime(date)}`;

/** Compact distance: "45m", "3h", "2d". */
function shortDistance(minutes: number): string {
  const m = Math.abs(minutes);
  if (m < 60) {
    return `${Math.max(1, m)}m`;
  }
  if (m < 60 * 24) {
    return `${Math.round(m / 60)}h`;
  }
  return `${Math.round(m / (60 * 24))}d`;
}

export type DeadlineTone = 'overdue' | 'soon' | 'later';

/** "Due in 3h" / "2d late", plus a tone used for colouring. */
export function describeDeadline(deadline: Date, now: Date = new Date()) {
  const minutes = differenceInMinutes(deadline, now);
  if (minutes < 0) {
    return {
      text: `${shortDistance(minutes)} late`,
      tone: 'overdue' as DeadlineTone,
    };
  }
  return {
    text: `Due in ${shortDistance(minutes)}`,
    tone: (minutes <= 24 * 60 ? 'soon' : 'later') as DeadlineTone,
  };
}

/** Greeting that follows the clock. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) {
    return 'Up late';
  }
  if (h < 12) {
    return 'Morning';
  }
  if (h < 17) {
    return 'Afternoon';
  }
  return 'Evening';
}

export interface DatePreset {
  key: string;
  label: string;
  value: (now: Date) => Date;
}

/** One-tap choices for "when will you do it?". */
export const SCHEDULE_PRESETS: DatePreset[] = [
  { key: 'now', label: 'Now', value: now => startOfMinute(now) },
  {
    key: 'evening',
    label: 'Tonight',
    value: now => (now.getHours() < 18 ? at(now, 18) : at(addDays(now, 1), 18)),
  },
  { key: 'tomorrow', label: 'Tomorrow', value: now => at(addDays(now, 1), 9) },
  { key: 'nextweek', label: 'Next week', value: now => at(nextMonday(now), 9) },
];

/** One-tap choices for "when is it due?". Deadlines default to end of day. */
export const DEADLINE_PRESETS: DatePreset[] = [
  { key: 'today', label: 'Today', value: now => startOfMinute(endOfDay(now)) },
  {
    key: 'tomorrow',
    label: 'Tomorrow',
    value: now => startOfMinute(endOfDay(addDays(now, 1))),
  },
  {
    key: '3days',
    label: 'In 3 days',
    value: now => startOfMinute(endOfDay(addDays(now, 3))),
  },
  {
    key: 'week',
    label: 'In a week',
    value: now => startOfMinute(endOfDay(addDays(now, 7))),
  },
];

export { startOfDay, endOfDay };
