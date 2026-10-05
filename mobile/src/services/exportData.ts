import { format } from 'date-fns';
import type { User } from '../api/authApi';
import { APP_VERSION } from '../config';
import { getTaskStore } from '../db';
import { device } from './device';

/** Bumped if the file's shape ever changes, so it can still be read. */
const EXPORT_FORMAT = 1;

/**
 * Saves a copy of all the user's tasks as a JSON file wherever they choose
 * (Downloads, Drive...). A safety net that doesn't depend on the server: it
 * is made from the phone's own database, including changes not yet synced.
 * Resolves false if they backed out of choosing a place.
 */
export async function exportData(user: User | null): Promise<boolean> {
  const tasks = await (await getTaskStore()).all();
  const contents = JSON.stringify(
    {
      format: EXPORT_FORMAT,
      app: `DoAll ${APP_VERSION}`,
      exportedAt: new Date().toISOString(),
      account: user ? { name: user.name, email: user.email } : null,
      tasks,
    },
    null,
    2,
  );
  return device.saveTextFile(
    `doall-tasks-${format(new Date(), 'yyyy-MM-dd')}.json`,
    'application/json',
    contents,
  );
}
