import { migrate } from '../db/migrations';
import { Row, SqlDatabase, SqlExecutor, SqlValue } from '../db/sql';

/** The parts of Node's built-in `node:sqlite` used here. */
interface NodeSqlite {
  DatabaseSync: new (path: string) => {
    prepare(sql: string): {
      /** Runs any statement; writes return no rows. */
      all(...params: SqlValue[]): Row[];
    };
    exec(sql: string): void;
  };
}

declare const process: {
  getBuiltinModule(name: string): unknown;
  emitWarning: (...args: unknown[]) => void;
};

/**
 * A fresh in-memory SQLite database with the app's schema, backed by Node's
 * built-in SQLite, so tests run the app's real SQL. (getBuiltinModule loads
 * it past Jest's module system, which doesn't know `node:` only modules.)
 */
export async function createTestDatabase(): Promise<SqlDatabase> {
  // node:sqlite prints an "experimental" warning on first load; keep test output clean.
  const emitWarning = process.emitWarning;
  process.emitWarning = () => {};
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as NodeSqlite;
  process.emitWarning = emitWarning;

  const db = new DatabaseSync(':memory:');
  const executor: SqlExecutor = {
    // Plain objects, like op-sqlite's rows (node:sqlite's have a null prototype).
    execute: async (sql, params = []) =>
      db
        .prepare(sql)
        .all(...params)
        .map(row => ({ ...row })),
  };
  // One connection, used by one test at a time: a plain BEGIN/COMMIT is enough.
  const database: SqlDatabase = {
    ...executor,
    async transaction(work) {
      db.exec('BEGIN');
      try {
        const result = await work(executor);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  await migrate(database);
  return database;
}
