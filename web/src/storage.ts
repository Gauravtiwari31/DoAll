/**
 * localStorage, which can be missing or throw (private windows, blocked site
 * data, a full quota). Then values live in memory for this visit instead.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    get: key => values.get(key) ?? null,
    set: (key, value) => void values.set(key, value),
    remove: key => void values.delete(key),
  };
}

function createBrowserStorage(): KeyValueStorage {
  const fallback = createMemoryStorage();
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key) ?? fallback.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        fallback.set(key, value);
      }
    },
    remove(key) {
      fallback.remove(key);
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing stored there anyway.
      }
    },
  };
}

export const storage: KeyValueStorage =
  typeof window === 'undefined' ? createMemoryStorage() : createBrowserStorage();

export const STORAGE_KEYS = {
  session: 'doall.web.session.v1',
  tasks: 'doall.web.tasks.v1',
  focusUnlocked: 'doall.web.focus.v1',
  sort: 'doall.web.sort.v1',
} as const;

export function readJson<T>(key: string): T | null {
  const raw = storage.get(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
