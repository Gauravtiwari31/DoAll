import { CATEGORY_META, PRIORITY_META } from '@app/features/tasks/taskMeta';
import { describeRule } from '@app/features/tasks/recurrence';
import { deadlineTone, formatRelative, formatWhen } from '../format';
import type { Task } from '../types';
import { Icon } from './Icon';

const REMINDER_LABEL = (minutes: number) =>
  minutes === 0
    ? 'At the time'
    : minutes < 60
      ? `${minutes} min before`
      : minutes < 1440
        ? `${minutes / 60} h before`
        : `${minutes / 1440} d before`;

interface Props {
  task: Task;
  now: number;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskItem({ task, now, onToggle, onEdit, onDelete }: Props) {
  const priority = PRIORITY_META[task.priority];
  const category = CATEGORY_META[task.category];
  const tone = task.deadline && !task.completed ? deadlineTone(task.deadline, now) : null;

  return (
    <li className={`task${task.completed ? ' task-done' : ''}${tone === 'overdue' ? ' task-overdue' : ''}`}>
      <button
        type="button"
        className="check"
        aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        aria-pressed={task.completed}
        onClick={() => onToggle(task)}
      >
        {task.completed && <Icon name="check" size={16} />}
      </button>

      <button type="button" className="task-body" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        {task.description && <span className="task-description">{task.description}</span>}
        <span className="task-meta">
          <span className="meta">
            <Icon name="clock" size={14} />
            {formatWhen(task.scheduledAt, now)}
          </span>
          {task.deadline && (
            <span className={`meta deadline deadline-${tone ?? 'later'}`}>
              <Icon name="flag" size={14} />
              {tone === 'overdue'
                ? `Overdue ${formatRelative(task.deadline, now).replace(' ago', '')}`
                : `Due ${formatRelative(task.deadline, now)}`}
            </span>
          )}
          {task.recurrence && (
            <span className="meta">
              <Icon name="repeat" size={14} />
              {describeRule(task.recurrence, Date.parse(task.scheduledAt), task.timeZone)}
            </span>
          )}
          {task.reminderOffset !== null && (
            <span className="meta" title="Rings on your phone">
              <Icon name="bell" size={14} />
              {REMINDER_LABEL(task.reminderOffset)}
            </span>
          )}
        </span>
        <span className="chips">
          <span className="chip" style={{ background: priority.color }}>
            {priority.label}
          </span>
          <span className="chip" style={{ background: category.color }}>
            {category.label}
          </span>
          {task.tags.map(tag => (
            <span key={tag} className="chip chip-tag">
              #{tag}
            </span>
          ))}
        </span>
      </button>

      <button
        type="button"
        className="icon-button task-delete"
        aria-label={`Delete "${task.title}"`}
        onClick={() => onDelete(task)}
      >
        <Icon name="trash" size={17} />
      </button>
    </li>
  );
}
