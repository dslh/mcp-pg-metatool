/**
 * Augments PostgreSQL errors with hints that help the agent self-recover
 * without a round-trip. Keyed off SQLSTATE codes (stable across PG versions)
 * rather than message parsing.
 */

const PG_INSUFFICIENT_PRIVILEGE = '42501';

const COLUMN_PRIVILEGE_HINT =
  '\n\nHint: the database user lacks SELECT privilege on a column in this query. ' +
  'PostgreSQL rejects `SELECT *` whenever any column in the table is inaccessible. ' +
  'Call `describe_table` to see which columns are available, then retry with an ' +
  'explicit column list.';

export function augmentSqlError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  const pgError = error as Error & { code?: unknown };
  if (pgError.code === PG_INSUFFICIENT_PRIVILEGE) {
    const augmented = new Error(error.message + COLUMN_PRIVILEGE_HINT);
    if (error.stack !== undefined) {
      augmented.stack = error.stack;
    }
    return augmented;
  }

  return error;
}
