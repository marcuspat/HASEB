import { db } from '../connection';
import { Benchmark } from '../../types/index';

export class BenchmarkModel {
  static async create(benchmarkData: Omit<Benchmark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Benchmark> {
    const query = `
      INSERT INTO benchmarks (name, type, description, dataset, evaluation_criteria, configuration, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, type, description, dataset, evaluation_criteria, configuration, is_active, created_at, updated_at
    `;

    const result = await db.query(
      query,
      [
        benchmarkData.name,
        benchmarkData.type,
        benchmarkData.description,
        benchmarkData.dataset,
        JSON.stringify(benchmarkData.evaluationCriteria),
        JSON.stringify(benchmarkData.configuration),
        benchmarkData.isActive
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findById(id: string): Promise<Benchmark | null> {
    const query = 'SELECT * FROM benchmarks WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findByType(type: Benchmark['type']): Promise<Benchmark[]> {
    const query = 'SELECT * FROM benchmarks WHERE type = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [type]);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async findByDataset(dataset: string): Promise<Benchmark[]> {
    const query = 'SELECT * FROM benchmarks WHERE dataset = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [dataset]);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async getActive(): Promise<Benchmark[]> {
    const query = 'SELECT * FROM benchmarks WHERE is_active = true ORDER BY created_at DESC';
    const result = await db.query(query);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async list(page = 1, limit = 20, type?: string, isActive?: boolean): Promise<{ benchmarks: Benchmark[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      params.push(type);
    }
    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    const countQuery = `SELECT COUNT(*) FROM benchmarks ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, name, type, description, dataset, evaluation_criteria, configuration, is_active, created_at, updated_at
      FROM benchmarks
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);

    const benchmarks = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { benchmarks, total };
  }

  static async update(id: string, updates: Partial<Omit<Benchmark, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Benchmark | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(updates.type);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.dataset !== undefined) {
      fields.push(`dataset = $${paramIndex++}`);
      values.push(updates.dataset);
    }
    if (updates.evaluationCriteria !== undefined) {
      fields.push(`evaluation_criteria = $${paramIndex++}`);
      values.push(JSON.stringify(updates.evaluationCriteria));
    }
    if (updates.configuration !== undefined) {
      fields.push(`configuration = $${paramIndex++}`);
      values.push(JSON.stringify(updates.configuration));
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE benchmarks
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, type, description, dataset, evaluation_criteria, configuration, is_active, created_at, updated_at
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async setActive(id: string, isActive: boolean): Promise<boolean> {
    const query = `
      UPDATE benchmarks
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [isActive, id]);
    return result.rowCount! > 0;
  }

  static async updateConfiguration(id: string, configuration: Record<string, any>): Promise<boolean> {
    const query = `
      UPDATE benchmarks
      SET configuration = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [JSON.stringify(configuration), id]);
    return result.rowCount! > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM benchmarks WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount! > 0;
  }

  static async search(query: string, page = 1, limit = 20): Promise<{ benchmarks: Benchmark[], total: number }> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    const countQuery = `
      SELECT COUNT(*) FROM benchmarks
      WHERE name ILIKE $1 OR description ILIKE $1 OR dataset ILIKE $1
    `;
    const countResult = await db.query(countQuery, [searchPattern]);
    const total = parseInt(countResult.rows[0].count);

    const searchQuery = `
      SELECT id, name, type, description, dataset, evaluation_criteria, configuration, is_active, created_at, updated_at
      FROM benchmarks
      WHERE name ILIKE $1 OR description ILIKE $1 OR dataset ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(searchQuery, [searchPattern, limit, offset]);

    const benchmarks = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      dataset: row.dataset,
      evaluationCriteria: row.evaluation_criteria,
      configuration: row.configuration,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { benchmarks, total };
  }

  static async getTypes(): Promise<string[]> {
    const query = 'SELECT DISTINCT type FROM benchmarks ORDER BY type';
    const result = await db.query(query);
    return result.rows.map((row: any) => row.type);
  }

  static async getDatasets(): Promise<string[]> {
    const query = 'SELECT DISTINCT dataset FROM benchmarks ORDER BY dataset';
    const result = await db.query(query);
    return result.rows.map((row: any) => row.dataset);
  }
}