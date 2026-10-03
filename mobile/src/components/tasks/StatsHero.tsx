import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Task } from '../../features/tasks/types';
import { palette, useTheme } from '../../theme';
import { describeDeadline } from '../../utils/dates';
import { AppText } from '../ui/AppText';
import { BrutalBox } from '../ui/Brutal';
import { DashedRule } from '../ui/DashedRule';
import { Icon } from '../ui/Icon';
import { ProgressRing } from '../ui/ProgressRing';

interface StatsHeroProps {
  todayTotal: number;
  todayDone: number;
  overdue: number;
  active: number;
  nextUp: Task | null;
  now: number;
  onOpenTask: (task: Task) => void;
}

/** Lime "sticker" card summarising today and pointing at the next task. */
export function StatsHero({
  todayTotal,
  todayDone,
  overdue,
  active,
  nextUp,
  now,
  onOpenTask,
}: StatsHeroProps) {
  const t = useTheme();
  const progress = todayTotal === 0 ? 0 : todayDone / todayTotal;
  const left = todayTotal - todayDone;

  const headline =
    todayTotal === 0
      ? 'Nothing planned today'
      : left === 0
      ? 'Today is cleared!'
      : `${left} to go today`;

  return (
    <BrutalBox
      color={palette.lime}
      radius={t.radius.lg}
      contentStyle={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.copy}>
          <AppText variant="label" color={palette.ink} uppercase>
            Today's progress
          </AppText>
          <AppText
            variant="heading"
            color={palette.ink}
            style={styles.headline}
          >
            {headline}
          </AppText>
          <View style={styles.facts}>
            <AppText variant="mono" color={palette.ink}>
              {todayDone}/{todayTotal} done · {active} open
            </AppText>
            {overdue > 0 ? (
              <View style={[styles.overdue, { borderColor: palette.ink }]}>
                <AppText
                  variant="label"
                  color={palette.card}
                  uppercase
                  style={styles.overdueText}
                >
                  {overdue} overdue
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <ProgressRing
          progress={progress}
          label={`${Math.round(progress * 100)}%`}
        />
      </View>

      {nextUp ? <DashedRule color={palette.ink} /> : null}
      {nextUp ? (
        <Pressable
          onPress={() => onOpenTask(nextUp)}
          accessibilityRole="button"
          accessibilityLabel={`Up next: ${nextUp.title}`}
          style={({ pressed }) => [
            styles.next,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={styles.nextBadge}>
            <Icon
              name="bolt"
              size={14}
              color={palette.lime}
              strokeWidth={2.6}
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="label" color={palette.inkSoft} uppercase>
              Up next
            </AppText>
            <AppText variant="bodyStrong" color={palette.ink} numberOfLines={1}>
              {nextUp.title}
            </AppText>
          </View>
          {nextUp.deadline ? (
            <AppText variant="mono" color={palette.ink}>
              {describeDeadline(new Date(nextUp.deadline), new Date(now)).text}
            </AppText>
          ) : null}
          <Icon name="chevronRight" size={18} color={palette.ink} />
        </Pressable>
      ) : null}
    </BrutalBox>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 6 },
  headline: { fontSize: 24, lineHeight: 28 },
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  overdue: {
    backgroundColor: palette.danger,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    height: 20,
    justifyContent: 'center',
  },
  overdueText: { fontSize: 10 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
