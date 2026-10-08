import { CATEGORY_META, PRIORITY_META } from '@app/features/tasks/taskMeta';
import { defaultRule, describeRule, FREQUENCIES, retargetRule, type Frequency } from '@app/features/tasks/recurrence';
import { CATEGORIES, PRIORITIES } from '@app/features/tasks/types';
import { normalizeTag, validateTask, type TaskFormErrors } from '@app/features/tasks/validation';
import { deviceTimeZone } from '@app/utils/timezone';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fromLocalInput, toLocalInput } from '../format';
import type { Recurrence, Task, TaskInput } from '../types';
import { Icon } from './Icon';

const REMINDERS: { label: string; value: number | null }[] = [
  { label: 'No reminder', value: null },
  { label: 'At the time', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
];

const FREQUENCY_LABEL: Record<Frequency, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The next full hour: a sensible "when" for a new task. */
function nextHour(): string {
  const at = new Date();
  at.setHours(at.getHours() + 1, 0, 0, 0);
  return at.toISOString();
}

const blank = (): TaskInput => ({
  title: '',
  description: '',
  scheduledAt: nextHour(),
  deadline: null,
  priority: 'medium',
  category: 'personal',
  tags: [],
  reminderOffset: null,
  recurrence: null,
});

const toInput = (task: Task): TaskInput => ({
  title: task.title,
  description: task.description,
  scheduledAt: task.scheduledAt,
  deadline: task.deadline,
  priority: task.priority,
  category: task.category,
  tags: task.tags,
  reminderOffset: task.reminderOffset,
  recurrence: task.recurrence,
});

interface Props {
  /** The task being edited, or null for a new one. */
  task: Task | null;
  onSave: (input: TaskInput) => void;
  onDelete?: (task: Task) => void;
  onClose: () => void;
}

export function TaskEditor({ task, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<TaskInput>(() => (task ? toInput(task) : blank()));
  const [tagText, setTagText] = useState(() => (task ? task.tags.map(t => `#${t}`).join(' ') : ''));
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const zone = task?.timeZone ?? deviceTimeZone();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const setScheduled = (value: string) => {
    const scheduledAt = fromLocalInput(value);
    if (!scheduledAt) return;
    setForm(current => ({
      ...current,
      scheduledAt,
      recurrence: current.recurrence
        ? retargetRule(current.recurrence, Date.parse(scheduledAt), deviceTimeZone())
        : null,
    }));
  };

  const setFrequency = (value: string) => {
    if (value === 'none') {
      set('recurrence', null);
      return;
    }
    const rule = defaultRule(value as Frequency, Date.parse(form.scheduledAt), deviceTimeZone());
    set('recurrence', { ...rule, interval: form.recurrence?.interval ?? 1 });
  };

  const setRule = (changes: Partial<Recurrence>) =>
    setForm(current => ({
      ...current,
      recurrence: current.recurrence ? { ...current.recurrence, ...changes } : null,
    }));

  const toggleWeekday = (day: number) => {
    const days = form.recurrence?.byWeekday ?? [];
    const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    // At least one day: an empty list would mean "the scheduled day" anyway.
    if (next.length > 0) setRule({ byWeekday: next });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const tags = [
      ...new Set(
        tagText
          .split(/[\s,]+/)
          .map(normalizeTag)
          .filter((tag): tag is string => tag !== null),
      ),
    ];
    const input: TaskInput = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      tags,
    };
    const problems = validateTask(input);
    setErrors(problems);
    if (Object.keys(problems).length === 0) {
      onSave(input);
    }
  };

  const rule = form.recurrence;

  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => event.target === dialog.current && onClose()}
    >
      <form onSubmit={submit} className="editor-form" noValidate>
        <header className="editor-header">
          <h2 id="editor-title">{task ? 'Edit task' : 'New task'}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        <label className="field">
          <span>Title</span>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            maxLength={120}
            placeholder="What needs doing?"
            autoFocus
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title && <small className="field-error">{errors.title}</small>}
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Optional"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>When</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.scheduledAt)}
              onChange={e => setScheduled(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.deadline)}
              onChange={e => set('deadline', fromLocalInput(e.target.value))}
              aria-invalid={Boolean(errors.deadline)}
            />
            {errors.deadline && <small className="field-error">{errors.deadline}</small>}
          </label>
        </div>

        <fieldset className="field">
          <legend>Priority</legend>
          <div className="segmented">
            {PRIORITIES.map(priority => (
              <label key={priority} className="segment">
                <input
                  type="radio"
                  name="priority"
                  checked={form.priority === priority}
                  onChange={() => set('priority', priority)}
                />
                <span style={{ ['--chip' as string]: PRIORITY_META[priority].color }}>
                  {PRIORITY_META[priority].label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={e => set('category', e.target.value as TaskInput['category'])}>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {CATEGORY_META[category].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reminder</span>
            <select
              value={form.reminderOffset ?? 'none'}
              onChange={e => set('reminderOffset', e.target.value === 'none' ? null : Number(e.target.value))}
            >
              {REMINDERS.map(({ label, value }) => (
                <option key={label} value={value ?? 'none'}>
                  {label}
                </option>
              ))}
              {form.reminderOffset !== null && !REMINDERS.some(r => r.value === form.reminderOffset) && (
                <option value={form.reminderOffset}>{form.reminderOffset} minutes before</option>
              )}
            </select>
            {form.reminderOffset !== null && <small>Rings on your phone, in the DoAll app.</small>}
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Repeat</span>
            <select value={rule?.freq ?? 'none'} onChange={e => setFrequency(e.target.value)}>
              <option value="none">Doesn't repeat</option>
              {FREQUENCIES.map(freq => (
                <option key={freq} value={freq}>
                  {FREQUENCY_LABEL[freq]}
                </option>
              ))}
            </select>
          </label>
          {rule && (
            <label className="field">
              <span>Every</span>
              <input
                type="number"
                min={1}
                max={999}
                value={rule.interval}
                onChange={e => setRule({ interval: Math.min(999, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
              />
            </label>
          )}
        </div>
        {rule?.freq === 'weekly' && (
          <div className="weekdays" role="group" aria-label="On these days">
            {WEEKDAYS.map((letter, day) => (
              <button
                key={day}
                type="button"
                className={rule.byWeekday.includes(day) ? 'weekday active' : 'weekday'}
                aria-pressed={rule.byWeekday.includes(day)}
                aria-label={WEEKDAY_NAMES[day]}
                onClick={() => toggleWeekday(day)}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
        {rule && <p className="hint">{describeRule(rule, Date.parse(form.scheduledAt), zone)}</p>}

        <label className="field">
          <span>Tags</span>
          <input
            value={tagText}
            onChange={e => setTagText(e.target.value)}
            placeholder="#home #errands"
            aria-invalid={Boolean(errors.tags)}
          />
          {errors.tags ? <small className="field-error">{errors.tags}</small> : <small>Up to 5.</small>}
        </label>

        <footer className="editor-footer">
          {task && onDelete && (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(task)}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-signal">
            {task ? 'Save' : 'Add task'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
