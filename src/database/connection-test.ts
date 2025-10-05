import { DatabaseConfig } from '../types/index';
import { logger } from '../utils/logger';

// Simple in-memory database for testing
export class TestDatabaseConnection {
  private static instance: TestDatabaseConnection;
  private data: Map<string, any[]> = new Map();
  private nextId: number = 1;

  private constructor() {
    // Initialize with empty tables
    this.data.set('users', []);
    this.data.set('agents', []);
    this.data.set('benchmarks', []);
    this.data.set('evaluations', []);
    this.data.set('metrics', []);

    logger.info('Test database initialized with in-memory storage');
  }

  public static getInstance(): TestDatabaseConnection {
    if (!TestDatabaseConnection.instance) {
      TestDatabaseConnection.instance = new TestDatabaseConnection();
    }
    return TestDatabaseConnection.instance;
  }

  public async query<T = any>(text: string, params?: any[]): Promise<any> {
    const start = Date.now();

    // Simple query parsing for basic operations
    const lowerText = text.toLowerCase().trim();

    try {
      let result: any = { rows: [], rowCount: 0 };

      if (lowerText.startsWith('select')) {
        // Simple SELECT handling
        if (lowerText.includes('count')) {
          result.rows = [{ count: this.getTotalRows(lowerText) }];
          result.rowCount = 1;
        } else {
          result.rows = this.selectRows(lowerText, params);
          result.rowCount = result.rows.length;
        }
      } else if (lowerText.startsWith('insert')) {
        const tableName = this.extractTableName(lowerText);
        const table = this.data.get(tableName) || [];
        const newRow = { id: this.nextId++, ...params };
        table.push(newRow);
        this.data.set(tableName, table);
        result.rows = [newRow];
        result.rowCount = 1;
      } else if (lowerText.startsWith('update')) {
        result.rows = this.updateRows(lowerText, params);
        result.rowCount = result.rows.length;
      } else if (lowerText.startsWith('delete')) {
        result.rowCount = this.deleteRows(lowerText, params);
        result.rows = [];
      } else if (lowerText.startsWith('create table')) {
        // Table creation - just initialize empty array
        const tableName = this.extractTableName(lowerText);
        this.data.set(tableName, []);
        result.rows = [];
        result.rowCount = 0;
      } else if (lowerText.startsWith('begin')) {
        result.rows = [];
        result.rowCount = 0;
      } else if (lowerText.startsWith('commit')) {
        result.rows = [];
        result.rowCount = 0;
      } else if (lowerText.startsWith('rollback')) {
        result.rows = [];
        result.rowCount = 0;
      }

      const duration = Date.now() - start;
      logger.debug('Test query executed', {
        query: text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Test query failed', {
        query: text,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  public async getClient(): Promise<any> {
    return {
      query: this.query.bind(this),
      release: () => {}
    };
  }

  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
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

  public async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      logger.info('Test database connection successful');
      return true;
    } catch (error) {
      logger.error('Test database connection failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    this.data.clear();
    logger.info('Test database connection closed');
  }

  public getPoolStats() {
    return {
      totalCount: 1,
      idleCount: 1,
      waitingCount: 0,
    };
  }

  // Helper methods
  private extractTableName(query: string): string {
    const match = query.match(/(?:from|into|table)\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  private getTotalRows(query: string): number {
    const tableName = this.extractTableName(query);
    const table = this.data.get(tableName) || [];
    return table.length;
  }

  private selectRows(query: string, params?: any[]): any[] {
    const tableName = this.extractTableName(query);
    const table = this.data.get(tableName) || [];

    // Simple WHERE clause handling
    if (params && params.length > 0) {
      return table.filter(row => row.id === params[0]);
    }

    return table;
  }

  private updateRows(query: string, params?: any[]): any[] {
    const tableName = this.extractTableName(query);
    const table = this.data.get(tableName) || [];

    if (params && params.length >= 2) {
      const id = params[1];
      const updates = params[0];

      const index = table.findIndex(row => row.id === id);
      if (index !== -1) {
        table[index] = { ...table[index], ...updates };
        this.data.set(tableName, table);
        return [table[index]];
      }
    }

    return [];
  }

  private deleteRows(query: string, params?: any[]): number {
    const tableName = this.extractTableName(query);
    const table = this.data.get(tableName) || [];

    if (params && params.length > 0) {
      const id = params[0];
      const initialLength = table.length;
      const filteredTable = table.filter(row => row.id !== id);
      this.data.set(tableName, filteredTable);
      return initialLength - filteredTable.length;
    }

    return 0;
  }
}

export const testDb = TestDatabaseConnection.getInstance();