/**
 * Domain event envelope and catalogue.
 *
 * See docs/ddd/domain-events.md for semantics. This file is the authoritative
 * type-level expression of the Published Language between bounded contexts.
 *
 * NEW: introduced as part of the ADR/DDD foundation. Existing producers
 * (notably `src/orchestrator/WebSocketManager.ts`) currently emit raw
 * socket.io payloads; they should be migrated to publish via this envelope.
 */

export type DomainEventName =
  // Evaluation
  | 'evaluation.submitted'
  | 'evaluation.started'
  | 'evaluation.step.recorded'
  | 'evaluation.run.completed'
  | 'evaluation.completed'
  | 'evaluation.failed'
  | 'evaluation.cancelled'
  // Metrics
  | 'metrics.dimension.collected'
  | 'metrics.finalised'
  | 'metrics.superseded'
  // Agent management
  | 'agent.registered'
  | 'agent.profile.updated'
  | 'agent.archived'
  // Benchmark catalog
  | 'benchmark.published'
  | 'benchmark.deprecated'
  // Identity & access
  | 'user.registered'
  | 'user.authenticated'
  | 'user.password.changed'
  | 'user.deactivated'
  // Queue / orchestration
  | 'queue.enqueued'
  | 'queue.dequeued';

export interface DomainEventEnvelope<
  TName extends DomainEventName = DomainEventName,
  TPayload = unknown,
> {
  readonly eventId: string;
  readonly name: TName;
  readonly version: number;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly producer: string;
  readonly payload: TPayload;
}

// --- Evaluation payloads -----------------------------------------------------

export interface EvaluationSubmittedPayload {
  readonly evaluationId: string;
  readonly agentId: string;
  readonly benchmarkId: string;
  readonly submittedById: string;
  readonly submittedAt: string;
}

export interface EvaluationStartedPayload {
  readonly evaluationId: string;
  readonly startedAt: string;
  readonly environmentRef: string;
}

export type EvaluationStepKind =
  | 'tool_call'
  | 'llm_call'
  | 'screen_action'
  | 'other';

export type EvaluationStepStatus = 'ok' | 'error';

export interface EvaluationStepRecordedPayload {
  readonly evaluationId: string;
  readonly stepIndex: number;
  readonly recordedAt: string;
  readonly kind: EvaluationStepKind;
  readonly status: EvaluationStepStatus;
  readonly summary: string;
}

export interface EvaluationRunCompletedPayload {
  readonly evaluationId: string;
  readonly runId: string;
  readonly completedAt: string;
  readonly outcome: 'success' | 'failure';
  readonly failureReason?: string;
}

export interface EvaluationCompletedPayload {
  readonly evaluationId: string;
  readonly completedAt: string;
  readonly metricSetId: string;
}

export type EvaluationFailureStage =
  | 'queue'
  | 'environment'
  | 'execution'
  | 'collection'
  | 'analysis';

export interface EvaluationFailedPayload {
  readonly evaluationId: string;
  readonly failedAt: string;
  readonly reason: string;
  readonly stage: EvaluationFailureStage;
}

export interface EvaluationCancelledPayload {
  readonly evaluationId: string;
  readonly cancelledAt: string;
  readonly cancelledById: string;
  readonly reason: string;
}

// --- Metrics payloads --------------------------------------------------------

export type MetricDimensionName =
  | 'performance'
  | 'efficiency'
  | 'cost'
  | 'robustness'
  | 'quality';

export interface MetricsDimensionCollectedPayload {
  readonly evaluationId: string;
  readonly metricSetId: string;
  readonly dimension: MetricDimensionName;
  readonly collectedAt: string;
}

export interface MetricsFinalisedPayload {
  readonly evaluationId: string;
  readonly metricSetId: string;
  readonly finalisedAt: string;
  readonly viabilityScore: number;
  readonly weightingVersion: string;
}

export interface MetricsSupersededPayload {
  readonly evaluationId: string;
  readonly metricSetId: string;
  readonly replacesMetricSetId: string;
  readonly reason: string;
}

// --- Agent / Benchmark / User / Queue payloads -------------------------------

export interface AgentRegisteredPayload {
  readonly agentId: string;
  readonly name: string;
  readonly provider: string;
  readonly fingerprint: string;
  readonly registeredAt: string;
}

export interface AgentProfileUpdatedPayload {
  readonly agentId: string;
  readonly newVersionId: string;
  readonly versionNumber: number;
  readonly updatedAt: string;
}

export interface AgentArchivedPayload {
  readonly agentId: string;
  readonly archivedAt: string;
}

export interface BenchmarkPublishedPayload {
  readonly benchmarkId: string;
  readonly name: string;
  readonly version: string;
  readonly kind: 'code' | 'gui' | 'reasoning';
  readonly taskCount: number;
  readonly publishedAt: string;
}

export interface BenchmarkDeprecatedPayload {
  readonly benchmarkId: string;
  readonly deprecatedAt: string;
  readonly replacedByBenchmarkId?: string;
}

export interface UserRegisteredPayload {
  readonly userId: string;
  readonly registeredAt: string;
}

export interface UserAuthenticatedPayload {
  readonly userId: string;
  readonly authenticatedAt: string;
}

export interface UserPasswordChangedPayload {
  readonly userId: string;
  readonly changedAt: string;
}

export interface UserDeactivatedPayload {
  readonly userId: string;
  readonly deactivatedAt: string;
}

export interface QueueEnqueuedPayload {
  readonly evaluationId: string;
  readonly position: number;
  readonly enqueuedAt: string;
}

export interface QueueDequeuedPayload {
  readonly evaluationId: string;
  readonly dequeuedAt: string;
}

// --- Name → payload registry -------------------------------------------------

export interface DomainEventPayloads {
  'evaluation.submitted': EvaluationSubmittedPayload;
  'evaluation.started': EvaluationStartedPayload;
  'evaluation.step.recorded': EvaluationStepRecordedPayload;
  'evaluation.run.completed': EvaluationRunCompletedPayload;
  'evaluation.completed': EvaluationCompletedPayload;
  'evaluation.failed': EvaluationFailedPayload;
  'evaluation.cancelled': EvaluationCancelledPayload;
  'metrics.dimension.collected': MetricsDimensionCollectedPayload;
  'metrics.finalised': MetricsFinalisedPayload;
  'metrics.superseded': MetricsSupersededPayload;
  'agent.registered': AgentRegisteredPayload;
  'agent.profile.updated': AgentProfileUpdatedPayload;
  'agent.archived': AgentArchivedPayload;
  'benchmark.published': BenchmarkPublishedPayload;
  'benchmark.deprecated': BenchmarkDeprecatedPayload;
  'user.registered': UserRegisteredPayload;
  'user.authenticated': UserAuthenticatedPayload;
  'user.password.changed': UserPasswordChangedPayload;
  'user.deactivated': UserDeactivatedPayload;
  'queue.enqueued': QueueEnqueuedPayload;
  'queue.dequeued': QueueDequeuedPayload;
}

export type DomainEvent<TName extends DomainEventName = DomainEventName> =
  DomainEventEnvelope<TName, DomainEventPayloads[TName]>;

/**
 * Publisher port. Adapters implement this; producers depend on it.
 *
 * The in-process implementation lives at the orchestration boundary
 * (see `src/orchestrator/WebSocketManager.ts`); a future durable adapter
 * will satisfy the same contract per ADR 0021.
 */
export interface DomainEventPublisher {
  publish<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloads[TName],
    options?: {
      readonly correlationId?: string;
      readonly causationId?: string;
      readonly producer?: string;
      readonly version?: number;
      readonly occurredAt?: string;
    },
  ): Promise<void>;
}

/**
 * Subscriber port. Consumers register handlers per event name. Implementations
 * must dedupe by `eventId` to satisfy the at-least-once delivery model.
 */
export interface DomainEventSubscriber {
  subscribe<TName extends DomainEventName>(
    name: TName,
    handler: (event: DomainEvent<TName>) => Promise<void> | void,
  ): () => void;
}
