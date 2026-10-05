import { SqlDatabase } from './sql';

/**
 * The on-device schema, as numbered steps. The database remembers how many it
 * has run (PRAGMA user_version), and new steps run on the next start. Never
 * edit a step that has shipped: add a new one.
 */
export const MIGRATIONS: string[][] = [
  // 1: tasks, and key-value sync state.
  [
    `CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      scheduled_at INTEGER NOT NULL,
      deadline INTEGER,
      priority TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      reminder_offset INTEGER,
      recurrence TEXT,
      time_zone TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      dirty INTEGER NOT NULL DEFAULT 0
    )`,
    'CREATE INDEX tasks_dirty ON tasks (dirty) WHERE dirty = 1',
    'CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)',
  ],
];

/** Brings the schema up to date. Each step runs in its own transaction. */
export async function migrate(db: SqlDatabase): Promise<void> {
  const [row] = await db.execute('PRAGMA user_version');
  const current = Number(row?.user_version ?? 0);
  for (let version = current + 1; version <= MIGRATIONS.length; version++) {
    await db.transaction(async tx => {
      for (const statement of MIGRATIONS[version - 1]) {
        await tx.execute(statement);
      }
      // PRAGMA can't take parameters; `version` is a trusted number.
      await tx.execute(`PRAGMA user_version = ${version}`);
    });
  }
}
