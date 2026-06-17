import { randomUUID } from 'crypto';

/**
 * Base class for all domain events.
 *
 * A domain event records that something meaningful happened to an aggregate.
 * Every event has a unique id, the time it occurred, the id of the aggregate it
 * concerns, and a stable `eventType` discriminator that adapters (e.g. the
 * Socket.io bridge in ADR-011) and event stores can switch on.
 */
export abstract class DomainEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  abstract readonly eventType: string;

  constructor(aggregateId: string, occurredAt: Date = new Date()) {
    this.id = randomUUID();
    this.occurredAt = occurredAt;
    this.aggregateId = aggregateId;
  }
}
