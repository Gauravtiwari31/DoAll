/**
 * Wall-clock time in a given IANA time zone (e.g. "Asia/Kolkata"), so
 * repeating tasks keep their local time ("9:00 every day") across daylight
 * saving changes and when the phone moves to another zone.
 *
 * Built on Intl.DateTimeFormat. If the JavaScript engine can't handle a zone,
 * the phone's own zone stands in for it.
 */

/** A local date and time. `month` is 1-12. */
export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The phone's time zone, e.g. "Europe/Berlin". "UTC" if the engine can't tell. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/** A formatter for the zone, or null if the engine doesn't know it. */
function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(timeZone)) {
    let formatter: Intl.DateTimeFormat | null = null;
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
      formatter.formatToParts(0); // engines without formatToParts fail here, not later
    } catch {
      formatter = null;
    }
    formatters.set(timeZone, formatter);
  }
  return formatters.get(timeZone) ?? null;
}

/** Whether the zone can be used (it's a real IANA zone the engine knows). */
export const isKnownTimeZone = (timeZone: string) =>
  formatterFor(timeZone) !== null;

function localWallTime(instant: number): WallTime {
  const d = new Date(instant);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

/** The local date and time in `timeZone` at `instant` (ms). */
export function toWallTime(instant: number, timeZone: string): WallTime {
  const formatter = formatterFor(timeZone);
  if (!formatter) {
    return localWallTime(instant);
  }
  const wall: WallTime = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  };
  for (const part of formatter.formatToParts(instant)) {
    if (part.type in wall) {
      wall[part.type as keyof WallTime] = Number(part.value);
    }
  }
  // Some engines print midnight as 24 even with h23.
  if (wall.hour === 24) {
    wall.hour = 0;
  }
  return wall;
}

/** The wall time's fields read as if it were UTC, in ms. Normalises overflow (day 32 → next month). */
export const wallTimeAsUtc = (w: WallTime) =>
  Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

/** How far `timeZone` is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const whole = Math.floor(instant / 1000) * 1000;
  return wallTimeAsUtc(toWallTime(whole, timeZone)) - whole;
}

const sameWallTime = (a: WallTime, b: WallTime) =>
  wallTimeAsUtc(a) === wallTimeAsUtc(b);

/**
 * The instant (ms) when it is `wall` o'clock in `timeZone`.
 * - A time that happens twice (clocks going back) gives the first one.
 * - A time that doesn't exist (clocks going forward) gives the moment just
 *   after the gap, e.g. 2:30 on a 2:00 → 3:00 night gives 3:30.
 */
export function fromWallTime(wall: WallTime, timeZone: string): number {
  if (!formatterFor(timeZone)) {
    return new Date(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    ).getTime();
  }
  const asUtc = wallTimeAsUtc(wall);
  // The offsets in force around that time; one of them applies.
  const offsets = new Set([
    offsetAt(asUtc - DAY_MS, timeZone),
    offsetAt(asUtc, timeZone),
    offsetAt(asUtc + DAY_MS, timeZone),
  ]);
  const candidates = [...offsets].map(offset => asUtc - offset);
  const exact = candidates.filter(t =>
    sameWallTime(toWallTime(t, timeZone), normalise(wall)),
  );
  return exact.length > 0 ? Math.min(...exact) : Math.max(...candidates);
}

/** Rolls overflowing fields over, so day 32 of January reads as 1 February. */
function normalise(wall: WallTime): WallTime {
  const d = new Date(wallTimeAsUtc(wall));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

/** Days in a month (`month` 1-12). */
export const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();
