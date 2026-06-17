import { db } from './connection';

export const migrations = [
  {
    version: '001',
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_username ON users(username);
      CREATE INDEX idx_users_role ON users(role);
    `,
    down: `
      DROP TABLE IF EXISTS users;
    `,
  },
  {
    version: '002',
    name: 'create_agents_table',
    up: `
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('swe', 'gui', 'general', 'orchestrator')),
        description TEXT,
        capabilities JSONB DEFAULT '[]',
        configuration JSONB DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'training', 'error')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_agents_type ON agents(type);
      CREATE INDEX idx_agents_status ON agents(status);
      CREATE INDEX idx_agents_capabilities ON agents USING GIN(capabilities);
    `,
    down: `
      DROP TABLE IF EXISTS agents;
    `,
  },
  {
    version: '003',
    name: 'create_benchmarks_table',
    up: `
      CREATE TABLE IF NOT EXISTS benchmarks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('swe-bench', 'gaia', 'osworld', 'webarena', 'agentbench', 'custom')),
        description TEXT,
        dataset VARCHAR(255) NOT NULL,
        evaluation_criteria JSONB DEFAULT '[]',
        configuration JSONB DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_benchmarks_type ON benchmarks(type);
      CREATE INDEX idx_benchmarks_active ON benchmarks(is_active);
      CREATE INDEX idx_benchmarks_dataset ON benchmarks(dataset);
    `,
    down: `
      DROP TABLE IF EXISTS benchmarks;
    `,
  },
  {
    version: '004',
    name: 'create_evaluations_table',
    up: `
      CREATE TABLE IF NOT EXISTS evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        metrics JSONB,
        logs JSONB DEFAULT '[]',
        configuration JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_evaluations_agent_id ON evaluations(agent_id);
      CREATE INDEX idx_evaluations_benchmark_id ON evaluations(benchmark_id);
      CREATE INDEX idx_evaluations_status ON evaluations(status);
      CREATE INDEX idx_evaluations_created_at ON evaluations(created_at);
      CREATE INDEX idx_evaluations_metrics ON evaluations USING GIN(metrics);
    `,
    down: `
      DROP TABLE IF EXISTS evaluations;
    `,
  },
  {
    version: '005',
    name: 'create_tasks_table',
    up: `
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        description TEXT,
        input JSONB,
        expected_output JSONB,
        actual_output JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        execution_time INTEGER, -- in milliseconds
        tokens_used INTEGER DEFAULT 0,
        errors JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_tasks_evaluation_id ON tasks(evaluation_id);
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_type ON tasks(type);
      CREATE INDEX idx_tasks_execution_time ON tasks(execution_time);
    `,
    down: `
      DROP TABLE IF EXISTS tasks;
    `,
  },
  {
    version: '006',
    name: 'create_evaluation_states_table',
    up: `
      CREATE TABLE IF NOT EXISTS evaluation_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
        step VARCHAR(20) NOT NULL CHECK (step IN ('setup', 'execute', 'collect', 'analyze', 'teardown')),
        data JSONB DEFAULT '{}',
        errors JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_evaluation_states_evaluation_id ON evaluation_states(evaluation_id);
      CREATE INDEX idx_evaluation_states_step ON evaluation_states(step);
    `,
    down: `
      DROP TABLE IF EXISTS evaluation_states;
    `,
  },
  {
    version: '007',
    name: 'create_migration_tracking_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
    down: `
      DROP TABLE IF EXISTS migrations;
    `,
  },
];

export class MigrationManager {
  static async initialize(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }

  static async getAppliedMigrations(): Promise<string[]> {
    const result = await db.query('SELECT version FROM migrations ORDER BY version');
    return result.rows.map((row: any) => row.version);
  }

  static async applyMigration(migration: typeof migrations[0]): Promise<void> {
    await db.transaction(async (client) => {
      await client.query(migration.up);
      await client.query(
        'INSERT INTO migrations (version, name) VALUES ($1, $2)',
        [migration.version, migration.name]
      );
    });
  }

  static async rollbackMigration(migration: typeof migrations[0]): Promise<void> {
    await db.transaction(async (client) => {
      await client.query(migration.down);
      await client.query('DELETE FROM migrations WHERE version = $1', [migration.version]);
    });
  }

  static async migrate(): Promise<void> {
    await this.initialize();
    const applied = await this.getAppliedMigrations();
    const pending = migrations.filter(m => !applied.includes(m.version));

    for (const migration of pending) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      await this.applyMigration(migration);
      console.log(`Migration ${migration.version} applied successfully`);
    }

    if (pending.length === 0) {
      console.log('No pending migrations');
    }
  }

  static async rollback(targetVersion?: string): Promise<void> {
    await this.initialize();
    const applied = await this.getAppliedMigrations();
    let toRollback: typeof migrations;

    if (targetVersion) {
      const targetIndex = applied.indexOf(targetVersion);
      if (targetIndex === -1) {
        throw new Error(`Version ${targetVersion} not found in applied migrations`);
      }
      toRollback = migrations.filter(m =>
        applied.includes(m.version) && applied.indexOf(m.version) > targetIndex
      );
    } else {
      // Rollback last migration
      const lastApplied = applied[applied.length - 1];
      if (!lastApplied) {
        console.log('No migrations to rollback');
        return;
      }
      toRollback = [migrations.find(m => m.version === lastApplied)!];
    }

    // Rollback in reverse order
    for (const migration of toRollback.reverse()) {
      console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
      await this.rollbackMigration(migration);
      console.log(`Migration ${migration.version} rolled back successfully`);
    }
  }

  static async status(): Promise<void> {
    await this.initialize();
    const applied = await this.getAppliedMigrations();
    const pending = migrations.filter(m => !applied.includes(m.version));

    console.log('\n=== Migration Status ===');
    console.log('Applied migrations:');
    applied.forEach(version => {
      const migration = migrations.find(m => m.version === version);
      console.log(`  ✓ ${version}: ${migration?.name}`);
    });

    if (pending.length > 0) {
      console.log('\nPending migrations:');
      pending.forEach(migration => {
        console.log(`  ○ ${migration.version}: ${migration.name}`);
      });
    } else {
      console.log('\nNo pending migrations');
    }
    console.log('========================\n');
  }
}