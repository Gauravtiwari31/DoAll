import { palette } from '../../theme/palette';
import { Category, Priority, SortKey, TaskView } from './types';

/** Display metadata for enums: labels and sticker colours. */
export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; short: string }
> = {
  high: { label: 'High', short: 'HI', color: palette.signal },
  medium: { label: 'Medium', short: 'MED', color: palette.butter },
  low: { label: 'Low', short: 'LO', color: palette.mint },
};

export const CATEGORY_META: Record<Category, { label: string; color: string }> =
  {
    personal: { label: 'Personal', color: palette.blush },
    work: { label: 'Work', color: palette.sky },
    study: { label: 'Study', color: palette.lilac },
    health: { label: 'Health', color: palette.mint },
    shopping: { label: 'Shopping', color: palette.butter },
    other: { label: 'Other', color: palette.clay },
  };

export const SORT_META: Record<SortKey, { label: string; hint: string }> = {
  smart: { label: 'Smart', hint: 'Blends priority, deadline and schedule' },
  deadline: { label: 'Deadline', hint: 'Soonest due first' },
  scheduled: { label: 'Scheduled', hint: 'Earliest planned first' },
  priority: { label: 'Priority', hint: 'High → low' },
  created: { label: 'Newest', hint: 'Recently added first' },
};

export const VIEW_META: Record<TaskView, { label: string }> = {
  all: { label: 'All' },
  today: { label: 'Today' },
  upcoming: { label: 'Upcoming' },
  overdue: { label: 'Overdue' },
  done: { label: 'Done' },
};
