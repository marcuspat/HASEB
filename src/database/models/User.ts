import { db } from '../connection';
import { User } from '../../types/index';

export class UserModel {
  static async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const query = `
      INSERT INTO users (email, username, full_name, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, username, full_name, role, is_active, created_at, updated_at
    `;

    const result = await db.query(
      query,
      [
        userData.email,
        userData.username,
        userData.fullName,
        // Note: password_hash should be provided already hashed
        '', // placeholder - will be set by authentication service
        userData.role,
        userData.isActive
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    const result = await db.query(query, [username]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async getPasswordHash(id: string): Promise<string | null> {
    const query = 'SELECT password_hash FROM users WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);

    return result.rows.length > 0 ? result.rows[0].password_hash : null;
  }

  static async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      values.push(updates.username);
    }
    if (updates.fullName !== undefined) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(updates.fullName);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${paramIndex++}`);
      values.push(updates.role);
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
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, username, full_name, role, is_active, created_at, updated_at
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
    `;

    const result = await db.query(query, [passwordHash, id]);
    return result.rowCount! > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount! > 0;
  }

  static async list(page = 1, limit = 20, role?: string): Promise<{ users: User[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereClause += ` AND role = $${paramIndex++}`;
      params.push(role);
    }

    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, email, username, full_name, role, is_active, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { users, total };
  }
}