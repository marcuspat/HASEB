import { db } from '../connection';
import { Evaluation, EvaluationMetrics } from '../../types/index';

export class EvaluationModel {
  static async create(evaluationData: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Evaluation> {
    const query = `
      INSERT INTO evaluations (agent_id, benchmark_id, status, configuration, logs, metrics, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, agent_id, benchmark_id, status, configuration, logs, metrics, start_time, end_time, created_at, updated_at
    `;

    const result = await db.query(
      query,
      [
        evaluationData.agentId,
        evaluationData.benchmarkId,
        evaluationData.status,
        JSON.stringify(evaluationData.configuration),
        JSON.stringify(evaluationData.logs),
        evaluationData.metrics ? JSON.stringify(evaluationData.metrics) : null,
        evaluationData.startTime,
        evaluationData.endTime
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findById(id: string): Promise<Evaluation | null> {
    const query = 'SELECT * FROM evaluations WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findByAgentId(agentId: string, page = 1, limit = 20): Promise<{ evaluations: Evaluation[], total: number }> {
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) FROM evaluations WHERE agent_id = $1';
    const countResult = await db.query(countQuery, [agentId]);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, agent_id, benchmark_id, status, configuration, logs, metrics, start_time, end_time, created_at, updated_at
      FROM evaluations
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [agentId, limit, offset]);

    const evaluations = result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { evaluations, total };
  }

  static async findByBenchmarkId(benchmarkId: string, page = 1, limit = 20): Promise<{ evaluations: Evaluation[], total: number }> {
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) FROM evaluations WHERE benchmark_id = $1';
    const countResult = await db.query(countQuery, [benchmarkId]);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, agent_id, benchmark_id, status, configuration, logs, metrics, start_time, end_time, created_at, updated_at
      FROM evaluations
      WHERE benchmark_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [benchmarkId, limit, offset]);

    const evaluations = result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { evaluations, total };
  }

  static async findByStatus(status: Evaluation['status'], page = 1, limit = 20): Promise<{ evaluations: Evaluation[], total: number }> {
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) FROM evaluations WHERE status = $1';
    const countResult = await db.query(countQuery, [status]);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, agent_id, benchmark_id, status, configuration, logs, metrics, start_time, end_time, created_at, updated_at
      FROM evaluations
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [status, limit, offset]);

    const evaluations = result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { evaluations, total };
  }

  static async list(page = 1, limit = 20, agentId?: string, benchmarkId?: string, status?: string): Promise<{ evaluations: Evaluation[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      whereClause += ` AND agent_id = $${paramIndex++}`;
      params.push(agentId);
    }
    if (benchmarkId) {
      whereClause += ` AND benchmark_id = $${paramIndex++}`;
      params.push(benchmarkId);
    }
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM evaluations ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, agent_id, benchmark_id, status, configuration, logs, metrics, start_time, end_time, created_at, updated_at
      FROM evaluations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);

    const evaluations = result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { evaluations, total };
  }

  static async updateStatus(id: string, status: Evaluation['status']): Promise<boolean> {
    const query = `
      UPDATE evaluations
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [status, id]);
    return result.rowCount! > 0;
  }

  static async updateStatusWithTime(id: string, status: Evaluation['status'], startTime?: Date, endTime?: Date): Promise<boolean> {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (startTime) {
      fields.push(`start_time = $${paramIndex++}`);
      values.push(startTime);
    }
    if (endTime) {
      fields.push(`end_time = $${paramIndex++}`);
      values.push(endTime);
    }

    values.push(id);

    const query = `
      UPDATE evaluations
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    const result = await db.query(query, values);
    return result.rowCount! > 0;
  }

  static async addLog(id: string, log: string): Promise<boolean> {
    const query = `
      UPDATE evaluations
      SET logs = logs || $1::jsonb, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [JSON.stringify(log), id]);
    return result.rowCount! > 0;
  }

  static async addLogs(id: string, logs: string[]): Promise<boolean> {
    const query = `
      UPDATE evaluations
      SET logs = logs || $1::jsonb, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [JSON.stringify(logs), id]);
    return result.rowCount! > 0;
  }

  static async updateMetrics(id: string, metrics: EvaluationMetrics): Promise<boolean> {
    const query = `
      UPDATE evaluations
      SET metrics = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [JSON.stringify(metrics), id]);
    return result.rowCount! > 0;
  }

  static async getRunningEvaluations(): Promise<Evaluation[]> {
    const query = 'SELECT * FROM evaluations WHERE status = $1 ORDER BY created_at ASC';
    const result = await db.query(query, ['running']);

    return result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      benchmarkId: row.benchmark_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      metrics: row.metrics,
      logs: row.logs,
      configuration: row.configuration,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async getAverageMetrics(agentId?: string, benchmarkId?: string, days = 30): Promise<any> {
    let whereClause = 'WHERE created_at >= NOW() - INTERVAL \'30 days\'';
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      whereClause += ` AND agent_id = $${paramIndex++}`;
      params.push(agentId);
    }
    if (benchmarkId) {
      whereClause += ` AND benchmark_id = $${paramIndex++}`;
      params.push(benchmarkId);
    }

    const query = `
      SELECT
        AVG((metrics->>'performance')::json->>'taskSuccessRate'::float) as avg_success_rate,
        AVG((metrics->>'efficiency')::json->>'executionTime'::float) as avg_execution_time,
        AVG((metrics->>'cost')::json->>'estimatedCost'::float) as avg_cost,
        COUNT(*) as total_evaluations
      FROM evaluations
      ${whereClause}
      AND status = 'completed'
      AND metrics IS NOT NULL
    `;

    const result = await db.query(query, params);
    return result.rows[0];
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM evaluations WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount! > 0;
  }
}