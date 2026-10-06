import { usePreventRemove } from '@react-navigation/native';
import { addMinutes, startOfMinute } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField } from '../components/tasks/DateTimeField';
import { ReminderRepeatFields } from '../components/tasks/ReminderRepeatFields';
import { TagInput } from '../components/tasks/TagInput';
import {
  AppText,
  Button,
  Chip,
  IconButton,
  Screen,
  SectionLabel,
  Segmented,
  TextField,
  useConfirm,
  useToast,
} from '../components/ui';
import { selectTaskById } from '../features/tasks/selectors';
import { CATEGORY_META, PRIORITY_META } from '../features/tasks/taskMeta';
import { retargetRule } from '../features/tasks/recurrence';
import { createTask, updateTask } from '../features/tasks/tasksSlice';
import {
  CATEGORIES,
  Category,
  PRIORITIES,
  Priority,
  Recurrence,
  Task,
  TaskInput,
} from '../features/tasks/types';
import { TaskFormErrors, validateTask } from '../features/tasks/validation';
import { AppScreenProps } from '../navigation/types';
import { device } from '../services/device';
import { reminders } from '../services/reminders';
import { STORAGE_KEYS, storage } from '../services/storage';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fonts, useTheme } from '../theme';
import { DEADLINE_PRESETS, SCHEDULE_PRESETS } from '../utils/dates';

interface FormState {
  title: string;
  description: string;
  scheduledAt: Date;
  deadline: Date | null;
  priority: Priority;
  category: Category;
  tags: string[];
  reminderOffset: number | null;
  recurrence: Recurrence | null;
}

/** New tasks start at the next half hour, medium priority, no deadline. */
function defaults(): FormState {
  const now = startOfMinute(new Date());
  const next = addMinutes(now, 30 - (now.getMinutes() % 30));
  return {
    title: '',
    description: '',
    scheduledAt: next,
    deadline: null,
    priority: 'medium',
    category: 'personal',
    tags: [],
    reminderOffset: null,
    recurrence: null,
  };
}

const fromTask = (task: Task): FormState => ({
  title: task.title,
  description: task.description,
  scheduledAt: new Date(task.scheduledAt),
  deadline: task.deadline ? new Date(task.deadline) : null,
  priority: task.priority,
  category: task.category,
  tags: task.tags,
  reminderOffset: task.reminderOffset,
  recurrence: task.recurrence,
});

const toInput = (form: FormState): TaskInput => ({
  title: form.title.trim(),
  description: form.description.trim(),
  scheduledAt: form.scheduledAt.toISOString(),
  deadline: form.deadline ? form.deadline.toISOString() : null,
  priority: form.priority,
  category: form.category,
  tags: form.tags,
  reminderOffset: form.reminderOffset,
  recurrence: form.recurrence,
});

export function TaskEditorScreen({
  navigation,
  route,
}: AppScreenProps<'TaskEditor'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const confirm = useConfirm();
  const id = route.params?.id;
  const existing = useAppSelector(state =>
    id ? selectTaskById(state, id) : undefined,
  );

  // Snapshot taken once: later store updates must not overwrite the user's edits.
  const [initial] = useState(() =>
    existing ? fromTask(existing) : defaults(),
  );
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    JSON.stringify(toInput(form)) !== JSON.stringify(toInput(initial));

  // Ask before throwing away edits (close button, back gesture or hardware back).
  usePreventRemove(dirty && !saved, ({ data }) => {
    confirm({
      title: 'Discard changes?',
      message: 'Your edits to this task will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    }).then(ok => ok && navigation.dispatch(data.action));
  });

  // Leave only after the re-render that lifts the discard guard.
  useEffect(() => {
    if (saved) {
      navigation.goBack();
    }
  }, [saved, navigation]);

  // Repeats are planned on this phone's clock (see updateTask).
  const [timeZone] = useState(device.timeZone);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // "Monthly on the 31st" follows the task to its new day.
      if (key === 'scheduledAt' && next.recurrence) {
        next.recurrence = retargetRule(
          next.recurrence,
          next.scheduledAt.getTime(),
          timeZone,
        );
      }
      return next;
    });
    if (key === 'title' || key === 'deadline' || key === 'scheduledAt') {
      setErrors(prev => ({
        ...prev,
        title: key === 'title' ? undefined : prev.title,
        deadline: undefined,
      }));
    }
  };

  /** Turning a reminder on is when DoAll asks to show notifications. */
  const setReminder = async (offset: number | null) => {
    set('reminderOffset', offset);
    if (offset === null || !reminders.isAvailable()) {
      return;
    }
    if (!(await reminders.requestPermission())) {
      toast({
        message: 'Notifications are off for DoAll, so reminders stay silent.',
        tone: 'error',
        action: {
          label: 'Settings',
          onPress: () => reminders.openSettings('notifications'),
        },
      });
      return;
    }
    // Android 14+ doesn't allow on-time alarms by default; ask once.
    const status = await reminders.status();
    if (
      status &&
      !status.exactAlarmsAllowed &&
      !(await storage.get<boolean>(STORAGE_KEYS.exactAlarmAsked))
    ) {
      await storage.set(STORAGE_KEYS.exactAlarmAsked, true);
      const ok = await confirm({
        title: 'Allow on-time reminders?',
        message:
          'Without "Alarms & reminders", Android can deliver reminders late, especially while the phone is asleep or offline. Turn it on for DoAll on the next screen.',
        confirmLabel: 'Allow',
        cancelLabel: 'Not now',
      });
      if (ok) {
        reminders.openSettings('exactAlarms');
      }
    }
  };

  const save = async () => {
    const input = toInput(form);
    const found = validateTask(input);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    setSaving(true);
    try {
      if (id) {
        await dispatch(updateTask({ id, changes: input })).unwrap();
        toast({ message: 'Changes saved', tone: 'success' });
      } else {
        await dispatch(createTask(input)).unwrap();
        toast({ message: 'Task added', tone: 'success' });
      }
      setSaved(true);
    } catch (message) {
      toast({ message: String(message), tone: 'error' });
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.header}>
          <IconButton
            icon="x"
            label="Close"
            onPress={() => navigation.goBack()}
          />
          <AppText variant="label" uppercase color="textMuted">
            {id ? 'Edit task' : 'New task'}
          </AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <TextInput
              value={form.title}
              onChangeText={text => set('title', text)}
              placeholder="What needs doing?"
              placeholderTextColor={t.colors.textFaint}
              selectionColor={t.colors.primary}
              cursorColor={t.colors.text}
              autoFocus={!id}
              maxLength={120}
              multiline
              submitBehavior="blurAndSubmit"
              style={[
                styles.titleInput,
                {
                  color: t.colors.text,
                  borderBottomColor: errors.title
                    ? t.colors.danger
                    : t.colors.line,
                },
              ]}
              accessibilityLabel="Task title"
              testID="task-title"
            />
            {errors.title ? (
              <AppText variant="mono" color="danger" style={styles.error}>
                {errors.title}
              </AppText>
            ) : null}
          </View>

          <TextField
            label="Notes"
            icon="note"
            value={form.description}
            onChangeText={text => set('description', text)}
            placeholder="Details, links, sub-steps…"
            multiline
            maxLength={1000}
          />

          <View>
            <SectionLabel>When will you do it</SectionLabel>
            <DateTimeField
              value={form.scheduledAt}
              onChange={value => value && set('scheduledAt', value)}
              presets={SCHEDULE_PRESETS}
              icon="calendar"
              placeholder="Pick a time"
            />
          </View>

          <View>
            <SectionLabel>Deadline</SectionLabel>
            <DateTimeField
              value={form.deadline}
              onChange={value => set('deadline', value)}
              presets={DEADLINE_PRESETS}
              icon="flag"
              placeholder="No deadline"
              clearable
              minimumDate={form.scheduledAt}
              error={errors.deadline}
            />
          </View>

          <ReminderRepeatFields
            reminderOffset={form.reminderOffset}
            onReminderChange={setReminder}
            recurrence={form.recurrence}
            onRecurrenceChange={rule => set('recurrence', rule)}
            scheduledAt={form.scheduledAt}
            timeZone={timeZone}
          />

          <View>
            <SectionLabel>Priority</SectionLabel>
            <Segmented
              value={form.priority}
              onChange={value => set('priority', value)}
              options={PRIORITIES.map(p => ({
                value: p,
                label: PRIORITY_META[p].label,
                color: PRIORITY_META[p].color,
              }))}
            />
          </View>

          <View>
            <SectionLabel>Category</SectionLabel>
            <View style={styles.wrap}>
              {CATEGORIES.map(c => (
                <Chip
                  key={c}
                  label={CATEGORY_META[c].label}
                  dot={CATEGORY_META[c].color}
                  color={CATEGORY_META[c].color}
                  selected={form.category === c}
                  onPress={() => set('category', c)}
                />
              ))}
            </View>
          </View>

          <View>
            <SectionLabel>Tags</SectionLabel>
            <TagInput tags={form.tags} onChange={tags => set('tags', tags)} />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 14,
              borderTopColor: t.colors.line,
              backgroundColor: t.colors.background,
            },
          ]}
        >
          <Button
            title={id ? 'Save changes' : 'Add task'}
            icon={id ? 'check' : 'plus'}
            onPress={save}
            loading={saving}
            testID="task-save"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerSpacer: { width: 47 },
  content: { padding: 20, paddingTop: 8, gap: 26 },
  titleInput: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 2,
  },
  error: { marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 2 },
});
