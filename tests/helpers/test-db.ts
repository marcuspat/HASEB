import { DatabaseConnection } from '../../src/database/connection';
import { MigrationManager } from '../../src/database/migrations';
import { logger } from '../../src/utils/logger';

export class TestDatabase {
  private static instance: TestDatabase;
  private db: DatabaseConnection;

  private constructor() {
    this.db = new (DatabaseConnection as any)({
      host: process.env.DB_HOST_TEST || 'localhost',
      port: parseInt(process.env.DB_PORT_TEST || '5432'),
      database: process.env.DB_NAME_TEST || 'haseb_test',
      username: process.env.DB_USER_TEST || 'postgres',
      password: process.env.DB_PASSWORD_TEST || 'password',
      ssl: false,
      maxConnections: 5,
      idleTimeoutMs: 30000,
    });
  }

  public static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Test connection
      const connected = await this.db.testConnection();
      if (!connected) {
        throw new Error('Failed to connect to test database');
      }

      // Run migrations
      await MigrationManager.migrate();
      logger.info('Test database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      // Order respects FK constraints: child tables first
      const tables = [
        'tasks',
        'metric_sets',
        'evaluation_states',
        'evaluations',
        'agents',
        'benchmarks',
        'users',
      ];

      for (const table of tables) {
        await this.db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      }

      logger.info('Test database cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup test database:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.db.close();
  }

  public getDb(): DatabaseConnection {
    return this.db;
  }

  public async seedTestData(): Promise<void> {
    try {
      // Seed test data
      await this.seedUsers();
      await this.seedAgents();
      await this.seedBenchmarks();
      await this.seedEvaluations();

      logger.info('Test data seeded successfully');
    } catch (error) {
      logger.error('Failed to seed test data:', error);
      throw error;
    }
  }

  private async seedUsers(): Promise<void> {
    const users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        username: 'testadmin',
        full_name: 'Test Admin',
        password_hash: 'hashed_password',
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'user@example.com',
        username: 'testuser',
        full_name: 'Test User',
        password_hash: 'hashed_password',
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const user of users) {
      await this.db.query(`
        INSERT INTO users (id, email, username, full_name, password_hash, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [user.id, user.email, user.username, user.full_name, user.password_hash, user.role, user.created_at, user.updated_at]);
    }
  }

  private async seedAgents(): Promise<void> {
    const agents = [
      {
        id: '00000000-0000-0000-0000-000000000011',
        name: 'Code Master',
        type: 'swe',
        status: 'active',
        description: 'Expert software engineering agent',
        capabilities: ['code-generation', 'debugging', 'testing'],
        configuration: { language: 'typescript' },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '00000000-0000-0000-0000-000000000012',
        name: 'GUI Navigator',
        type: 'gui',
        status: 'active',
        description: 'GUI automation specialist',
        capabilities: ['web-automation', 'mobile-automation'],
        configuration: { browser: 'chromium' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const agent of agents) {
      await this.db.query(`
        INSERT INTO agents (id, name, type, status, description, capabilities, configuration, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        agent.id,
        agent.name,
        agent.type,
        agent.status,
        agent.description,
        JSON.stringify(agent.capabilities),
        JSON.stringify(agent.configuration),
        agent.created_at,
        agent.updated_at,
      ]);
    }
  }

  private async seedBenchmarks(): Promise<void> {
    const benchmarks = [
      {
        id: '00000000-0000-0000-0000-000000000021',
        name: 'SWE-Bench Lite',
        type: 'swe-bench',
        description: 'Lightweight software engineering benchmark',
        dataset: 'swe-bench-lite-v1',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '00000000-0000-0000-0000-000000000022',
        name: 'GUI Test Suite',
        type: 'osworld',
        description: 'GUI automation testing benchmark',
        dataset: 'osworld-v1',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const benchmark of benchmarks) {
      await this.db.query(`
        INSERT INTO benchmarks (id, name, type, description, dataset, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        benchmark.id,
        benchmark.name,
        benchmark.type,
        benchmark.description,
        benchmark.dataset,
        benchmark.is_active,
        benchmark.created_at,
        benchmark.updated_at,
      ]);
    }
  }

  private async seedEvaluations(): Promise<void> {
    const evaluations = [
      {
        id: '00000000-0000-0000-0000-000000000031',
        agent_id: '00000000-0000-0000-0000-000000000011',
        benchmark_id: '00000000-0000-0000-0000-000000000021',
        status: 'completed',
        metrics: {
          taskSuccessRate: 0.92,
          executionTime: 1800,
          latencyPerStep: 150,
          totalSteps: 12,
          totalTokens: 3000,
          estimatedCost: 0.03,
          toolCallErrorRate: 0.05,
          recoveryRate: 0.98,
          toolSelectionAccuracy: 0.95,
          parameterAccuracy: 0.91,
        },
        start_time: new Date(Date.now() - 3600000),
        end_time: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const evaluation of evaluations) {
      await this.db.query(`
        INSERT INTO evaluations (id, agent_id, benchmark_id, status, metrics, start_time, end_time, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        evaluation.id,
        evaluation.agent_id,
        evaluation.benchmark_id,
        evaluation.status,
        JSON.stringify(evaluation.metrics),
        evaluation.start_time,
        evaluation.end_time,
        evaluation.created_at,
        evaluation.updated_at,
      ]);
    }
  }
}