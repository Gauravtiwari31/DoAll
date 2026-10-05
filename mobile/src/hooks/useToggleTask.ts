import { useCallback } from 'react';
import { useToast } from '../components/ui';
import { setTaskCompleted, updateTask } from '../features/tasks/tasksSlice';
import { Task } from '../features/tasks/types';
import { useAppDispatch } from '../store/hooks';
import { formatDateTime } from '../utils/dates';
import { tick } from '../utils/haptics';

/**
 * Ticks a task off (or back on) with the matching toast and Undo. A repeating
 * task moves on to its next time instead; Undo puts it back.
 * `announceReopen` also confirms un-ticking with a toast.
 */
export function useToggleTask({ announceReopen = false } = {}) {
  const dispatch = useAppDispatch();
  const toast = useToast();

  return useCallback(
    (task: Task) => {
      const completed = !task.completed;
      if (completed) {
        tick();
      }
      dispatch(setTaskCompleted({ task, completed }))
        .unwrap()
        .then(updated => {
          if (completed && !updated.completed) {
            toast({
              message: `Done. Next: ${formatDateTime(
                new Date(updated.scheduledAt),
              )}`,
              tone: 'success',
              action: {
                label: 'Undo',
                onPress: () =>
                  dispatch(
                    updateTask({
                      id: task.id,
                      changes: {
                        scheduledAt: task.scheduledAt,
                        deadline: task.deadline,
                      },
                    }),
                  ),
              },
            });
          } else if (completed) {
            toast({
              message: 'Done and dusted.',
              tone: 'success',
              action: {
                label: 'Undo',
                onPress: () =>
                  dispatch(
                    setTaskCompleted({
                      task: { ...task, completed: true },
                      completed: false,
                    }),
                  ),
              },
            });
          } else if (announceReopen) {
            toast({ message: 'Task reopened', tone: 'success' });
          }
        })
        .catch((message: string) => toast({ message, tone: 'error' }));
    },
    [announceReopen, dispatch, toast],
  );
}
