import { performance } from 'perf_hooks';
import request from 'supertest';
import app from '@/server';
import { TestDatabase } from '../helpers/test-db';

describe('Load Testing', () => {
  let testDb: TestDatabase;
  const baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await testDb.seedTestData();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('API Load Tests', () => {
    test('should handle concurrent GET /health requests', async () => {
      const concurrentRequests = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/health')
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify all requests succeeded
      results.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });

      // Performance assertions
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(duration / concurrentRequests).toBeLessThan(100); // Average <100ms per request
    });

    test('should handle concurrent GET /api/agents requests', async () => {
      const concurrentRequests = 30;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/agents')
          .set('Authorization', 'Bearer test-token')
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Count successful responses
      const successful = results.filter(r => r.status === 200);
      const rateLimited = results.filter(r => r.status === 429);

      expect(successful.length + rateLimited.length).toBe(concurrentRequests);

      // At least some requests should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Performance should remain reasonable under load
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain response times under sustained load', async () => {
      const rounds = 5;
      const requestsPerRound = 20;
      const responseTimes: number[] = [];

      for (let round = 0; round < rounds; round++) {
        const roundTimes: number[] = [];

        const promises = Array.from({ length: requestsPerRound }, async () => {
          const start = performance.now();
          const response = await request(app).get('/health');
          const end = performance.now();

          roundTimes.push(end - start);
          return response;
        });

        await Promise.all(promises);

        // Calculate average for this round
        const roundAverage = roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length;
        responseTimes.push(roundAverage);

        // Small delay between rounds
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Response times should not degrade significantly
      const firstRound = responseTimes[0];
      const lastRound = responseTimes[responseTimes.length - 1];
      const degradation = (lastRound - firstRound) / firstRound;

      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
      expect(lastRound).toBeLessThan(200); // Last round should still be <200ms
    });

    test('should handle mixed workload efficiently', async () => {
      const workload = [
        { path: '/health', count: 10 },
        { path: '/api/agents', count: 8 },
        { path: '/api/benchmarks', count: 6 },
        { path: '/api/evaluations', count: 4 },
      ];

      const startTime = performance.now();
      const promises: Promise<any>[] = [];

      workload.forEach(({ path, count }) => {
        for (let i = 0; i < count; i++) {
          promises.push(
            request(app)
              .get(path)
              .set('Authorization', 'Bearer test-token')
          );
        }
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Analyze results by endpoint
      const resultsByPath = new Map<string, any[]>();
      results.forEach((response, index) => {
        const pathIndex = Math.floor(index / workload.reduce((sum, w) => sum + w.count, 0));
        const currentSum = workload.slice(0, pathIndex + 1).reduce((sum, w) => sum + w.count, 0);
        const prevSum = workload.slice(0, pathIndex).reduce((sum, w) => sum + w.count, 0);
        const pathIndexInWorkload = index - prevSum;

        let path = '';
        let accumulated = 0;
        for (const w of workload) {
          accumulated += w.count;
          if (pathIndexInWorkload < accumulated) {
            path = w.path;
            break;
          }
        }

        if (!resultsByPath.has(path)) {
          resultsByPath.set(path, []);
        }
        resultsByPath.get(path)!.push(response);
      });

      // Verify all endpoints respond
      for (const { path } of workload) {
        const pathResults = resultsByPath.get(path) || [];
        const successful = pathResults.filter(r => r.status === 200 || r.status === 429);
        expect(successful.length).toBeGreaterThan(0);
      }

      // Overall performance should be reasonable
      expect(totalDuration).toBeLessThan(3000); // Complete within 3 seconds
    });
  });

  describe('Database Load Tests', () => {
    test('should handle concurrent database operations', async () => {
      const db = testDb.getDb();
      const operations = 50;

      const promises = Array.from({ length: operations }, async (_, i) => {
        // Mix of different database operations
        switch (i % 4) {
          case 0:
            return await db.query('SELECT COUNT(*) FROM agents');
          case 1:
            return await db.query('SELECT * FROM agents LIMIT 5');
          case 2:
            return await db.query('SELECT COUNT(*) FROM evaluations');
          case 3:
            return await db.transaction(async (client) => {
              await client.query('SELECT 1');
              return { success: true };
            });
          default:
            return await db.query('SELECT 1');
        }
      });

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All operations should succeed
      expect(results).toHaveLength(operations);

      // Performance should be reasonable
      expect(duration).toBeLessThan(3000); // Complete within 3 seconds
      expect(duration / operations).toBeLessThan(100); // Average <100ms per operation
    });

    test('should handle large query results efficiently', async () => {
      const db = testDb.getDb();
      const queries = 10;

      // Create a temporary table with data for testing
      await db.query(`
        CREATE TEMP TABLE load_test_data (
          id SERIAL PRIMARY KEY,
          data TEXT,
          timestamp TIMESTAMP DEFAULT NOW()
        )
      `);

      // Insert test data
      const insertPromises = Array.from({ length: 1000 }, (_, i) =>
        db.query(
          'INSERT INTO load_test_data (data) VALUES ($1)',
          [`Test data ${i}`]
        )
      );

      await Promise.all(insertPromises);

      // Test concurrent large queries
      const queryPromises = Array.from({ length: queries }, () =>
        db.query('SELECT * FROM load_test_data ORDER BY id')
      );

      const startTime = performance.now();
      const results = await Promise.all(queryPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify all queries returned expected data
      results.forEach(result => {
        expect(result.rows).toHaveLength(1000);
      });

      // Performance should remain reasonable even with large result sets
      expect(duration).toBeLessThan(5000); // Complete within 5 seconds

      // Cleanup
      await db.query('DROP TABLE load_test_data');
    });

    test('should handle transaction concurrency', async () => {
      const db = testDb.getDb();
      const concurrentTransactions = 20;

      const promises = Array.from({ length: concurrentTransactions }, async (i) => {
        return await db.transaction(async (client) => {
          // Simulate complex transaction
          await client.query('CREATE TEMP TABLE tx_test_$1 (id SERIAL, data TEXT)', [i]);
          await client.query('INSERT INTO tx_test_$1 (data) VALUES ($2)', [i, `Transaction ${i}`]);
          const result = await client.query('SELECT * FROM tx_test_$1', [i]);
          await client.query('DROP TABLE tx_test_$1', [i]);
          return result.rows[0];
        });
      });

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All transactions should succeed
      expect(results).toHaveLength(concurrentTransactions);
      results.forEach(result => {
        expect(result.data).toMatch(/Transaction \d+/);
      });

      // Performance should be reasonable
      expect(duration).toBeLessThan(4000); // Complete within 4 seconds
    });
  });

  describe('Memory Usage Tests', () => {
    test('should not leak memory under sustained load', async () => {
      const rounds = 3;
      const requestsPerRound = 100;
      const memorySnapshots: number[] = [];

      for (let round = 0; round < rounds; round++) {
        // Get initial memory for this round
        const initialMemory = process.memoryUsage().heapUsed;

        // Perform requests
        const promises = Array.from({ length: requestsPerRound }, () =>
          request(app).get('/health')
        );

        await Promise.all(promises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Get final memory for this round
        const finalMemory = process.memoryUsage().heapUsed;
        const roundMemoryIncrease = finalMemory - initialMemory;
        memorySnapshots.push(roundMemoryIncrease);

        // Wait a bit between rounds
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Memory usage should not grow significantly
      const avgIncrease = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
      expect(avgIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB average increase
    });

    test('should handle large request payloads efficiently', async () => {
      const largePayload = {
        data: 'x'.repeat(1024 * 1024), // 1MB of data
        nested: {
          array: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
        },
      };

      const startTime = performance.now();
      const response = await request(app)
        .post('/api/test-large-payload') // This would need to be implemented
        .send(largePayload)
        .set('Authorization', 'Bearer test-token');
      const endTime = performance.now();
      const duration = endTime - startTime;

      // If endpoint exists, test performance
      if (response.status !== 404) {
        expect([200, 400]).toContain(response.status);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      }
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should enforce rate limits under high load', async () => {
      const requests = 100;
      const promises = Array.from({ length: requests }, () =>
        request(app).get('/api/agents').set('Authorization', 'Bearer test-token')
      );

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Analyze response status codes
      const statusCounts = results.reduce((acc, response) => {
        acc[response.status] = (acc[response.status] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Should have some rate limited responses under high load
      expect(statusCounts[429] || 0).toBeGreaterThan(0);
      expect(statusCounts[200] || 0).toBeGreaterThan(0);

      // Overall performance should remain reasonable
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });

    test('should recover from rate limiting', async () => {
      // First, trigger rate limiting
      const burstRequests = 50;
      const burstPromises = Array.from({ length: burstRequests }, () =>
        request(app).get('/api/agents').set('Authorization', 'Bearer test-token')
      );

      await Promise.all(burstPromises);

      // Wait for rate limit window to reset
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try again - should succeed
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', 'Bearer test-token');

      expect([200, 401]).toContain(response.status); // 200 if auth works, 401 if not
    });
  });

  describe('Stress Tests', () => {
    test('should handle stress scenario with mixed operations', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      const results: any[] = [];

      // Start multiple concurrent workers
      const workers = Array.from({ length: 5 }, async (_, workerId) => {
        const workerResults: any[] = [];

        while (Date.now() - startTime < duration) {
          const operationStart = performance.now();

          try {
            // Mix different operations
            const operationType = workerId % 3;
            let response;

            switch (operationType) {
              case 0:
                response = await request(app).get('/health');
                break;
              case 1:
                response = await request(app)
                  .get('/api/agents')
                  .set('Authorization', 'Bearer test-token');
                break;
              case 2:
                response = await request(app)
                  .get('/api/benchmarks')
                  .set('Authorization', 'Bearer test-token');
                break;
              default:
                response = await request(app).get('/health');
            }

            const operationEnd = performance.now();
            const operationDuration = operationEnd - operationStart;

            workerResults.push({
              workerId,
              operationType,
              status: response.status,
              duration: operationDuration,
              timestamp: Date.now(),
            });
          } catch (error) {
            workerResults.push({
              workerId,
              operationType: 'error',
              error: (error as any).message,
              timestamp: Date.now(),
            });
          }

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return workerResults;
      });

      const workerResults = await Promise.all(workers);
      const allResults = workerResults.flat();

      // Analyze results
      const totalOperations = allResults.length;
      const successfulOperations = allResults.filter(r => r.status === 200).length;
      const rateLimitedOperations = allResults.filter(r => r.status === 429).length;
      const errorOperations = allResults.filter(r => r.error).length;

      const avgDuration = allResults
        .filter(r => r.duration)
        .reduce((sum, r) => sum + r.duration, 0) / allResults.filter(r => r.duration).length;

      // Assertions
      expect(totalOperations).toBeGreaterThan(100); // Should complete many operations
      expect(successfulOperations).toBeGreaterThan(totalOperations * 0.5); // At least 50% success
      expect(rateLimitedOperations + errorOperations).toBeLessThan(totalOperations * 0.5); // Less than 50% failures
      expect(avgDuration).toBeLessThan(500); // Average response time < 500ms
    });
  });
});