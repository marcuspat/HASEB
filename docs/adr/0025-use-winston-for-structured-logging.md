# ADR 0025: Use Winston for structured logging

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** observability, logging

## Context and Problem Statement

HASEB needs structured logs for the orchestrator, the API, and the agent
runners. Logs must be ingestible by downstream tools (ELK, Loki, etc.)
and correlate with the WebSocket event stream.

Which logging library should HASEB use?

## Decision Drivers

- JSON output for ingestion.
- Multiple transports (console, file, eventually log shippers).
- Per-context loggers (orchestrator vs api).
- TypeScript types of acceptable quality.

## Considered Options

1. **Winston** with JSON output and per-context child loggers.
2. **Pino.**
3. **`debug` library only.**

## Decision Outcome

**Chosen option: Winston.** Winston's transport model fits HASEB's
console-and-file deployment for v1, and its formatter pipeline composes
well with Morgan's HTTP access logs.

### Positive Consequences

- JSON logs straight to stdout for container log collection.
- Child loggers carry `context` (e.g. `orchestrator`, `metrics`) and
  request-scoped fields (`evaluationId`, `userId`).
- Easy upgrade path to ship logs to a remote aggregator.

### Negative Consequences

- Winston's overhead is higher than Pino's; not the bottleneck given LLM
  call latency dominates.

## Implementation Notes

- Logger setup: `src/utils/logger.ts`.
- Mandatory fields: `timestamp`, `level`, `context`, `message`,
  `correlationId` where available.
- HTTP access logs via `morgan` are piped through Winston so the
  enrichment is uniform.

## Validation

- All log lines parse as JSON in CI.
- Sensitive fields (`password`, `token`, `authorization`) are redacted by
  the formatter.

## Links

- ADR 0024 — Security baseline
- `src/utils/logger.ts`
