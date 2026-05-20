import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import type { DatabaseConnection as DatabaseConnectionType } from '@/database/connection';

// True unit test: no live PostgreSQL. We mock the `pg` module so `new Pool()`
// returns a fully controllable fake. The connection module also mocks sqlite3
// for completeness, and the logger to keep output quiet.
//
// NOTE: importing the connection module runs `db = DatabaseConnection.getInstance(...)`
// at module load, so the singleton is ALREADY initialized by the time the tests
// run. The tests below are structured around that fact (idempotent getInstance,
// delegation to the mocked pool), which keeps them deterministic and DB-free.

const poolQuery = jest.fn();
const poolConnect = jest.fn();
const poolEnd = jest.fn();
const poolOn = jest.fn();

// A single fake pool instance reused for every `new Pool(...)`.
const fakePool = {
  query: poolQuery,
  connect: poolConnect,
  end: poolEnd,
  on: poolOn,
  totalCount: 3,
  idleCount: 2,
  waitingCount: 1,
};

const PoolMock = jest.fn(() => fakePool);

jest.unstable_mockModule('pg', () => ({
  Pool: PoolMock,
  PoolClient: jest.fn(),
}));

jest.unstable_mockModule('sqlite3', () => ({
  default: {
    Database: jest.fn().mockImplementation((_path: string, cb?: (err: Error | null) => void) => {
      if (cb) cb(null);
      return { run: jest.fn(), close: jest.fn() };
    }),
  },
}));

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

let DatabaseConnection: typeof DatabaseConnectionType;
let db: DatabaseConnectionType;

const config = {
  type: 'postgresql' as const,
  host: 'localhost',
  port: 5432,
  database: 'test',
  username: 'postgres',
  password: 'password',
};

beforeAll(async () => {
  process.env.DB_TYPE = 'postgresql';
  const mod = await import('@/database/connection');
  DatabaseConnection = mod.DatabaseConnection;
  db = mod.db;
});

describe('DatabaseConnection', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    poolConnect.mockReset();
    poolEnd.mockReset();
  });

  describe('Singleton Pattern', () => {
    it('should return the already-initialized singleton instance', () => {
      // The module created `db` via getInstance(...) at import time, so the
      // singleton exists. getInstance() with no args returns that same instance.
      const instance = DatabaseConnection.getInstance();
      expect(instance).toBe(db);
    });

    it('should be idempotent: repeated getInstance calls return the same instance', () => {
      const a = DatabaseConnection.getInstance(config);
      const b = DatabaseConnection.getInstance();
      const c = DatabaseConnection.getInstance(config);
      expect(a).toBe(b);
      expect(b).toBe(c);
      expect(a).toBe(db);
    });

    it('does not re-construct a pool on subsequent getInstance calls', () => {
      // The singleton was constructed at module load. Calling getInstance again
      // returns the cached instance and never invokes the Pool constructor again.
      PoolMock.mockClear();
      DatabaseConnection.getInstance(config);
      DatabaseConnection.getInstance();
      expect(PoolMock).not.toHaveBeenCalled();
    });
  });

  describe('getInstance error path', () => {
    it('throws when first initialization is attempted with no config', () => {
      // Temporarily clear the cached singleton so getInstance() takes the
      // first-initialization branch, which requires a config. Restore afterwards
      // so the rest of the suite keeps using the module-level instance.
      const saved = (DatabaseConnection as any).instance;
      (DatabaseConnection as any).instance = undefined;
      try {
        expect(() => DatabaseConnection.getInstance()).toThrow(
          'Database configuration required for first initialization'
        );
      } finally {
        (DatabaseConnection as any).instance = saved;
      }
    });
  });

  describe('Query delegation', () => {
    it('delegates query() to the underlying pool and returns its result', async () => {
      poolQuery.mockResolvedValue({ rows: [{ number: 1 }], rowCount: 1 });

      const result = await db.query('SELECT 1 as number');

      expect(poolQuery).toHaveBeenCalledWith('SELECT 1 as number', undefined);
      expect(result.rows).toEqual([{ number: 1 }]);
      expect(result.rowCount).toBe(1);
    });

    it('passes query parameters through to the pool', async () => {
      poolQuery.mockResolvedValue({ rows: [{ text: 'test' }], rowCount: 1 });

      const result = await db.query('SELECT $1 as text', ['test']);

      expect(poolQuery).toHaveBeenCalledWith('SELECT $1 as text', ['test']);
      expect(result.rows[0].text).toBe('test');
    });

    it('propagates query errors from the pool', async () => {
      poolQuery.mockRejectedValue(new Error('Pool exhausted'));

      await expect(db.query('SELECT 1')).rejects.toThrow('Pool exhausted');
    });
  });

  describe('testConnection', () => {
    it('returns true when the underlying query succeeds', async () => {
      poolQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await expect(db.testConnection()).resolves.toBe(true);
      expect(poolQuery).toHaveBeenCalledWith('SELECT 1', undefined);
    });

    it('returns false when the underlying query fails', async () => {
      poolQuery.mockRejectedValue(new Error('down'));
      await expect(db.testConnection()).resolves.toBe(false);
    });
  });

  describe('Transaction management', () => {
    it('commits a successful transaction via a pooled client', async () => {
      const clientQuery = jest.fn().mockResolvedValue({ rows: [{ data: 'test' }], rowCount: 1 });
      const release = jest.fn();
      poolConnect.mockResolvedValue({ query: clientQuery, release });

      const result = await db.transaction(async (client: any) => {
        const r = await client.query('SELECT 1');
        return r.rows[0];
      });

      expect(clientQuery).toHaveBeenCalledWith('BEGIN');
      expect(clientQuery).toHaveBeenCalledWith('COMMIT');
      expect(release).toHaveBeenCalled();
      expect(result).toEqual({ data: 'test' });
    });

    it('rolls back a failed transaction and rethrows', async () => {
      const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
      const release = jest.fn();
      poolConnect.mockResolvedValue({ query: clientQuery, release });

      await expect(
        db.transaction(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(clientQuery).toHaveBeenCalledWith('BEGIN');
      expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(clientQuery).not.toHaveBeenCalledWith('COMMIT');
      expect(release).toHaveBeenCalled();
    });
  });

  describe('Client / pool stats', () => {
    it('getClient delegates to pool.connect', async () => {
      const fakeClient = { query: jest.fn(), release: jest.fn() };
      poolConnect.mockResolvedValue(fakeClient);

      const client = await db.getClient();
      expect(poolConnect).toHaveBeenCalled();
      expect(client).toBe(fakeClient);
    });

    it('getPoolStats reports PostgreSQL pool counters', () => {
      const stats = db.getPoolStats();
      expect(stats.type).toBe('PostgreSQL');
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
      expect(typeof stats.totalCount).toBe('number');
    });
  });

  describe('Resource cleanup', () => {
    it('close() ends the underlying pool', async () => {
      poolEnd.mockResolvedValue(undefined);
      await db.close();
      expect(poolEnd).toHaveBeenCalled();
    });
  });
});
