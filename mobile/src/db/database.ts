import { open } from '@op-engineering/op-sqlite';
import { migrate } from './migrations';
import { SqlDatabase, SqlExecutor, SqlValue } from './sql';

const FILE_NAME = 'doall.sqlite';

type OpExecutor = {
  execute: (
    sql: string,
    params?: SqlValue[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

const wrap = (executor: OpExecutor): SqlExecutor => ({
  execute: async (sql, params) => (await executor.execute(sql, params)).rows,
});

let ready: Promise<SqlDatabase> | null = null;

/**
 * The app's SQLite database (in its private storage, excluded from backups
 * like the rest), opened and migrated on first use. Tasks live here first:
 * the server is a copy for backup and sync.
 */
export function getDatabase(): Promise<SqlDatabase> {
  if (!ready) {
    ready = (async () => {
      const db = open({ name: FILE_NAME });
      const database: SqlDatabase = {
        ...wrap(db),
        async transaction(work) {
          let result: Awaited<ReturnType<typeof work>> | undefined;
          await db.transaction(async tx => {
            result = await work(wrap(tx));
          });
          return result as Awaited<ReturnType<typeof work>>;
        },
      };
      await migrate(database);
      return database;
    })();
    // A failed open is retried next time instead of failing forever.
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}
