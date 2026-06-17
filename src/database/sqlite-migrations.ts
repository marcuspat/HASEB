import { db } from './connection';

export const sqliteMigrations = [
  {
    version: '001',
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('swe', 'gui', 'general', 'orchestrator')),
        description TEXT,
        capabilities TEXT DEFAULT '[]',
        configuration TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'training', 'error')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_agents_type ON agents(type);
      CREATE INDEX idx_agents_status ON agents(status);
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
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('swe-bench', 'gaia', 'osworld', 'webarena', 'agentbench', 'custom')),
        description TEXT,
        dataset TEXT NOT NULL,
        evaluation_criteria TEXT DEFAULT '[]',
        configuration TEXT DEFAULT '{}',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        agent_id TEXT NOT NULL,
        benchmark_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        start_time DATETIME,
        end_time DATETIME,
        metrics TEXT,
        logs TEXT DEFAULT '[]',
        configuration TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_evaluations_agent_id ON evaluations(agent_id);
      CREATE INDEX idx_evaluations_benchmark_id ON evaluations(benchmark_id);
      CREATE INDEX idx_evaluations_status ON evaluations(status);
      CREATE INDEX idx_evaluations_created_at ON evaluations(created_at);
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
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        evaluation_id TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        input TEXT,
        expected_output TEXT,
        actual_output TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        execution_time INTEGER,
        tokens_used INTEGER DEFAULT 0,
        errors TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
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
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        evaluation_id TEXT NOT NULL,
        step TEXT NOT NULL CHECK (step IN ('setup', 'execute', 'collect', 'analyze', 'teardown')),
        data TEXT DEFAULT '{}',
        errors TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
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
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,
    down: `
      DROP TABLE IF EXISTS migrations;
    `,
  },
  {
    version: '008',
    name: 'create_benchmark_tasks',
    up: `
      CREATE TABLE IF NOT EXISTS benchmark_tasks (
        id TEXT PRIMARY KEY,
        benchmark_id TEXT NOT NULL,
        instance_id TEXT NOT NULL UNIQUE,
        repo TEXT NOT NULL,
        base_commit TEXT NOT NULL,
        problem_statement TEXT NOT NULL,
        hints_text TEXT,
        fail_to_pass TEXT NOT NULL,
        pass_to_fail TEXT NOT NULL,
        difficulty TEXT DEFAULT 'medium',
        version TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_benchmark_tasks_benchmark_id ON benchmark_tasks(benchmark_id);
      CREATE INDEX idx_benchmark_tasks_instance_id ON benchmark_tasks(instance_id);
      CREATE INDEX idx_benchmark_tasks_difficulty ON benchmark_tasks(difficulty);
    `,
    down: `
      DROP TABLE IF EXISTS benchmark_tasks;
    `,
  },
  {
    version: '009',
    name: 'create_execution_jobs',
    up: `
      CREATE TABLE IF NOT EXISTS execution_jobs (
        id TEXT PRIMARY KEY,
        evaluation_id TEXT NOT NULL,
        benchmark_task_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')),
        agent_patch TEXT,
        result_passed INTEGER,
        result_tests_run INTEGER,
        result_tests_passed INTEGER,
        result_tests_failed INTEGER,
        result_execution_time_ms INTEGER,
        result_stdout TEXT,
        result_stderr TEXT,
        result_error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (benchmark_task_id) REFERENCES benchmark_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_execution_jobs_evaluation_id ON execution_jobs(evaluation_id);
      CREATE INDEX idx_execution_jobs_benchmark_task_id ON execution_jobs(benchmark_task_id);
      CREATE INDEX idx_execution_jobs_agent_id ON execution_jobs(agent_id);
      CREATE INDEX idx_execution_jobs_status ON execution_jobs(status);
    `,
    down: `
      DROP TABLE IF EXISTS execution_jobs;
    `,
  },
  {
    version: '010',
    name: 'create_scores',
    up: `
      CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        evaluation_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        benchmark_id TEXT NOT NULL,
        resolve_rate REAL NOT NULL,
        total_tasks INTEGER NOT NULL,
        resolved_tasks INTEGER NOT NULL DEFAULT 0,
        failed_tasks INTEGER NOT NULL DEFAULT 0,
        timed_out_tasks INTEGER NOT NULL DEFAULT 0,
        avg_execution_time_ms REAL,
        computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(evaluation_id),
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_scores_agent_id ON scores(agent_id);
      CREATE INDEX idx_scores_benchmark_id ON scores(benchmark_id);
      CREATE INDEX idx_scores_resolve_rate ON scores(resolve_rate);
    `,
    down: `
      DROP TABLE IF EXISTS scores;
    `,
  },
  {
    version: '011',
    name: 'create_leaderboard',
    up: `
      CREATE TABLE IF NOT EXISTS leaderboard (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        model_provider TEXT,
        benchmark_id TEXT NOT NULL,
        benchmark_name TEXT NOT NULL,
        resolve_rate REAL NOT NULL,
        rank INTEGER,
        percentile REAL,
        total_tasks INTEGER NOT NULL,
        is_public INTEGER DEFAULT 1,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_id, benchmark_id),
        FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_leaderboard_benchmark_id ON leaderboard(benchmark_id);
      CREATE INDEX idx_leaderboard_resolve_rate ON leaderboard(resolve_rate);
      CREATE INDEX idx_leaderboard_is_public ON leaderboard(is_public);
    `,
    down: `
      DROP TABLE IF EXISTS leaderboard;
    `,
  },
];

export class SqliteMigrationManager {
  static async initialize(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  static async getAppliedMigrations(): Promise<string[]> {
    const result = await db.query('SELECT version FROM migrations ORDER BY version');
    return result.rows.map((row: any) => row.version);
  }

  static async applyMigration(migration: typeof sqliteMigrations[0]): Promise<void> {
    const dbType = (process.env.DB_TYPE || 'postgresql').toLowerCase();
    if (dbType === 'sqlite') {
      // SQLite transaction handling
      await db.transaction(async (sqliteDb: any) => {
        await new Promise<void>((resolve, reject) => {
          sqliteDb.run(migration.up, (migrationErr: any) => {
            if (migrationErr) {
              reject(migrationErr);
              return;
            }
            resolve();
          });
        });

        await new Promise<void>((resolve, reject) => {
          sqliteDb.run(
            'INSERT INTO migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name],
            (insertErr: any) => {
              if (insertErr) {
                reject(insertErr);
                return;
              }
              resolve();
            }
          );
        });
      });
    } else {
      // PostgreSQL transaction handling
      await db.transaction(async (client) => {
        await client.query(migration.up);
        await client.query(
          'INSERT INTO migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
      });
    }
  }

  static async rollbackMigration(migration: typeof sqliteMigrations[0]): Promise<void> {
    const dbType = (process.env.DB_TYPE || 'postgresql').toLowerCase();
    if (dbType === 'sqlite') {
      // SQLite transaction handling
      await db.transaction(async (sqliteDb: any) => {
        await new Promise<void>((resolve, reject) => {
          sqliteDb.run(migration.down, (migrationErr: any) => {
            if (migrationErr) {
              reject(migrationErr);
              return;
            }
            resolve();
          });
        });

        await new Promise<void>((resolve, reject) => {
          sqliteDb.run(
            'DELETE FROM migrations WHERE version = ?',
            [migration.version],
            (deleteErr: any) => {
              if (deleteErr) {
                reject(deleteErr);
                return;
              }
              resolve();
            }
          );
        });
      });
    } else {
      // PostgreSQL transaction handling
      await db.transaction(async (client) => {
        await client.query(migration.down);
        await client.query('DELETE FROM migrations WHERE version = $1', [migration.version]);
      });
    }
  }

  static async migrate(): Promise<void> {
    await this.initialize();
    const applied = await this.getAppliedMigrations();
    const pending = sqliteMigrations.filter(m => !applied.includes(m.version));

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
    let toRollback: typeof sqliteMigrations;

    if (targetVersion) {
      const targetIndex = applied.indexOf(targetVersion);
      if (targetIndex === -1) {
        throw new Error(`Version ${targetVersion} not found in applied migrations`);
      }
      toRollback = sqliteMigrations.filter(m =>
        applied.includes(m.version) && applied.indexOf(m.version) > targetIndex
      );
    } else {
      // Rollback last migration
      const lastApplied = applied[applied.length - 1];
      if (!lastApplied) {
        console.log('No migrations to rollback');
        return;
      }
      toRollback = [sqliteMigrations.find(m => m.version === lastApplied)!];
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
    const pending = sqliteMigrations.filter(m => !applied.includes(m.version));

    console.log('\n=== Migration Status ===');
    console.log('Applied migrations:');
    applied.forEach(version => {
      const migration = sqliteMigrations.find(m => m.version === version);
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