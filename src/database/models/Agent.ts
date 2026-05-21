import { db } from '../connection';
import { Agent } from '../../types/index';

export class AgentModel {
  static async create(agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const query = `
      INSERT INTO agents (name, type, description, capabilities, configuration, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, type, description, capabilities, configuration, status, created_at, updated_at
    `;

    const result = await db.query(
      query,
      [
        agentData.name,
        agentData.type,
        agentData.description ?? null,
        JSON.stringify(agentData.capabilities ?? []),
        JSON.stringify(agentData.configuration ?? {}),
        agentData.status ?? 'inactive'
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findById(id: string): Promise<Agent | null> {
    const query = 'SELECT * FROM agents WHERE id = $1';
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
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findByType(type: Agent['type']): Promise<Agent[]> {
    const query = 'SELECT * FROM agents WHERE type = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [type]);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async findByStatus(status: Agent['status']): Promise<Agent[]> {
    const query = 'SELECT * FROM agents WHERE status = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [status]);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async findByCapability(capability: string): Promise<Agent[]> {
    const query = `
      SELECT * FROM agents
      WHERE capabilities @> $1::jsonb
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [JSON.stringify([capability])]);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async list(page = 1, limit = 20, type?: string, status?: string): Promise<{ agents: Agent[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      params.push(type);
    }
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM agents ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at
      FROM agents
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);

    const agents = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { agents, total };
  }

  static async update(id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Agent | null> {
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
    if (updates.capabilities !== undefined) {
      fields.push(`capabilities = $${paramIndex++}`);
      values.push(JSON.stringify(updates.capabilities));
    }
    if (updates.configuration !== undefined) {
      fields.push(`configuration = $${paramIndex++}`);
      values.push(JSON.stringify(updates.configuration));
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE agents
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, type, description, capabilities, configuration, status, created_at, updated_at
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
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async updateStatus(id: string, status: Agent['status']): Promise<boolean> {
    const query = `
      UPDATE agents
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [status, id]);
    return result.rowCount! > 0;
  }

  static async updateConfiguration(id: string, configuration: Record<string, any>): Promise<boolean> {
    const query = `
      UPDATE agents
      SET configuration = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await db.query(query, [JSON.stringify(configuration), id]);
    return result.rowCount! > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM agents WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount! > 0;
  }

  static async getActiveAgents(): Promise<Agent[]> {
    const query = 'SELECT * FROM agents WHERE status = $1 ORDER BY created_at DESC';
    const result = await db.query(query, ['active']);

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  static async search(query: string, page = 1, limit = 20): Promise<{ agents: Agent[], total: number }> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    const countQuery = `
      SELECT COUNT(*) FROM agents
      WHERE name ILIKE $1 OR description ILIKE $1
    `;
    const countResult = await db.query(countQuery, [searchPattern]);
    const total = parseInt(countResult.rows[0].count);

    const searchQuery = `
      SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at
      FROM agents
      WHERE name ILIKE $1 OR description ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(searchQuery, [searchPattern, limit, offset]);

    const agents = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      capabilities: row.capabilities,
      configuration: row.configuration,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { agents, total };
  }

  static async getAgentMetrics(agentId: string): Promise<{
    totalEvaluations: number;
    completedEvaluations: number;
    runningEvaluations: number;
    avgTaskSuccessRate: number | null;
  }> {
    const query = `
      SELECT
        COUNT(*)::int AS total_evaluations,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_evaluations,
        COUNT(*) FILTER (WHERE status = 'running')::int AS running_evaluations,
        AVG((metrics->>'taskSuccessRate')::float) AS avg_task_success_rate
      FROM evaluations
      WHERE agent_id = $1
    `;

    const result = await db.query(query, [agentId]);
    const row = result.rows[0];

    return {
      totalEvaluations: row.total_evaluations,
      completedEvaluations: row.completed_evaluations,
      runningEvaluations: row.running_evaluations,
      avgTaskSuccessRate: row.avg_task_success_rate !== null ? parseFloat(row.avg_task_success_rate) : null,
    };
  }
}