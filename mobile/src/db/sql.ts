/** Values SQLite stores for DoAll: text, numbers and NULL (booleans as 0/1). */
export type SqlValue = string | number | null;

export type Row = Record<string, unknown>;

export interface SqlExecutor {
  /** Runs one statement; resolves with the rows it returned (empty for writes). */
  execute(sql: string, params?: SqlValue[]): Promise<Row[]>;
}

/**
 * The little of SQLite the app needs. On the phone it's op-sqlite
 * (db/database.ts); tests use Node's built-in SQLite behind the same shape.
 */
export interface SqlDatabase extends SqlExecutor {
  /** Runs `work` in a transaction: everything is saved, or nothing if it throws. */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
