const DAY_MS = 24 * 60 * 60 * 1000;

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const date = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const dateWithYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayStart = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** "Today, 9:00 AM", "Tomorrow, 9:00 AM", "Fri, 9:00 AM", "Mon 12 Oct, 9:00 AM". */
export function formatWhen(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  const days = Math.round((dayStart(at) - dayStart(now)) / DAY_MS);
  const clock = time.format(at);
  if (days === 0) return `Today, ${clock}`;
  if (days === 1) return `Tomorrow, ${clock}`;
  if (days === -1) return `Yesterday, ${clock}`;
  if (days > 1 && days < 7) return `${weekday.format(at)}, ${clock}`;
  if (new Date(at).getFullYear() !== new Date(now).getFullYear()) {
    return `${dateWithYear.format(at)}, ${clock}`;
  }
  return `${date.format(at)}, ${clock}`;
}

/** "in 3h", "in 2d", "5m ago". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const amount =
    abs < 60 * 60 * 1000
      ? `${Math.max(1, Math.round(abs / 60_000))}m`
      : abs < DAY_MS
        ? `${Math.round(abs / 3_600_000)}h`
        : `${Math.round(abs / DAY_MS)}d`;
  return diff >= 0 ? `in ${amount}` : `${amount} ago`;
}

export type DeadlineTone = 'overdue' | 'soon' | 'later';

export function deadlineTone(iso: string, now: number = Date.now()): DeadlineTone {
  const left = Date.parse(iso) - now;
  return left < 0 ? 'overdue' : left < DAY_MS ? 'soon' : 'later';
}

/** For <input type="datetime-local">, in this computer's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
