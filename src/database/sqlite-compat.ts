/**
 * SQLite compatibility helpers.
 *
 * The application's SQL is written for PostgreSQL (the production engine). When
 * running against SQLite (dev/test) a few dialect differences break the
 * queries, so we translate them before execution. Kept in its own side-effect
 * free module so it can be unit-tested without opening a database connection.
 */

/**
 * Translate a PostgreSQL-flavored SQL statement into SQLite-compatible SQL:
 *   - `ILIKE` -> `LIKE` (SQLite's `LIKE` is already case-insensitive for ASCII).
 *   - `$1`, `$2`, ... `$N` positional parameters -> `?` placeholders (parameters
 *     are passed positionally in both engines).
 *   - An unaliased `COUNT(*)` is returned by Postgres under the column name
 *     `count` but by SQLite as `count(*)`. Callers read `row.count`, so we alias
 *     unaliased aggregates to `count` to keep the column name stable.
 */
export function translateSqlForSqlite(sql: string): string {
  return sql
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\$\d+/g, '?')
    .replace(/COUNT\(\s*\*\s*\)(?!\s+AS\b)/gi, 'COUNT(*) AS count');
}
