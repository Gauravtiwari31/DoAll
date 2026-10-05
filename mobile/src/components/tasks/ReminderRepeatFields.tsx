import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  describeOffset,
  REMINDER_OFFSETS,
} from '../../features/reminders/planner';
import {
  defaultRule,
  describeRule,
  Frequency,
  Recurrence,
} from '../../features/tasks/recurrence';
import { palette } from '../../theme';
import { AppText, Chip, IconButton, SectionLabel } from '../ui';

/** Repeat choices; "weekdays" is a weekly rule on Monday to Friday. */
type RepeatChoice = 'never' | Frequency | 'weekdays';

const REPEAT_CHOICES: { value: RepeatChoice; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'hourly', label: 'Hourly' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Index into WEEKDAYS → JavaScript's day number (0 = Sunday). */
const dayNumber = (index: number) => (index + 1) % 7;
const WORKWEEK = [1, 2, 3, 4, 5];

const UNIT: Record<Frequency, [string, string]> = {
  hourly: ['hour', 'hours'],
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

function choiceOf(rule: Recurrence | null): RepeatChoice {
  if (!rule) {
    return 'never';
  }
  const days = [...rule.byWeekday].sort();
  return rule.freq === 'weekly' &&
    rule.interval === 1 &&
    days.join() === WORKWEEK.join()
    ? 'weekdays'
    : rule.freq;
}

interface Props {
  reminderOffset: number | null;
  onReminderChange: (offset: number | null) => void;
  recurrence: Recurrence | null;
  onRecurrenceChange: (rule: Recurrence | null) => void;
  /** The task's scheduled time, which repeats start from. */
  scheduledAt: Date;
  timeZone: string;
}

/** The task editor's "Remind me" and "Repeat" sections. */
export function ReminderRepeatFields({
  reminderOffset,
  onReminderChange,
  recurrence,
  onRecurrenceChange,
  scheduledAt,
  timeZone,
}: Props) {
  const start = scheduledAt.getTime();
  const choice = choiceOf(recurrence);

  const pick = (value: RepeatChoice) => {
    if (value === 'never') {
      onRecurrenceChange(null);
    } else if (value === 'weekdays') {
      onRecurrenceChange({
        ...defaultRule('weekly', start, timeZone),
        byWeekday: WORKWEEK,
      });
    } else {
      onRecurrenceChange(defaultRule(value, start, timeZone));
    }
  };

  const setInterval = (interval: number) =>
    recurrence &&
    onRecurrenceChange({
      ...recurrence,
      interval: Math.min(99, Math.max(1, interval)),
    });

  const toggleDay = (day: number) => {
    if (!recurrence) {
      return;
    }
    const days = recurrence.byWeekday.includes(day)
      ? recurrence.byWeekday.filter(d => d !== day)
      : [...recurrence.byWeekday, day];
    // At least one day; none selected means "the scheduled day" anyway.
    if (days.length > 0) {
      onRecurrenceChange({ ...recurrence, byWeekday: days.sort() });
    }
  };

  return (
    <>
      <View>
        <SectionLabel>Remind me</SectionLabel>
        <View style={styles.wrap}>
          <Chip
            label="Off"
            selected={reminderOffset === null}
            onPress={() => onReminderChange(null)}
          />
          {REMINDER_OFFSETS.map(offset => (
            <Chip
              key={offset}
              label={describeOffset(offset)}
              icon={reminderOffset === offset ? 'bell' : undefined}
              color={palette.butter}
              selected={reminderOffset === offset}
              onPress={() => onReminderChange(offset)}
            />
          ))}
        </View>
      </View>

      <View>
        <SectionLabel>Repeat</SectionLabel>
        <View style={styles.wrap}>
          {REPEAT_CHOICES.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              color={option.value === 'never' ? undefined : palette.sky}
              selected={choice === option.value}
              onPress={() => pick(option.value)}
            />
          ))}
        </View>

        {recurrence && choice !== 'weekdays' ? (
          <View style={styles.interval}>
            <AppText variant="bodyStrong">Every</AppText>
            <IconButton
              icon="minus"
              label="Less often"
              size={36}
              onPress={() => setInterval(recurrence.interval - 1)}
            />
            <AppText variant="heading" style={styles.count}>
              {recurrence.interval}
            </AppText>
            <IconButton
              icon="plus"
              label="More apart"
              size={36}
              onPress={() => setInterval(recurrence.interval + 1)}
            />
            <AppText variant="bodyStrong">
              {UNIT[recurrence.freq][recurrence.interval === 1 ? 0 : 1]}
            </AppText>
          </View>
        ) : null}

        {recurrence?.freq === 'weekly' && choice !== 'weekdays' ? (
          <View style={styles.wrap}>
            {WEEKDAYS.map((label, index) => (
              <Chip
                key={label}
                label={label}
                color={palette.sky}
                selected={recurrence.byWeekday.includes(dayNumber(index))}
                onPress={() => toggleDay(dayNumber(index))}
              />
            ))}
          </View>
        ) : null}

        {recurrence ? (
          <AppText variant="mono" color="textMuted" style={styles.summary}>
            {describeRule(recurrence, start, timeZone)}
            {recurrence.freq === 'monthly' && (recurrence.byMonthDay ?? 0) > 28
              ? ' (the last day in shorter months)'
              : ''}
            {'. Ticking it off moves it to the next time.'}
          </AppText>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interval: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  count: { minWidth: 28, textAlign: 'center' },
  summary: { marginTop: 10 },
});
