import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

/**
 * Test database setup and management
 */
export class TestDatabaseSetup {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST_TEST || 'localhost',
      port: parseInt(process.env.DB_PORT_TEST || '5433'),
      database: process.env.DB_NAME_TEST || 'haseb_test',
      user: process.env.DB_USER_TEST || 'postgres',
      password: process.env.DB_PASSWORD_TEST || 'testpassword',
      ssl: process.env.DB_SSL_TEST === 'true',
      max: parseInt(process.env.DB_MAX_CONNECTIONS_TEST || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_TEST || '30000'),
    });
  }

  /**
   * Initialize test database connection
   */
  async initialize(): Promise<void> {
    try {
      const client = await this.pool.connect();
      this.isConnected = true;
      client.release();
      logger.info('Test database connection established');
    } catch (error) {
      logger.error('Failed to connect to test database:', error);
      throw error;
    }
  }

  /**
   * Create test database schema
   */
  async createSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create extensions
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create agents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          status VARCHAR(50) DEFAULT 'inactive',
          capabilities JSONB DEFAULT '[]',
          performance JSONB DEFAULT '{}',
          config JSONB DEFAULT '{}',
          last_active TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create benchmarks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS benchmarks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          description TEXT,
          difficulty VARCHAR(20) DEFAULT 'medium',
          total_tasks INTEGER DEFAULT 0,
          completed_tasks INTEGER DEFAULT 0,
          config JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          last_run TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create evaluations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS evaluations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
          benchmark_id UUID REFERENCES benchmarks(id) ON DELETE CASCADE,
          status VARCHAR(50) DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          metrics JSONB DEFAULT '{}',
          config JSONB DEFAULT '{}',
          error_message TEXT,
          start_time TIMESTAMP,
          end_time TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create evaluation_tasks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS evaluation_tasks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          evaluation_id UUID REFERENCES evaluations(id) ON DELETE CASCADE,
          task_index INTEGER NOT NULL,
          task_name VARCHAR(255) NOT NULL,
          task_data JSONB NOT NULL,
          result JSONB,
          status VARCHAR(50) DEFAULT 'pending',
          error_message TEXT,
          start_time TIMESTAMP,
          end_time TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_benchmarks_type ON benchmarks(type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_agent_id ON evaluations(agent_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_benchmark_id ON evaluations(benchmark_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_evaluation_tasks_evaluation_id ON evaluation_tasks(evaluation_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_evaluation_tasks_status ON evaluation_tasks(status)');

      // Create JSONB indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_agents_capabilities ON agents USING GIN(capabilities)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_evaluations_metrics ON evaluations USING GIN(metrics)');

      await client.query('COMMIT');
      logger.info('Test database schema created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create test database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed test database with sample data
   */
  async seedTestData(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Seed users
      await client.query(`
        INSERT INTO users (id, email, password_hash, full_name, role) VALUES
          ('550e8400-e29b-41d4-a716-446655440001', 'admin@test.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Admin User', 'admin'),
          ('550e8400-e29b-41d4-a716-446655440002', 'user@test.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Test User', 'user'),
          ('550e8400-e29b-41d4-a716-446655440003', 'evaluator@test.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Evaluator User', 'evaluator')
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed agents
      await client.query(`
        INSERT INTO agents (id, name, type, status, capabilities, performance, last_active) VALUES
          ('660e8400-e29b-41d4-a716-446655440001', 'SWE-Agent-v1', 'swe', 'active',
           '["code-generation", "debugging", "test-writing"]'::jsonb,
           '{"taskSuccessRate": 0.85, "executionTime": 1200, "latencyPerStep": 150}'::jsonb,
           NOW()),
          ('660e8400-e29b-41d4-a716-446655440002', 'GUI-Agent-v1', 'gui', 'active',
           '["automation", "visual-recognition", "interaction"]'::jsonb,
           '{"taskSuccessRate": 0.78, "executionTime": 2400, "latencyPerStep": 300}'::jsonb,
           NOW()),
          ('660e8400-e29b-41d4-a716-446655440003', 'General-Agent-v1', 'general', 'inactive',
           '["reasoning", "planning", "execution"]'::jsonb,
           '{"taskSuccessRate": 0.72, "executionTime": 1800, "latencyPerStep": 200}'::jsonb,
           NOW() - INTERVAL '1 day')
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed benchmarks
      await client.query(`
        INSERT INTO benchmarks (id, name, type, description, difficulty, total_tasks, completed_tasks, is_active) VALUES
          ('770e8400-e29b-41d4-a716-446655440001', 'SWE-Bench-Test', 'swe-bench',
           'Software engineering benchmark test dataset', 'medium', 50, 45, true),
          ('770e8400-e29b-41d4-a716-446655440002', 'GAIA-Test', 'gaia',
           'General AI assistant benchmark test', 'hard', 30, 25, true),
          ('770e8400-e29b-41d4-a716-446655440003', 'OSWorld-Test', 'osworld',
           'Operating system world benchmark test', 'medium', 40, 35, true),
          ('770e8400-e29b-41d4-a716-446655440004', 'WebArena-Test', 'webarena',
           'Web automation arena benchmark test', 'medium', 25, 20, false)
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed evaluations
      await client.query(`
        INSERT INTO evaluations (id, agent_id, benchmark_id, status, progress, metrics, start_time, end_time) VALUES
          ('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001',
           'completed', 100,
           '{"taskSuccessRate": 0.85, "executionTime": 1200, "totalTokens": 2500, "estimatedCost": 0.025}'::jsonb,
           NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
          ('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002',
           'running', 65,
           '{"taskSuccessRate": 0.78, "executionTime": 1800, "totalTokens": 1800, "estimatedCost": 0.018}'::jsonb,
           NOW() - INTERVAL '30 minutes', NULL),
          ('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003',
           'pending', 0, '{}'::jsonb, NULL, NULL)
        ON CONFLICT (id) DO NOTHING
      `);

      // Seed evaluation tasks
      await client.query(`
        INSERT INTO evaluation_tasks (id, evaluation_id, task_index, task_name, task_data, result, status) VALUES
          ('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 1, 'Fix login bug',
           '{"repository": "test-repo", "issue": "Login fails on mobile", "difficulty": "medium"}'::jsonb,
           '{"status": "fixed", "changes": 15, "tests_added": 3}'::jsonb, 'completed'),
          ('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440001', 2, 'Add search feature',
           '{"repository": "test-repo", "requirement": "Implement full-text search", "difficulty": "hard"}'::jsonb,
           '{"status": "implemented", "changes": 25, "tests_added": 5}'::jsonb, 'completed'),
          ('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440002', 1, 'Navigate to settings',
           '{"website": "test-site.com", "goal": "Find and click settings button", "difficulty": "easy"}'::jsonb,
           NULL, 'pending')
        ON CONFLICT (id) DO NOTHING
      `);

      await client.query('COMMIT');
      logger.info('Test database seeded successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to seed test database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean all test data
   */
  async cleanup(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Delete data in correct order respecting foreign key constraints
      await client.query('DELETE FROM evaluation_tasks');
      await client.query('DELETE FROM evaluations');
      await client.query('DELETE FROM agents');
      await client.query('DELETE FROM benchmarks');
      await client.query('DELETE FROM users');

      logger.info('Test database cleaned successfully');
    } catch (error) {
      logger.error('Failed to clean test database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Drop all tables (for complete reset)
   */
  async dropAllTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Drop tables in reverse order of creation
      await client.query('DROP TABLE IF EXISTS evaluation_tasks CASCADE');
      await client.query('DROP TABLE IF EXISTS evaluations CASCADE');
      await client.query('DROP TABLE IF EXISTS agents CASCADE');
      await client.query('DROP TABLE IF EXISTS benchmarks CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');

      await client.query('COMMIT');
      logger.info('All test tables dropped successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to drop test tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.isConnected) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Test database connection closed');
    }
  }

  /**
   * Get database connection
   */
  async getClient(): Promise<PoolClient> {
    if (!this.isConnected) {
      await this.initialize();
    }
    return this.pool.connect();
  }

  /**
   * Health check for test database
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT 1 as health_check');
      client.release();
      return result.rows[0].health_check === 1;
    } catch (error) {
      logger.error('Test database health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const testDatabase = new TestDatabaseSetup();