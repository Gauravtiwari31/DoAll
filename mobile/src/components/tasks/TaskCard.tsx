import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Task } from '../../features/tasks/types';
import { palette, useTheme } from '../../theme';
import { describeDeadline, formatDateTime } from '../../utils/dates';
import { AppText } from '../ui/AppText';
import { BrutalPressable } from '../ui/Brutal';
import { Checkbox } from '../ui/Checkbox';
import { Icon } from '../ui/Icon';
import { CategoryPill, PrioritySticker } from './TaskBadges';

interface TaskCardProps {
  task: Task;
  now: number;
  onPress: (task: Task) => void;
  onToggle: (task: Task) => void;
  /** Highlights the task the smart sort recommends doing next. */
  upNext?: boolean;
  /** Position in the list, used to stagger the entrance animation. */
  index?: number;
}

function TaskCardComponent({
  task,
  now,
  onPress,
  onToggle,
  upNext,
  index = 0,
}: TaskCardProps) {
  const t = useTheme();
  const nowDate = new Date(now);
  const deadline = task.deadline
    ? describeDeadline(new Date(task.deadline), nowDate)
    : null;
  const overdue = !task.completed && deadline?.tone === 'overdue';

  // Gentle slide-up on first render, staggered for the first screenful.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 8) * 35,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  const deadlineColor =
    deadline?.tone === 'overdue'
      ? t.colors.danger
      : deadline?.tone === 'soon'
      ? t.colors.primary
      : t.colors.textMuted;

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      }}
    >
      <BrutalPressable
        onPress={() => onPress(task)}
        accessibilityLabel={`${task.title}${
          task.completed ? ', completed' : ''
        }`}
        color={task.completed ? t.colors.surfaceAlt : t.colors.surface}
        shadowColor={overdue ? t.colors.danger : undefined}
        offset={task.completed ? 2 : t.shadowOffset}
        contentStyle={styles.card}
      >
        {upNext && !task.completed ? (
          <View
            style={[
              styles.upNext,
              {
                backgroundColor: t.colors.highlight,
                borderColor: t.colors.line,
              },
            ]}
          >
            <Icon name="bolt" size={12} color={palette.ink} strokeWidth={2.6} />
            <AppText
              variant="label"
              color={palette.ink}
              uppercase
              style={styles.upNextText}
            >
              Up next
            </AppText>
          </View>
        ) : null}

        <View style={styles.row}>
          <Checkbox
            checked={task.completed}
            onToggle={() => onToggle(task)}
            label={
              task.completed
                ? `Mark "${task.title}" as not done`
                : `Mark "${task.title}" as done`
            }
          />

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <AppText
                variant="subheading"
                numberOfLines={2}
                color={task.completed ? 'textMuted' : 'text'}
                style={[styles.title, task.completed && styles.struck]}
              >
                {task.title}
              </AppText>
              {!task.completed ? (
                <PrioritySticker priority={task.priority} />
              ) : null}
            </View>

            {task.description ? (
              <AppText
                variant="caption"
                color="textMuted"
                numberOfLines={1}
                style={styles.description}
              >
                {task.description}
              </AppText>
            ) : null}

            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Icon
                  name="clock"
                  size={13}
                  color={t.colors.textMuted}
                  strokeWidth={2.4}
                />
                <AppText variant="mono" color="textMuted">
                  {formatDateTime(new Date(task.scheduledAt), nowDate)}
                </AppText>
                {task.recurrence ? (
                  <Icon
                    name="repeat"
                    size={13}
                    color={t.colors.textMuted}
                    strokeWidth={2.4}
                  />
                ) : null}
                {task.reminderOffset !== null && !task.completed ? (
                  <Icon
                    name="bell"
                    size={13}
                    color={t.colors.textMuted}
                    strokeWidth={2.4}
                  />
                ) : null}
              </View>
              {deadline && !task.completed ? (
                <View style={styles.metaItem}>
                  <Icon
                    name={overdue ? 'alert' : 'flag'}
                    size={13}
                    color={deadlineColor}
                    strokeWidth={2.4}
                  />
                  <AppText variant="mono" color={deadlineColor}>
                    {deadline.text}
                  </AppText>
                </View>
              ) : null}
            </View>

            <View style={styles.tags}>
              <CategoryPill category={task.category} />
              {task.tags.slice(0, 3).map(tag => (
                <AppText key={tag} variant="mono" color="textFaint">
                  #{tag}
                </AppText>
              ))}
            </View>
          </View>
        </View>
      </BrutalPressable>
    </Animated.View>
  );
}

/** Memoised: re-renders only when its own task (or the minute) changes. */
export const TaskCard = memo(TaskCardComponent);

const styles = StyleSheet.create({
  card: { padding: 14, paddingTop: 16 },
  row: { flexDirection: 'row', gap: 12 },
  body: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, marginTop: 3 },
  struck: { textDecorationLine: 'line-through' },
  description: { marginTop: -2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  upNext: {
    position: 'absolute',
    top: -12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
  },
  upNextText: { fontSize: 10 },
});
