import { DatabaseConnection } from '@/database/connection';
import { TestDatabase } from '../../helpers/test-db';
import { mockDatabaseConnection } from '../../helpers/mocks';

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('DatabaseConnection', () => {
  let db: DatabaseConnection;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    db = testDb.getDb();
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password',
      };

      const instance1 = DatabaseConnection.getInstance(config as any);
      const instance2 = DatabaseConnection.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should throw error when no config provided on first call', () => {
      expect(() => DatabaseConnection.getInstance(undefined as any)).toThrow(
        'Database configuration required for first initialization'
      );
    });
  });

  describe('Connection Management', () => {
    it('should test connection successfully', async () => {
      const result = await db.testConnection();
      expect(result).toBe(true);
    });

    it('should get pool stats', () => {
      const stats = db.getPoolStats();
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
      expect(typeof stats.totalCount).toBe('number');
      expect(typeof stats.idleCount).toBe('number');
      expect(typeof stats.waitingCount).toBe('number');
    });

    it('should handle query errors gracefully', async () => {
      await expect(db.query('INVALID SQL')).rejects.toThrow();
    });
  });

  describe('Query Execution', () => {
    it('should execute simple query', async () => {
      const result = await db.query('SELECT 1 as number');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].number).toBe(1);
      expect(result.rowCount).toBe(1);
    });

    it('should execute query with parameters', async () => {
      const result = await db.query('SELECT $1 as text', ['test']);
      expect(result.rows[0].text).toBe('test');
    });

    it('should execute query that returns multiple rows', async () => {
      const result = await db.query(`
        SELECT generate_series(1, 5) as number
      `);
      expect(result.rows).toHaveLength(5);
      expect(result.rowCount).toBe(5);
      result.rows.forEach((row: any, index: number) => {
        expect(row.number).toBe(index + 1);
      });
    });

    it('should handle empty result set', async () => {
      const result = await db.query('SELECT * FROM pg_tables WHERE tablename = $1', ['nonexistent']);
      expect(result.rows).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });
  });

  describe('Transaction Management', () => {
    it('should commit successful transaction', async () => {
      const result = await db.transaction(async (client) => {
        const insertResult = await client.query(
          'CREATE TEMP TABLE test_tx (id SERIAL PRIMARY KEY, data TEXT)'
        );
        await client.query('INSERT INTO test_tx (data) VALUES ($1)', ['test']);
        const selectResult = await client.query('SELECT * FROM test_tx');
        return selectResult.rows[0];
      });

      expect(result.data).toBe('test');
    });

    it('should rollback failed transaction', async () => {
      await expect(
        db.transaction(async (client) => {
          await client.query('CREATE TEMP TABLE test_tx_rollback (id SERIAL PRIMARY KEY)');
          await client.query('INSERT INTO test_tx_rollback DEFAULT VALUES');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Table should not exist due to rollback
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'test_tx_rollback'
        ) as exists
      `);
      expect(result.rows[0].exists).toBe(false);
    });

    it('should handle nested operations', async () => {
      const result = await db.transaction(async (client) => {
        await client.query('CREATE TEMP TABLE test_nested (id SERIAL PRIMARY KEY, value INTEGER)');

        const insertPromises = Array.from({ length: 5 }, (_, i) =>
          client.query('INSERT INTO test_nested (value) VALUES ($1) RETURNING id', [i + 1])
        );

        const insertResults = await Promise.all(insertPromises);
        return insertResults.map(r => r.rows[0].id);
      });

      expect(result).toHaveLength(5);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Error Handling', () => {
    it('should log query duration on success', async () => {
      const { logger } = require('../../../src/utils/logger');
      logger.debug.mockClear();

      await db.query('SELECT 1');
      expect(logger.debug).toHaveBeenCalledWith('Query executed', expect.objectContaining({
        duration: expect.stringMatching(/\d+ms/),
        rows: 1,
      }));
    });

    it('should log error information on failure', async () => {
      const { logger } = require('../../../src/utils/logger');
      logger.error.mockClear();

      try {
        await db.query('INVALID QUERY');
      } catch (error) {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalledWith('Query failed', expect.objectContaining({
        query: 'INVALID QUERY',
        duration: expect.stringMatching(/\d+ms/),
        error: expect.any(String),
      }));
    });

    it('should handle connection pool errors', async () => {
      // This test simulates pool errors
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Pool exhausted')),
        on: jest.fn(),
        connect: jest.fn(),
        end: jest.fn(),
      };

      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password',
      };

      const connection = new (DatabaseConnection as any)(config);
      connection['pool'] = mockPool;

      await expect(connection.query('SELECT 1')).rejects.toThrow('Pool exhausted');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent queries', async () => {
      const promises = Array.from({ length: 10 }, () =>
        db.query('SELECT pg_sleep(0.01), random() as value')
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toHaveProperty('value');
      });
    });

    it('should handle large result sets efficiently', async () => {
      const result = await db.query(`
        SELECT generate_series(1, 1000) as number
      `);

      expect(result.rows).toHaveLength(1000);
      expect(result.rowCount).toBe(1000);
    });

    it('should execute queries within reasonable time', async () => {
      const start = Date.now();
      await db.query('SELECT 1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });
  });

  describe('Resource Cleanup', () => {
    it('should close connection pool', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password',
      };

      const connection = DatabaseConnection.getInstance(config as any);
      await connection.close();

      // Should not throw when closing already closed connection
      await connection.close();
    });

    it('should release client back to pool', async () => {
      const client = await db.getClient();
      expect(client).toBeDefined();

      // Release should not throw
      client.release();
    });
  });
});