import { Pool, PoolClient, QueryResult } from 'pg';
import sqlite3 from 'sqlite3';
import { DatabaseConfig } from '../types/index';
import { logger } from '../utils/logger';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool?: Pool;
  private db?: sqlite3.Database;
  private config: DatabaseConfig;
  private isSqlite: boolean;

  private constructor(config: DatabaseConfig) {
    this.config = config;
    this.isSqlite = config.type === 'sqlite';

    if (this.isSqlite) {
      // SQLite setup
      const dbPath = config.file || config.database;
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('SQLite connection error:', err);
        } else {
          logger.info('SQLite database connected');
          // Enable foreign keys
          this.db!.run('PRAGMA foreign_keys = ON');
        }
      });
    } else {
      // PostgreSQL setup
      this.pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl,
        max: config.maxConnections || 20,
        idleTimeoutMillis: config.idleTimeoutMs || 30000,
        connectionTimeoutMillis: 2000,
      });

      // Handle pool errors
      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
      });

      // Log connection events
      this.pool.on('connect', (client) => {
        logger.debug('New database client connected');
      });

      this.pool.on('remove', (client) => {
        logger.debug('Database client removed');
      });
    }
  }

  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      if (!config) {
        throw new Error('Database configuration required for first initialization');
      }
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  public async query<T = any>(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      if (this.isSqlite) {
        // SQLite query execution
        return new Promise((resolve, reject) => {
          const stmt = this.db!.prepare(text);

          if (params && params.length > 0) {
            stmt.all(params, (err, rows) => {
              if (err) {
                const duration = Date.now() - start;
                logger.error('SQLite query failed', {
                  query: text,
                  duration: `${duration}ms`,
                  error: err.message,
                });
                reject(err);
              } else {
                const duration = Date.now() - start;
                logger.debug('SQLite query executed', {
                  query: text,
                  duration: `${duration}ms`,
                  rows: rows ? rows.length : 0,
                });
                resolve({
                  rows: rows || [],
                  rowCount: rows ? rows.length : 0,
                });
              }
            });
          } else {
            stmt.all((err, rows) => {
              if (err) {
                const duration = Date.now() - start;
                logger.error('SQLite query failed', {
                  query: text,
                  duration: `${duration}ms`,
                  error: err.message,
                });
                reject(err);
              } else {
                const duration = Date.now() - start;
                logger.debug('SQLite query executed', {
                  query: text,
                  duration: `${duration}ms`,
                  rows: rows ? rows.length : 0,
                });
                resolve({
                  rows: rows || [],
                  rowCount: rows ? rows.length : 0,
                });
              }
            });
          }

          stmt.finalize();
        });
      } else {
        // PostgreSQL query execution
        const result = await this.pool!.query<T>(text, params);
        const duration = Date.now() - start;

        logger.debug('PostgreSQL query executed', {
          query: text,
          duration: `${duration}ms`,
          rows: result.rowCount,
        });

        return result;
      }
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', {
        query: text,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  public async getClient(): Promise<any> {
    if (this.isSqlite) {
      return this.db;
    } else {
      return this.pool!.connect();
    }
  }

  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    if (this.isSqlite) {
      return new Promise((resolve, reject) => {
        this.db!.serialize(() => {
          this.db!.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              reject(err);
              return;
            }

            const transactionCallback = async () => {
              try {
                const result = await callback(this.db!);
                this.db!.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    resolve(result);
                  }
                });
              } catch (error) {
                this.db!.run('ROLLBACK', (rollbackErr) => {
                  if (rollbackErr) {
                    logger.error('Rollback error:', rollbackErr);
                  }
                  reject(error);
                });
              }
            };

            transactionCallback();
          });
        });
      });
    } else {
      const client = await this.getClient();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.isSqlite) {
      return new Promise((resolve) => {
        this.db!.close((err) => {
          if (err) {
            logger.error('Error closing SQLite database:', err);
          } else {
            logger.info('SQLite database connection closed');
          }
          resolve();
        });
      });
    } else {
      await this.pool!.end();
      logger.info('PostgreSQL connection pool closed');
    }
  }

  public getPoolStats() {
    if (this.isSqlite) {
      return {
        type: 'SQLite',
        connected: !!this.db,
      };
    } else {
      return {
        type: 'PostgreSQL',
        totalCount: this.pool!.totalCount,
        idleCount: this.pool!.idleCount,
        waitingCount: this.pool!.waitingCount,
      };
    }
  }
}

// Determine database type from environment
const dbType = (process.env.DB_TYPE || 'postgresql').toLowerCase();

export const db = DatabaseConnection.getInstance({
  type: dbType as 'postgresql' | 'sqlite',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'haseb',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  file: process.env.DB_FILE || './test-db/haseb.db', // SQLite file path
});