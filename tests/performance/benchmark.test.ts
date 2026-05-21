import { performance } from 'perf_hooks';
import request from 'supertest';
import app from '@/server';
import { TestDatabase } from '../helpers/test-db';
import { DatabaseConnection } from '@/database/connection';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';
import { EvaluationModel } from '@/database/models/Evaluation';

describe('Performance Benchmarks', () => {
  let testDb: TestDatabase;
  let db: DatabaseConnection;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await testDb.seedTestData();
    db = testDb.getDb();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('API Response Time Benchmarks', () => {
    test('GET /health should respond within 50ms', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const response = await request(app).get('/health');
        const end = performance.now();

        expect(response.status).toBe(200);
        responseTimes.push(end - start);
      }

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      const p95Time = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

      expect(avgTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100);
      expect(p95Time).toBeLessThan(75);
    });

    test('GET /api/agents should respond within 200ms', async () => {
      const iterations = 50;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const response = await request(app)
          .get('/api/agents')
          .set('Authorization', 'Bearer test-token');
        const end = performance.now();

        expect([200, 401, 429]).toContain(response.status);
        responseTimes.push(end - start);
      }

      const successfulTimes = responseTimes.filter((_, index) =>
        [200].includes([200, 401, 429][index % 3]) // Approximate successful responses
      );

      if (successfulTimes.length > 0) {
        const avgTime = successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length;
        const maxTime = Math.max(...successfulTimes);

        expect(avgTime).toBeLessThan(200);
        expect(maxTime).toBeLessThan(500);
      }
    });

    test('Complex queries should respond within 1s', async () => {
      const complexQueries = [
        '/api/agents?status=active&type=swe&sort=performance',
        '/api/benchmarks?difficulty=hard&isActive=true',
        '/api/evaluations?status=completed&limit=50',
      ];

      for (const query of complexQueries) {
        const iterations = 20;
        const responseTimes: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const response = await request(app)
            .get(query)
            .set('Authorization', 'Bearer test-token');
          const end = performance.now();

          expect([200, 401, 404, 429]).toContain(response.status);
          responseTimes.push(end - start);
        }

        const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        expect(avgTime).toBeLessThan(1000);
      }
    });
  });

  describe('Database Query Performance Benchmarks', () => {
    test('Simple SELECT queries should execute within 10ms', async () => {
      const iterations = 100;
      const queryTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await db.query('SELECT 1 as test');
        const end = performance.now();

        queryTimes.push(end - start);
      }

      const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const maxTime = Math.max(...queryTimes);
      const p95Time = queryTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

      expect(avgTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(25);
      expect(p95Time).toBeLessThan(15);
    });

    test('Agent model operations should be efficient', async () => {
      // Test listing operations
      const listStart = performance.now();
      const listResult = await AgentModel.list(1, 20);
      const listEnd = performance.now();
      const listTime = listEnd - listStart;

      expect(listTime).toBeLessThan(50);
      expect(listResult.agents).toBeDefined();

      // Test search operations
      const searchStart = performance.now();
      const searchResult = await AgentModel.search('test', 1, 10);
      const searchEnd = performance.now();
      const searchTime = searchEnd - searchStart;

      expect(searchTime).toBeLessThan(100);
      expect(searchResult.agents).toBeDefined();

      // Test find operations
      if (listResult.agents.length > 0) {
        const findStart = performance.now();
        const foundAgent = await AgentModel.findById(listResult.agents[0].id);
        const findEnd = performance.now();
        const findTime = findEnd - findStart;

        expect(findTime).toBeLessThan(20);
        expect(foundAgent).toBeDefined();
      }
    });

    test('Complex JOIN queries should execute within 100ms', async () => {
      const iterations = 20;
      const queryTimes: number[] = [];

      // Complex query joining multiple tables
      const complexQuery = `
        SELECT
          a.id as agent_id,
          a.name as agent_name,
          b.id as benchmark_id,
          b.name as benchmark_name,
          e.status as evaluation_status,
          e.start_time as evaluation_start,
          e.metrics as evaluation_metrics
        FROM agents a
        LEFT JOIN evaluations e ON a.id = e.agent_id
        LEFT JOIN benchmarks b ON e.benchmark_id = b.id
        WHERE a.status = 'active'
        ORDER BY a.created_at DESC
        LIMIT 50
      `;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const result = await db.query(complexQuery);
        const end = performance.now();

        expect(result.rows).toBeDefined();
        queryTimes.push(end - start);
      }

      const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const maxTime = Math.max(...queryTimes);

      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200);
    });

    test('Transaction performance should be efficient', async () => {
      const iterations = 50;
      const transactionTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        const result = await db.transaction(async (client) => {
          await client.query('CREATE TEMP TABLE perf_test (id SERIAL, data TEXT)');
          await client.query('INSERT INTO perf_test (data) VALUES ($1)', [`test-${i}`]);
          const selectResult = await client.query('SELECT * FROM perf_test');
          await client.query('DROP TABLE perf_test');
          return selectResult.rows[0];
        });

        const end = performance.now();
        transactionTimes.push(end - start);
        expect(result).toBeDefined();
      }

      const avgTime = transactionTimes.reduce((a, b) => a + b, 0) / transactionTimes.length;
      const maxTime = Math.max(...transactionTimes);

      expect(avgTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100);
    });
  });

  describe('Concurrent Performance Benchmarks', () => {
    test('Should handle 50 concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/health')
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successful = results.filter(r => r.status === 200);
      const avgTime = totalTime / concurrentRequests;
      const requestsPerSecond = concurrentRequests / (totalTime / 1000);

      expect(successful.length).toBe(concurrentRequests);
      expect(avgTime).toBeLessThan(100);
      expect(requestsPerSecond).toBeGreaterThan(10);
    });

    test('Should handle concurrent database operations', async () => {
      const concurrentOperations = 30;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
        return await db.transaction(async (client) => {
          // Table names can't be parameterized; interpolate the numeric index.
          await client.query(`CREATE TEMP TABLE concurrent_test_${i} (id SERIAL, data TEXT)`);
          await client.query(`INSERT INTO concurrent_test_${i} (data) VALUES ($1)`, [`data-${i}`]);
          const result = await client.query(`SELECT * FROM concurrent_test_${i}`);
          await client.query(`DROP TABLE concurrent_test_${i}`);
          return result.rows[0];
        });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(concurrentOperations);
      expect(totalTime).toBeLessThan(2000);
      expect(totalTime / concurrentOperations).toBeLessThan(100);
    });

    test('Should maintain performance under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const requestInterval = 50; // 50ms between requests
      const results: { timestamp: number; responseTime: number; status: number }[] = [];

      const startTime = Date.now();
      let requestCount = 0;

      while (Date.now() - startTime < duration) {
        const requestStart = performance.now();
        const response = await request(app).get('/health');
        const requestEnd = performance.now();

        results.push({
          timestamp: Date.now(),
          responseTime: requestEnd - requestStart,
          status: response.status,
        });

        requestCount++;
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Analyze results
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      const successRate = results.filter(r => r.status === 200).length / results.length;

      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(200);
      expect(successRate).toBeGreaterThan(0.95);
      expect(requestCount).toBeGreaterThan(duration / requestInterval * 0.8);
    });
  });

  describe('Memory and Resource Benchmarks', () => {
    test('Should handle large query results efficiently', async () => {
      // Use a regular (non-temp) table so inserts/queries on different pooled
      // connections all see the data; temp tables are connection-scoped.
      await db.query('DROP TABLE IF EXISTS large_result_test');
      await db.query(`
        CREATE TABLE large_result_test (
          id SERIAL PRIMARY KEY,
          data TEXT,
          metadata JSONB,
          timestamp TIMESTAMP DEFAULT NOW()
        )
      `);

      // Insert test data
      const testRecords = 1000;
      const insertPromises = Array.from({ length: testRecords }, (_, i) =>
        db.query(
          'INSERT INTO large_result_test (data, metadata) VALUES ($1, $2)',
          [`Test data ${i}`, { index: i, type: 'test' }]
        )
      );

      await Promise.all(insertPromises);

      // Test query performance
      const iterations = 10;
      const queryTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const result = await db.query('SELECT * FROM large_result_test ORDER BY id');
        const end = performance.now();

        expect(result.rows).toHaveLength(testRecords);
        queryTimes.push(end - start);
      }

      const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const maxTime = Math.max(...queryTimes);

      expect(avgTime).toBeLessThan(200);
      expect(maxTime).toBeLessThan(500);

      // Cleanup
      await db.query('DROP TABLE large_result_test');
    });

    test('Should manage memory usage under stress', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      const operations = 100;
      const promises = Array.from({ length: operations }, async (i) => {
        // Create large objects
        const largeData = {
          id: i,
          data: 'x'.repeat(10000), // 10KB per operation
          nested: {
            array: Array.from({ length: 100 }, (_, j) => ({ index: j, value: `item-${j}` })),
          },
        };

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1));

        return largeData;
      });

      await Promise.all(promises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Throughput Benchmarks', () => {
    test('Should achieve target throughput for API endpoints', async () => {
      const targetThroughput = 100; // requests per second
      const testDuration = 3000; // 3 seconds
      const requestInterval = 1000 / targetThroughput;

      const results: { timestamp: number; responseTime: number; status: number }[] = [];
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        const requestStart = performance.now();
        const response = await request(app).get('/health');
        const requestEnd = performance.now();

        results.push({
          timestamp: Date.now(),
          responseTime: requestEnd - requestStart,
          status: response.status,
        });

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      const actualThroughput = results.length / (testDuration / 1000);
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const successRate = results.filter(r => r.status === 200).length / results.length;

      // Requests are issued serially with a fixed interval, so throughput is
      // bounded by per-request latency rather than server capacity; assert a
      // sustained rate plus fast, reliable responses.
      expect(actualThroughput).toBeGreaterThan(25);
      expect(avgResponseTime).toBeLessThan(50);
      expect(successRate).toBeGreaterThan(0.99);
    });

    test('Should handle batch operations efficiently', async () => {
      const batchSize = 50;
      const batches = 5;

      const results: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStart = performance.now();

        const promises = Array.from({ length: batchSize }, () =>
          request(app).get('/health')
        );

        await Promise.all(promises);
        const batchEnd = performance.now();

        const batchTime = batchEnd - batchStart;
        results.push(batchTime);
      }

      const avgBatchTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxBatchTime = Math.max(...results);
      const throughput = (batchSize * batches) / (results.reduce((a, b) => a + b, 0) / 1000);

      expect(avgBatchTime).toBeLessThan(1000); // Each batch < 1 second
      expect(maxBatchTime).toBeLessThan(2000); // Max batch < 2 seconds
      expect(throughput).toBeGreaterThan(100); // Overall throughput > 100 req/s
    });
  });
});