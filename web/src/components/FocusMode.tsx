import { sortTasks } from '@app/features/tasks/ordering';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../types';
import { Icon } from './Icon';

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;

type Phase = 'focus' | 'break';

const clock = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/** A short two-note chime, without an audio file. */
function chime() {
  try {
    const audio = new AudioContext();
    [660, 880].forEach((frequency, i) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0.2, audio.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + i * 0.25 + 0.6);
      tone.connect(gain).connect(audio.destination);
      tone.start(audio.currentTime + i * 0.25);
      tone.stop(audio.currentTime + i * 0.25 + 0.6);
    });
    setTimeout(() => void audio.close(), 1500);
  } catch {
    // No sound available: the screen still shows the change.
  }
}

interface Props {
  tasks: Task[];
  onComplete: (task: Task) => void;
  onClose: () => void;
}

/**
 * The secret Focus mode (see useSecret): one task, chosen by DoAll's smart
 * order, and a 25-minute focus timer with 5-minute breaks.
 */
export function FocusMode({ tasks, onComplete, onClose }: Props) {
  const queue = useMemo(() => sortTasks(tasks.filter(t => !t.completed), 'smart'), [tasks]);
  const [taskId, setTaskId] = useState<string | null>(() => queue[0]?.id ?? null);
  const task = queue.find(t => t.id === taskId) ?? queue[0] ?? null;

  const [phase, setPhase] = useState<Phase>('focus');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(FOCUS_MS);
  const [rounds, setRounds] = useState(0);
  const pageTitle = useRef(document.title);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = setInterval(() => {
      const remaining = endsAt - Date.now();
      if (remaining > 0) {
        setLeft(remaining);
        return;
      }
      chime();
      setEndsAt(null);
      if (phase === 'focus') {
        setRounds(r => r + 1);
        setPhase('break');
        setLeft(BREAK_MS);
      } else {
        setPhase('focus');
        setLeft(FOCUS_MS);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [endsAt, phase]);

  useEffect(() => {
    const original = pageTitle.current;
    document.title = endsAt ? `${clock(left)} · ${phase === 'focus' ? 'Focus' : 'Break'} · DoAll` : original;
    return () => {
      document.title = original;
    };
  }, [endsAt, left, phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const running = endsAt !== null;
  const total = phase === 'focus' ? FOCUS_MS : BREAK_MS;

  const start = () => setEndsAt(Date.now() + left);
  const pause = () => {
    setLeft(endsAt! - Date.now());
    setEndsAt(null);
  };
  const reset = () => {
    setEndsAt(null);
    setLeft(total);
  };

  return (
    <div className="focus" role="dialog" aria-modal="true" aria-labelledby="focus-title">
      <button type="button" className="icon-button focus-close" aria-label="Leave focus mode" onClick={onClose}>
        <Icon name="close" />
      </button>
      <p className="eyebrow">
        <Icon name="target" size={16} /> Focus mode{rounds > 0 && ` · ${rounds} round${rounds === 1 ? '' : 's'}`}
      </p>

      {task ? (
        <>
          <h2 id="focus-title" className="focus-task">
            {task.title}
          </h2>
          {queue.length > 1 && (
            <label className="focus-pick">
              <span className="sr-only">Focus on</span>
              <select value={task.id} onChange={e => setTaskId(e.target.value)}>
                {queue.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      ) : (
        <h2 id="focus-title" className="focus-task">
          Nothing left to do. Enjoy it.
        </h2>
      )}

      <div
        className={`focus-clock focus-${phase}`}
        style={{ ['--progress' as string]: `${(1 - left / total) * 360}deg` }}
      >
        <span className="focus-time">{clock(left)}</span>
        <span className="focus-phase">{phase === 'focus' ? 'Focus' : 'Break'}</span>
      </div>

      <div className="focus-controls">
        <button type="button" className="icon-button" aria-label="Restart the timer" onClick={reset}>
          <Icon name="reset" />
        </button>
        <button type="button" className="btn btn-signal btn-big" onClick={running ? pause : start}>
          <Icon name={running ? 'pause' : 'play'} /> {running ? 'Pause' : 'Start'}
        </button>
        {task && (
          <button
            type="button"
            className="btn btn-ink"
            onClick={() => {
              onComplete(task);
              setTaskId(null);
            }}
          >
            <Icon name="check" /> Done
          </button>
        )}
      </div>
      <p className="hint">Esc to leave. The timer keeps going in the tab's title.</p>
    </div>
  );
}
