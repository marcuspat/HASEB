import { DatabaseConnection } from '@/database/connection';
import { MigrationManager } from '@/database/migrations';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';
import { EvaluationModel } from '@/database/models/Evaluation';
import { TestDatabase } from '../helpers/test-db';

describe('Database Integration Tests', () => {
  let testDb: TestDatabase;
  let db: DatabaseConnection;

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

  describe('Database Connection', () => {
    it('should establish and maintain connection', async () => {
      const isConnected = await db.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should handle connection pool management', () => {
      const stats = db.getPoolStats();
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
      expect(stats.idleCount).toBeGreaterThanOrEqual(0);
      expect(stats.waitingCount).toBeGreaterThanOrEqual(0);
    });

    it('should recover from connection issues', async () => {
      // Test connection resilience
      const result = await db.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });
  });

  describe('Migration Management', () => {
    it('should run migrations successfully', async () => {
      await expect(MigrationManager.migrate()).resolves.not.toThrow();
    });

    it('should track migration status', async () => {
      // Check if migrations table exists and has records
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'migrations'
        ) as exists
      `);

      expect(result.rows[0].exists).toBe(true);
    });

    it('should create required tables', async () => {
      const tables = ['users', 'agents', 'benchmarks', 'evaluations'];

      for (const table of tables) {
        const result = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = $1
          ) as exists
        `, [table]);

        expect(result.rows[0].exists).toBe(true);
      }
    });
  });

  describe('Transaction Management', () => {
    it('should handle simple transactions', async () => {
      const result = await db.transaction(async (client) => {
        await client.query('CREATE TEMP TABLE test_tx (id SERIAL PRIMARY KEY, data TEXT)');
        await client.query('INSERT INTO test_tx (data) VALUES ($1)', ['test data']);
        const selectResult = await client.query('SELECT * FROM test_tx');
        return selectResult.rows[0].data;
      });

      expect(result).toBe('test data');
    });

    it('should rollback failed transactions', async () => {
      await expect(
        db.transaction(async (client) => {
          await client.query('CREATE TEMP TABLE test_rollback (id SERIAL PRIMARY KEY)');
          await client.query('INSERT INTO test_rollback DEFAULT VALUES');
          throw new Error('Test rollback');
        })
      ).rejects.toThrow('Test rollback');

      // Verify table doesn't exist due to rollback
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'test_rollback'
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

        const results = await Promise.all(insertPromises);
        return results.map(r => r.rows[0].id);
      });

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Agent Model Integration', () => {
    beforeEach(async () => {
      await testDb.seedTestData();
    });

    it('should create, read, update, and delete agents', async () => {
      // Create
      const agentData = {
        name: 'Integration Test Agent',
        type: 'general',
        description: 'Test agent for integration',
        capabilities: ['testing', 'integration'],
        configuration: { test: true },
      };

      const createdAgent = await AgentModel.create(agentData);
      expect(createdAgent.id).toBeDefined();
      expect(createdAgent.name).toBe(agentData.name);

      // Read
      const readAgent = await AgentModel.findById(createdAgent.id);
      expect(readAgent).toBeDefined();
      expect(readAgent!.id).toBe(createdAgent.id);

      // Update
      const updatedAgent = await AgentModel.update(createdAgent.id, {
        name: 'Updated Agent Name',
        description: 'Updated description',
      });
      expect(updatedAgent!.name).toBe('Updated Agent Name');

      // Delete
      const deleteSuccess = await AgentModel.delete(createdAgent.id);
      expect(deleteSuccess).toBe(true);

      const deletedAgent = await AgentModel.findById(createdAgent.id);
      expect(deletedAgent).toBeNull();
    });

    it('should handle complex queries', async () => {
      // Create multiple agents
      const agents = await Promise.all([
        AgentModel.create({ name: 'Agent 1', type: 'swe' }),
        AgentModel.create({ name: 'Agent 2', type: 'gui' }),
        AgentModel.create({ name: 'Agent 3', type: 'swe' }),
      ]);

      // Test listing with filters
      const sweAgents = await AgentModel.list(1, 10, 'swe');
      expect(sweAgents.agents).toHaveLength(3); // 2 new + 1 from seed

      // Test search
      const searchResults = await AgentModel.search('Agent');
      expect(searchResults.agents.length).toBeGreaterThan(0);

      // Test status updates
      await AgentModel.updateStatus(agents[0].id, 'active');
      const activeAgents = await AgentModel.getActiveAgents();
      expect(activeAgents.length).toBeGreaterThan(0);
    });
  });

  describe('Benchmark Model Integration', () => {
    beforeEach(async () => {
      await testDb.seedTestData();
    });

    it('should manage benchmark lifecycle', async () => {
      const benchmarkData = {
        name: 'Integration Benchmark',
        type: 'swe-bench',
        description: 'Test benchmark',
        totalTasks: 100,
        completedTasks: 75,
        difficulty: 'medium',
      };

      // Create
      const created = await BenchmarkModel.create(benchmarkData);
      expect(created.id).toBeDefined();

      // Read
      const read = await BenchmarkModel.findById(created.id);
      expect(read!.name).toBe(benchmarkData.name);

      // Update
      const updated = await BenchmarkModel.update(created.id, {
        completedTasks: 80,
        lastRun: new Date(),
      });
      expect(updated!.completedTasks).toBe(80);

      // List
      const benchmarks = await BenchmarkModel.list(1, 10, 'swe-bench');
      expect(benchmarks.benchmarks.length).toBeGreaterThan(0);

      // Delete
      const deleted = await BenchmarkModel.delete(created.id);
      expect(deleted).toBe(true);
    });

    it('should handle benchmark metrics', async () => {
      const benchmark = await BenchmarkModel.create({
        name: 'Metrics Test Benchmark',
        type: 'osworld',
        description: 'For testing metrics',
        totalTasks: 50,
        completedTasks: 40,
        difficulty: 'hard',
      });

      const metrics = await BenchmarkModel.getBenchmarkMetrics(benchmark.id);
      expect(metrics).toBeDefined();
      expect(metrics.totalEvaluations).toBeDefined();
    });
  });

  describe('Evaluation Model Integration', () => {
    beforeEach(async () => {
      await testDb.seedTestData();
    });

    it('should handle complete evaluation lifecycle', async () => {
      // Get existing agent and benchmark
      const agents = await AgentModel.list(1, 1);
      const benchmarks = await BenchmarkModel.list(1, 1);

      expect(agents.agents).toHaveLength(1);
      expect(benchmarks.benchmarks).toHaveLength(1);

      const evaluationData = {
        agentId: agents.agents[0].id,
        benchmarkId: benchmarks.benchmarks[0].id,
        status: 'running' as const,
        progress: 0,
        metrics: {
          taskSuccessRate: 0,
          executionTime: 0,
          latencyPerStep: 0,
          totalSteps: 0,
          totalTokens: 0,
          estimatedCost: 0,
          toolCallErrorRate: 0,
          recoveryRate: 0,
          toolSelectionAccuracy: 0,
          parameterAccuracy: 0,
        },
      };

      // Create
      const created = await EvaluationModel.create(evaluationData);
      expect(created.id).toBeDefined();

      // Update progress
      await EvaluationModel.updateProgress(created.id, 50);
      const updated = await EvaluationModel.findById(created.id);
      expect(updated!.progress).toBe(50);

      // Complete evaluation
      const finalMetrics = {
        taskSuccessRate: 0.85,
        executionTime: 1200,
        latencyPerStep: 100,
        totalSteps: 12,
        totalTokens: 2500,
        estimatedCost: 0.025,
        toolCallErrorRate: 0.05,
        recoveryRate: 0.95,
        toolSelectionAccuracy: 0.90,
        parameterAccuracy: 0.88,
      };

      await EvaluationModel.complete(created.id, finalMetrics);
      const completed = await EvaluationModel.findById(created.id);
      expect(completed!.status).toBe('completed');
      expect(completed!.progress).toBe(100);
      expect(completed!.endTime).toBeDefined();

      // List evaluations
      const evaluations = await EvaluationModel.list(1, 10, agents.agents[0].id);
      expect(evaluations.evaluations.length).toBeGreaterThan(0);

      // Cleanup
      await EvaluationModel.delete(created.id);
    });
  });

  describe('Cross-Model Integration', () => {
    beforeEach(async () => {
      await testDb.seedTestData();
    });

    it('should maintain referential integrity', async () => {
      const agent = await AgentModel.create({
        name: 'Test Agent',
        type: 'general',
      });

      const benchmark = await BenchmarkModel.create({
        name: 'Test Benchmark',
        type: 'swe-bench',
        totalTasks: 10,
        completedTasks: 0,
        difficulty: 'easy',
      });

      const evaluation = await EvaluationModel.create({
        agentId: agent.id,
        benchmarkId: benchmark.id,
        status: 'running',
        progress: 0,
        metrics: {
          taskSuccessRate: 0,
          executionTime: 0,
          latencyPerStep: 0,
          totalSteps: 0,
          totalTokens: 0,
          estimatedCost: 0,
          toolCallErrorRate: 0,
          recoveryRate: 0,
          toolSelectionAccuracy: 0,
          parameterAccuracy: 0,
        },
      });

      // Verify relationships exist
      const retrievedEvaluation = await EvaluationModel.findById(evaluation.id);
      expect(retrievedEvaluation!.agentId).toBe(agent.id);
      expect(retrievedEvaluation!.benchmarkId).toBe(benchmark.id);

      // Verify agent can access its evaluations
      const agentEvaluations = await EvaluationModel.list(1, 10, agent.id);
      expect(agentEvaluations.evaluations).toHaveLength(1);

      // Verify benchmark can access its evaluations
      const benchmarkEvaluations = await EvaluationModel.list(1, 10, undefined, benchmark.id);
      expect(benchmarkEvaluations.evaluations).toHaveLength(1);

      // Test cascade delete protection
      await expect(AgentModel.delete(agent.id)).rejects.toThrow();
      await expect(BenchmarkModel.delete(benchmark.id)).rejects.toThrow();

      // Clean up in correct order
      await EvaluationModel.delete(evaluation.id);
      await AgentModel.delete(agent.id);
      await BenchmarkModel.delete(benchmark.id);
    });

    it('should handle complex data relationships', async () => {
      // Create multiple agents and benchmarks
      const agents = await Promise.all([
        AgentModel.create({ name: 'Agent A', type: 'swe' }),
        AgentModel.create({ name: 'Agent B', type: 'gui' }),
      ]);

      const benchmarks = await Promise.all([
        BenchmarkModel.create({ name: 'Benchmark X', type: 'swe-bench', totalTasks: 20, completedTasks: 0, difficulty: 'easy' }),
        BenchmarkModel.create({ name: 'Benchmark Y', type: 'osworld', totalTasks: 15, completedTasks: 0, difficulty: 'medium' }),
      ]);

      // Create evaluations for all combinations
      const evaluations = [];
      for (const agent of agents) {
        for (const benchmark of benchmarks) {
          const evaluation = await EvaluationModel.create({
            agentId: agent.id,
            benchmarkId: benchmark.id,
            status: 'completed',
            progress: 100,
            metrics: {
              taskSuccessRate: Math.random() * 0.3 + 0.7, // 0.7-1.0
              executionTime: Math.floor(Math.random() * 2000) + 500,
              latencyPerStep: Math.floor(Math.random() * 200) + 50,
              totalSteps: Math.floor(Math.random() * 20) + 5,
              totalTokens: Math.floor(Math.random() * 5000) + 1000,
              estimatedCost: Math.random() * 0.1 + 0.01,
              toolCallErrorRate: Math.random() * 0.1,
              recoveryRate: Math.random() * 0.2 + 0.8,
              toolSelectionAccuracy: Math.random() * 0.2 + 0.8,
              parameterAccuracy: Math.random() * 0.2 + 0.8,
            },
          });
          evaluations.push(evaluation);
        }
      }

      // Test complex queries
      const agentMetrics = await AgentModel.getAgentMetrics(agents[0].id);
      expect(agentMetrics).toBeDefined();
      expect(agentMetrics.totalEvaluations).toBe(2);

      const benchmarkMetrics = await BenchmarkModel.getBenchmarkMetrics(benchmarks[0].id);
      expect(benchmarkMetrics).toBeDefined();
      expect(benchmarkMetrics.totalEvaluations).toBe(2);

      const allEvaluations = await EvaluationModel.list(1, 20);
      expect(allEvaluations.evaluations.length).toBeGreaterThanOrEqual(4);

      // Cleanup
      for (const evaluation of evaluations) {
        await EvaluationModel.delete(evaluation.id);
      }
      for (const agent of agents) {
        await AgentModel.delete(agent.id);
      }
      for (const benchmark of benchmarks) {
        await BenchmarkModel.delete(benchmark.id);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent database operations', async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const agent = await AgentModel.create({
          name: `Concurrent Agent ${i}`,
          type: 'general',
        });

        const benchmark = await BenchmarkModel.create({
          name: `Concurrent Benchmark ${i}`,
          type: 'swe-bench',
          totalTasks: 10,
          completedTasks: 0,
          difficulty: 'easy',
        });

        const evaluation = await EvaluationModel.create({
          agentId: agent.id,
          benchmarkId: benchmark.id,
          status: 'running',
          progress: 0,
          metrics: {
            taskSuccessRate: 0,
            executionTime: 0,
            latencyPerStep: 0,
            totalSteps: 0,
            totalTokens: 0,
            estimatedCost: 0,
            toolCallErrorRate: 0,
            recoveryRate: 0,
            toolSelectionAccuracy: 0,
            parameterAccuracy: 0,
          },
        });

        return { agent, benchmark, evaluation };
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // Verify all entities were created successfully
      results.forEach(({ agent, benchmark, evaluation }) => {
        expect(agent.id).toBeDefined();
        expect(benchmark.id).toBeDefined();
        expect(evaluation.id).toBeDefined();
      });

      // Cleanup
      for (const { evaluation, agent, benchmark } of results) {
        await EvaluationModel.delete(evaluation.id);
        await AgentModel.delete(agent.id);
        await BenchmarkModel.delete(benchmark.id);
      }
    });

    it('should handle large datasets efficiently', async () => {
      // Create a large number of agents
      const agents = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          AgentModel.create({
            name: `Scale Test Agent ${i}`,
            type: i % 2 === 0 ? 'swe' : 'gui',
          })
        )
      );

      // Test pagination
      const page1 = await AgentModel.list(1, 20);
      const page2 = await AgentModel.list(2, 20);
      const page3 = await AgentModel.list(3, 20);

      expect(page1.agents).toHaveLength(20);
      expect(page2.agents).toHaveLength(20);
      expect(page3.agents).toHaveLength(20);
      expect(page1.total).toBe(102); // 100 new + 2 from seed

      // Test filtering performance
      const sweAgents = await AgentModel.list(1, 50, 'swe');
      expect(sweAgents.agents.length).toBeGreaterThan(0);

      // Test search performance
      const searchResults = await AgentModel.search('Scale Test', 1, 50);
      expect(searchResults.agents.length).toBe(100);

      // Cleanup
      for (const agent of agents) {
        await AgentModel.delete(agent.id);
      }
    });
  });
});