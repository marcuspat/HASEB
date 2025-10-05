import { Pool, PoolClient } from 'pg';
import { testDatabase } from '../../src/database/test-setup';
import { logger } from '../../src/utils/logger';
import {
  testUsers,
  testAgents,
  testBenchmarks,
  testEvaluations,
  testEvaluationTasks,
  createTestUser,
  createTestAgent,
  createTestBenchmark,
  createTestEvaluation,
  createTestEvaluationTask,
} from '../fixtures/test-data';

/**
 * Test database client with built-in fixture management
 */
export class TestDatabaseClient {
  private testDb: typeof testDatabase;
  private isInitialized = false;

  constructor() {
    this.testDb = testDatabase;
  }

  /**
   * Initialize test database
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.testDb.initialize();
      await this.testDb.createSchema();
      await this.seedAllFixtures();
      this.isInitialized = true;
      logger.info('Test database client initialized');
    }
  }

  /**
   * Seed all fixture data
   */
  async seedAllFixtures(): Promise<void> {
    await this.seedUsers(testUsers);
    await this.seedAgents(testAgents);
    await this.seedBenchmarks(testBenchmarks);
    await this.seedEvaluations(testEvaluations);
    await this.seedEvaluationTasks(testEvaluationTasks);
  }

  /**
   * Seed users
   */
  async seedUsers(users: any[]): Promise<void> {
    const client = await this.testDb.getClient();
    try {
      await client.query('BEGIN');

      for (const user of users) {
        await client.query(`
          INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          user.id,
          user.email,
          user.passwordHash,
          user.fullName,
          user.role,
          user.isActive,
          user.createdAt,
          user.updatedAt,
        ]);
      }

      await client.query('COMMIT');
      logger.debug(`Seeded ${users.length} users`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to seed users:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed agents
   */
  async seedAgents(agents: any[]): Promise<void> {
    const client = await this.testDb.getClient();
    try {
      await client.query('BEGIN');

      for (const agent of agents) {
        await client.query(`
          INSERT INTO agents (
            id, name, type, status, capabilities, performance, config,
            last_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [
          agent.id,
          agent.name,
          agent.type,
          agent.status,
          JSON.stringify(agent.capabilities),
          JSON.stringify(agent.performance),
          JSON.stringify(agent.config),
          agent.lastActive,
          agent.createdAt,
          agent.updatedAt,
        ]);
      }

      await client.query('COMMIT');
      logger.debug(`Seeded ${agents.length} agents`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to seed agents:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed benchmarks
   */
  async seedBenchmarks(benchmarks: any[]): Promise<void> {
    const client = await this.testDb.getClient();
    try {
      await client.query('BEGIN');

      for (const benchmark of benchmarks) {
        await client.query(`
          INSERT INTO benchmarks (
            id, name, type, description, difficulty, total_tasks, completed_tasks,
            config, is_active, last_run, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          benchmark.id,
          benchmark.name,
          benchmark.type,
          benchmark.description,
          benchmark.difficulty,
          benchmark.totalTasks,
          benchmark.completedTasks,
          JSON.stringify(benchmark.config),
          benchmark.isActive,
          benchmark.lastRun,
          benchmark.createdAt,
          benchmark.updatedAt,
        ]);
      }

      await client.query('COMMIT');
      logger.debug(`Seeded ${benchmarks.length} benchmarks`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to seed benchmarks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed evaluations
   */
  async seedEvaluations(evaluations: any[]): Promise<void> {
    const client = await this.testDb.getClient();
    try {
      await client.query('BEGIN');

      for (const evaluation of evaluations) {
        await client.query(`
          INSERT INTO evaluations (
            id, agent_id, benchmark_id, status, progress, metrics, config,
            error_message, start_time, end_time, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          evaluation.id,
          evaluation.agentId,
          evaluation.benchmarkId,
          evaluation.status,
          evaluation.progress,
          JSON.stringify(evaluation.metrics),
          JSON.stringify(evaluation.config),
          evaluation.errorMessage,
          evaluation.startTime,
          evaluation.endTime,
          evaluation.createdAt,
          evaluation.updatedAt,
        ]);
      }

      await client.query('COMMIT');
      logger.debug(`Seeded ${evaluations.length} evaluations`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to seed evaluations:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed evaluation tasks
   */
  async seedEvaluationTasks(tasks: any[]): Promise<void> {
    const client = await this.testDb.getClient();
    try {
      await client.query('BEGIN');

      for (const task of tasks) {
        await client.query(`
          INSERT INTO evaluation_tasks (
            id, evaluation_id, task_index, task_name, task_data, result,
            status, error_message, start_time, end_time, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          task.id,
          task.evaluationId,
          task.taskIndex,
          task.taskName,
          JSON.stringify(task.taskData),
          task.result ? JSON.stringify(task.result) : null,
          task.status,
          task.errorMessage,
          task.startTime,
          task.endTime,
          task.createdAt,
          task.updatedAt,
        ]);
      }

      await client.query('COMMIT');
      logger.debug(`Seeded ${tasks.length} evaluation tasks`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to seed evaluation tasks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a database client for direct queries
   */
  async getClient(): Promise<PoolClient> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.testDb.getClient();
  }

  /**
   * Run a query
   */
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Insert a test user
   */
  async insertTestUser(overrides: any = {}): Promise<any> {
    const user = createTestUser(overrides);
    await this.seedUsers([user]);
    return user;
  }

  /**
   * Insert a test agent
   */
  async insertTestAgent(overrides: any = {}): Promise<any> {
    const agent = createTestAgent(overrides);
    await this.seedAgents([agent]);
    return agent;
  }

  /**
   * Insert a test benchmark
   */
  async insertTestBenchmark(overrides: any = {}): Promise<any> {
    const benchmark = createTestBenchmark(overrides);
    await this.seedBenchmarks([benchmark]);
    return benchmark;
  }

  /**
   * Insert a test evaluation
   */
  async insertTestEvaluation(overrides: any = {}): Promise<any> {
    const evaluation = createTestEvaluation(overrides);
    await this.seedEvaluations([evaluation]);
    return evaluation;
  }

  /**
   * Insert a test evaluation task
   */
  async insertTestEvaluationTask(overrides: any = {}): Promise<any> {
    const task = createTestEvaluationTask(overrides);
    await this.seedEvaluationTasks([task]);
    return task;
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<any[]> {
    const result = await this.query('SELECT * FROM users ORDER BY created_at');
    return result.rows;
  }

  /**
   * Get all agents
   */
  async getAgents(): Promise<any[]> {
    const result = await this.query('SELECT * FROM agents ORDER BY created_at');
    return result.rows;
  }

  /**
   * Get all benchmarks
   */
  async getBenchmarks(): Promise<any[]> {
    const result = await this.query('SELECT * FROM benchmarks ORDER BY created_at');
    return result.rows;
  }

  /**
   * Get all evaluations
   */
  async getEvaluations(): Promise<any[]> {
    const result = await this.query(`
      SELECT e.*, a.name as agent_name, b.name as benchmark_name
      FROM evaluations e
      JOIN agents a ON e.agent_id = a.id
      JOIN benchmarks b ON e.benchmark_id = b.id
      ORDER BY e.created_at
    `);
    return result.rows;
  }

  /**
   * Get evaluation tasks for an evaluation
   */
  async getEvaluationTasks(evaluationId: string): Promise<any[]> {
    const result = await this.query(
      'SELECT * FROM evaluation_tasks WHERE evaluation_id = $1 ORDER BY task_index',
      [evaluationId]
    );
    return result.rows;
  }

  /**
   * Clean all tables
   */
  async cleanup(): Promise<void> {
    await this.testDb.cleanup();
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.testDb.close();
    this.isInitialized = false;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.testDb.healthCheck();
  }
}

// Singleton instance
export const testDbClient = new TestDatabaseClient();