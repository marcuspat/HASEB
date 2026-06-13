import { describe, it, expect } from '@jest/globals';
import { translateSqlForSqlite } from '@/database/sqlite-compat';

describe('translateSqlForSqlite', () => {
  it('rewrites ILIKE to LIKE (case-insensitive)', () => {
    expect(translateSqlForSqlite('SELECT * FROM agents WHERE name ILIKE $1')).toBe(
      'SELECT * FROM agents WHERE name LIKE ?'
    );
    expect(translateSqlForSqlite('WHERE x ilike $1')).toBe('WHERE x LIKE ?');
  });

  it('rewrites numbered $N parameters to ? placeholders', () => {
    expect(
      translateSqlForSqlite('INSERT INTO users (a, b, c) VALUES ($1, $2, $3)')
    ).toBe('INSERT INTO users (a, b, c) VALUES (?, ?, ?)');
    expect(translateSqlForSqlite('WHERE id = $10 AND y = $2')).toBe('WHERE id = ? AND y = ?');
  });

  it('aliases an unaliased COUNT(*) to "count"', () => {
    expect(translateSqlForSqlite('SELECT COUNT(*) FROM users')).toBe(
      'SELECT COUNT(*) AS count FROM users'
    );
    expect(translateSqlForSqlite('SELECT count(*) FROM users')).toBe(
      'SELECT COUNT(*) AS count FROM users'
    );
  });

  it('leaves an already-aliased COUNT(*) untouched', () => {
    expect(translateSqlForSqlite('SELECT COUNT(*) AS total FROM users')).toBe(
      'SELECT COUNT(*) AS total FROM users'
    );
  });

  it('applies all translations together', () => {
    const pg = 'SELECT COUNT(*) FROM agents WHERE name ILIKE $1 AND type = $2';
    expect(translateSqlForSqlite(pg)).toBe(
      'SELECT COUNT(*) AS count FROM agents WHERE name LIKE ? AND type = ?'
    );
  });
});
