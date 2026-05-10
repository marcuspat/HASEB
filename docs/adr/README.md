# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records for HASEB (Holistic
Agentic System Evaluator & Benchmarking Suite). Each ADR captures a single,
significant architectural decision: the context that produced it, the options
considered, the choice that was made, and the consequences of that choice.

## What is an ADR?

An Architecture Decision Record (ADR) is a short, immutable document that
records an architecturally significant decision along with its context and
consequences. ADRs preserve the *why* behind the system's shape so future
contributors can understand, challenge, or revisit the decision.

HASEB uses the [MADR 3.0](https://adr.github.io/madr/) format. See
[`template.md`](./template.md) for the full template.

## Lifecycle

An ADR moves through the following statuses:

| Status       | Meaning                                                              |
|--------------|----------------------------------------------------------------------|
| `Proposed`   | Drafted, under review, not yet adopted.                              |
| `Accepted`   | Adopted; the system is built (or being built) according to it.       |
| `Deprecated` | No longer recommended, but the system may still reflect it.          |
| `Superseded` | Replaced by a newer ADR (link to the successor in the header).       |

ADRs are **immutable once accepted**. Changes are made by superseding the ADR
with a new one and updating the status header of the original.

## Numbering and Naming

- ADRs are numbered sequentially: `NNNN-kebab-case-title.md`.
- Numbers are never reused, even if an ADR is superseded.
- The first ADR (`0001`) bootstraps the practice itself.

## Index

### Foundational

| #    | Title                                                                                  | Status   |
|------|----------------------------------------------------------------------------------------|----------|
| 0001 | [Record architecture decisions](./0001-record-architecture-decisions.md)               | Accepted |
| 0002 | [Adopt SPARC + London-school TDD methodology](./0002-adopt-sparc-tdd-methodology.md)   | Accepted |
| 0003 | [Adopt Domain-Driven Design as the design approach](./0003-adopt-domain-driven-design.md) | Accepted |

### Language, Runtime & Build

| #    | Title                                                                                            | Status   |
|------|--------------------------------------------------------------------------------------------------|----------|
| 0004 | [Use TypeScript across frontend and backend](./0004-use-typescript-everywhere.md)                | Accepted |
| 0005 | [Use Node.js with ESM as the backend runtime](./0005-use-nodejs-esm-runtime.md)                  | Accepted |
| 0006 | [Use Vite as the frontend build tool](./0006-use-vite-as-frontend-build-tool.md)                 | Accepted |

### Frontend

| #    | Title                                                                                | Status   |
|------|--------------------------------------------------------------------------------------|----------|
| 0007 | [Use React 19 for the dashboard UI](./0007-use-react-for-frontend.md)                | Accepted |
| 0008 | [Use Zustand for client state management](./0008-use-zustand-for-state-management.md) | Accepted |
| 0009 | [Use Tailwind CSS for styling](./0009-use-tailwindcss-for-styling.md)                | Accepted |
| 0010 | [Use Chart.js and D3 for visualization](./0010-use-chartjs-and-d3-for-visualization.md) | Accepted |

### Backend & API

| #    | Title                                                                                        | Status   |
|------|----------------------------------------------------------------------------------------------|----------|
| 0011 | [Use Express 5 for the HTTP API](./0011-use-express-for-http-api.md)                         | Accepted |
| 0012 | [Use REST + WebSocket for the API surface](./0012-rest-and-websocket-api-style.md)           | Accepted |
| 0013 | [Use Swagger / OpenAPI for API documentation](./0013-use-swagger-openapi-for-api-docs.md)    | Accepted |
| 0014 | [Use JWT for authentication and authorization](./0014-jwt-authentication-strategy.md)        | Accepted |

### Data & Persistence

| #    | Title                                                                                | Status   |
|------|--------------------------------------------------------------------------------------|----------|
| 0015 | [Use PostgreSQL as the primary datastore](./0015-use-postgresql-as-primary-database.md) | Accepted |
| 0016 | [Use SQLite for local development and tests](./0016-use-sqlite-for-local-development.md) | Accepted |
| 0017 | [Use the Repository pattern for persistence](./0017-repository-pattern-for-persistence.md) | Accepted |

### Orchestration & Domain

| #    | Title                                                                                              | Status   |
|------|----------------------------------------------------------------------------------------------------|----------|
| 0018 | [Use LangGraph for evaluation orchestration](./0018-use-langgraph-for-orchestration.md)            | Accepted |
| 0019 | [Adopt a multi-agent execution strategy](./0019-multi-agent-execution-strategy.md)                 | Accepted |
| 0020 | [Use multi-dimensional metrics collection](./0020-multi-dimensional-metrics-collection.md)         | Accepted |
| 0021 | [Use an event-driven orchestration model](./0021-event-driven-orchestration.md)                    | Accepted |
| 0022 | [Apply Byzantine-fault-tolerant verification with a 0.95 threshold](./0022-byzantine-fault-tolerant-verification.md) | Accepted |

### Quality, Security & Operations

| #    | Title                                                                                            | Status   |
|------|--------------------------------------------------------------------------------------------------|----------|
| 0023 | [Use Jest and Playwright for testing](./0023-use-jest-and-playwright-for-testing.md)             | Accepted |
| 0024 | [Use Helmet, CORS, and rate limiting for security baseline](./0024-security-baseline-helmet-rate-limit.md) | Accepted |
| 0025 | [Use Winston for structured logging](./0025-use-winston-for-structured-logging.md)               | Accepted |
| 0026 | [Use a Dev Container for development environments](./0026-use-devcontainer-for-development.md)   | Accepted |
| 0027 | [Use a single-repository (modular monorepo) layout](./0027-single-repository-monorepo.md)        | Accepted |
| 0028 | [Use GitHub Actions for CI/CD](./0028-use-github-actions-for-ci-cd.md)                           | Accepted |

## Authoring a new ADR

1. Copy [`template.md`](./template.md) to `NNNN-kebab-case-title.md` using the
   next available number.
2. Fill in *Context*, *Decision Drivers*, *Considered Options*, and *Decision*.
3. Open a pull request titled `ADR NNNN: <title>`.
4. On merge, set `Status: Accepted` and update the index above.

## Cross-references

- DDD documentation: [`../ddd/`](../ddd/)
- System architecture: [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md)
- API specification: [`../API_SPECIFICATIONS.md`](../API_SPECIFICATIONS.md)
- Database schema: [`../DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md)
