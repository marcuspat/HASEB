/**
 * Generic repository abstraction.
 *
 * Domain code persists and retrieves aggregates through this port without
 * knowing about SQL, the connection pool, or the dialect. Concrete
 * implementations live in the infrastructure/database layer.
 */
export interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}
