import { format, formatDistanceStrict } from 'date-fns';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScoreBreakdown } from '../components/tasks/ScoreBreakdown';
import { CategoryPill, PrioritySticker } from '../components/tasks/TaskBadges';
import {
  AppText,
  BrutalBox,
  Button,
  Icon,
  IconButton,
  Screen,
  SectionLabel,
  useConfirm,
  useToast,
} from '../components/ui';
import { describeOffset } from '../features/reminders/planner';
import { describeRule } from '../features/tasks/recurrence';
import { isOverdue, selectTaskById } from '../features/tasks/selectors';
import { deleteTask, restoreTask } from '../features/tasks/tasksSlice';
import { useNow } from '../hooks/useNow';
import { useToggleTask } from '../hooks/useToggleTask';
import { AppScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, useTheme } from '../theme';
import { describeDeadline, formatDateTime } from '../utils/dates';

function TimeCard({
  label,
  icon,
  primary,
  secondary,
  tone,
}: {
  label: string;
  icon: 'calendar' | 'flag';
  primary: string;
  secondary: string;
  tone?: string;
}) {
  const t = useTheme();
  return (
    <BrutalBox style={styles.flex} contentStyle={styles.timeCard} offset={3}>
      <View style={styles.timeLabel}>
        <Icon name={icon} size={14} color={t.colors.textMuted} />
        <AppText variant="label" color="textMuted" uppercase>
          {label}
        </AppText>
      </View>
      <AppText variant="bodyStrong">{primary}</AppText>
      <AppText variant="mono" color={tone ?? 'textMuted'}>
        {secondary}
      </AppText>
    </BrutalBox>
  );
}

export function TaskDetailScreen({
  navigation,
  route,
}: AppScreenProps<'TaskDetail'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const toast = useToast();
  const now = useNow();
  const toggleTask = useToggleTask({ announceReopen: true });
  const task = useAppSelector(state => selectTaskById(state, route.params.id));

  if (!task) {
    // Deleted elsewhere (e.g. swiped away) while this screen was open.
    return (
      <Screen>
        <View style={styles.missing}>
          <AppText variant="heading">This task is gone.</AppText>
          <Button
            title="Back to list"
            variant="outline"
            size="md"
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  const nowDate = new Date(now);
  const scheduled = new Date(task.scheduledAt);
  const overdue = isOverdue(task, now);
  const deadline = task.deadline
    ? describeDeadline(new Date(task.deadline), nowDate)
    : null;

  const toggle = () => toggleTask(task);

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: `“${task.title}” will be removed.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    navigation.goBack();
    dispatch(deleteTask(task))
      .unwrap()
      .then(() =>
        toast({
          message: 'Task deleted',
          action: { label: 'Undo', onPress: () => dispatch(restoreTask(task)) },
        }),
      )
      .catch((message: string) => toast({ message, tone: 'error' }));
  };

  const statusSticker = task.completed
    ? { label: 'Done', color: palette.lime }
    : overdue
    ? { label: 'Overdue', color: palette.danger }
    : { label: 'Open', color: palette.sky };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton
          icon="arrowLeft"
          label="Back"
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerActions}>
          <IconButton
            icon="edit"
            label="Edit task"
            onPress={() => navigation.navigate('TaskEditor', { id: task.id })}
          />
          <IconButton
            icon="trash"
            label="Delete task"
            color={palette.blush}
            onPress={remove}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
      >
        <View style={styles.stickers}>
          <View
            style={[
              styles.status,
              {
                backgroundColor: statusSticker.color,
                borderColor: t.colors.line,
              },
            ]}
          >
            <AppText
              variant="label"
              color={task.completed || !overdue ? palette.ink : palette.card}
              uppercase
            >
              {statusSticker.label}
            </AppText>
          </View>
          <PrioritySticker priority={task.priority} tilt={false} />
          <CategoryPill category={task.category} />
        </View>

        <AppText
          variant="title"
          style={[styles.title, task.completed && styles.struck]}
        >
          {task.title}
        </AppText>
        <AppText
          color={task.description ? 'text' : 'textFaint'}
          style={styles.description}
        >
          {task.description || 'No notes for this one.'}
        </AppText>

        {task.tags.length > 0 ? (
          <View style={styles.tags}>
            {task.tags.map(tag => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  {
                    borderColor: t.colors.line,
                    backgroundColor: t.colors.surfaceAlt,
                  },
                ]}
              >
                <AppText variant="mono">#{tag}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.times}>
          <TimeCard
            label="Scheduled"
            icon="calendar"
            primary={formatDateTime(scheduled, nowDate)}
            secondary={
              scheduled.getTime() > now
                ? `Starts in ${formatDistanceStrict(scheduled, nowDate)}`
                : `${formatDistanceStrict(scheduled, nowDate)} ago`
            }
          />
          <TimeCard
            label="Deadline"
            icon="flag"
            primary={
              task.deadline
                ? formatDateTime(new Date(task.deadline), nowDate)
                : 'None'
            }
            secondary={
              task.completed ? 'Completed' : deadline?.text ?? 'No pressure'
            }
            tone={
              overdue
                ? t.colors.danger
                : deadline?.tone === 'soon'
                ? t.colors.primary
                : undefined
            }
          />
        </View>

        {task.recurrence || task.reminderOffset !== null ? (
          <BrutalBox style={styles.extras} contentStyle={styles.extrasFace} offset={3}>
            {task.recurrence ? (
              <View style={styles.extraRow}>
                <Icon name="repeat" size={16} color={t.colors.text} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {describeRule(
                    task.recurrence,
                    Date.parse(task.scheduledAt),
                    task.timeZone,
                  )}
                </AppText>
              </View>
            ) : null}
            {task.reminderOffset !== null ? (
              <View style={styles.extraRow}>
                <Icon name="bell" size={16} color={t.colors.text} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {`Reminder: ${describeOffset(task.reminderOffset).toLowerCase()}`}
                </AppText>
              </View>
            ) : null}
          </BrutalBox>
        ) : null}

        {!task.completed ? (
          <View style={styles.section}>
            <SectionLabel>Why it's ranked here</SectionLabel>
            <ScoreBreakdown task={task} now={now} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>History</SectionLabel>
          <AppText variant="mono" color="textMuted">
            Created {format(new Date(task.createdAt), 'd MMM yyyy · h:mmaaa')}
          </AppText>
          {task.completedAt ? (
            <AppText
              variant="mono"
              color="textMuted"
              style={styles.historyLine}
            >
              Completed{' '}
              {format(new Date(task.completedAt), 'd MMM yyyy · h:mmaaa')}
            </AppText>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={
            task.completed
              ? 'Reopen task'
              : task.recurrence
              ? 'Done, move to next'
              : 'Mark as done'
          }
          icon={task.completed ? 'refresh' : 'check'}
          variant={task.completed ? 'outline' : 'highlight'}
          onPress={toggle}
          testID="task-toggle"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  content: { padding: 20, paddingTop: 12 },
  stickers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  status: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
  },
  title: { marginTop: 16 },
  struck: { textDecorationLine: 'line-through' },
  description: { marginTop: 10, fontSize: 16, lineHeight: 23 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  times: { flexDirection: 'row', gap: 10, marginTop: 24 },
  timeCard: { padding: 12, gap: 4 },
  timeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  section: { marginTop: 28 },
  extras: { marginTop: 12 },
  extrasFace: { padding: 12, gap: 8 },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyLine: { marginTop: 4 },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
