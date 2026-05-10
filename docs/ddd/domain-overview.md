# Domain Overview

## Purpose

HASEB exists to answer a single question for every agentic system its users
care about:

> *"Given a benchmark and a target agent, what is the agent's process
> viability — its real performance, efficiency, cost, robustness, and quality
> across the kinds of tasks it will face in production?"*

The domain is the practice of **agent evaluation**: the lifecycle that takes a
candidate agent, runs it against a curated set of benchmarks under controlled
conditions, observes the entire interaction, and produces evidence that lets
humans (and other agents) compare candidates objectively.

## The Domain in One Page

An **Agent** is a software system under evaluation. Each Agent is registered,
fingerprinted, and made addressable by a stable identity.

A **Benchmark** is a published task suite (e.g. SWE-bench, GAIA, OSWorld). A
benchmark contributes:

- An execution environment specification.
- A task corpus.
- An oracle — the procedure that decides whether an attempt succeeds.

An **Evaluation** is a single run of one Agent against one Benchmark. The
Evaluation is the central aggregate. It moves through a lifecycle (queued →
running → collecting → analysed → completed/failed) and accumulates
**Evaluation Steps** that record the agent's interaction with the environment.

An **Evaluation Run** captures the entire trace, durable enough to be
replayed. It is the source of truth that every metric is derived from.

**Metrics** are multi-dimensional measurements derived from a run, partitioned
into five families: performance, efficiency, cost, robustness, quality. The
**process viability score** is the composite of these dimensions.

The **Orchestrator** runs the LangGraph that drives an Evaluation through its
lifecycle. It is responsible for environment setup, agent execution, metrics
collection, analysis, teardown, and event publication.

A **Leaderboard** is a read model derived from completed Evaluations. It is
sliced per Benchmark, per Agent family, per time window, and per dimension.

A **User** is a human consumer of the system: registers and configures Agents,
reviews Evaluations, browses Leaderboards. Authentication uses JWT
(see ADR 0014).

## Why This Domain Is Hard

- **Benchmark heterogeneity.** SWE-bench is code-generation; OSWorld and
  WebArena are GUI; GAIA is reasoning over tools. The orchestrator must
  honour their protocols without leaking their vocabulary into the core.
- **Cost amplification.** Naive evaluation can spend tens of dollars per agent
  per benchmark. Cost is a first-class metric, not an afterthought.
- **Trust.** Evaluations are run, observed, and sometimes implemented by AI
  agents. Truth is enforced (≥ 0.95 BFT verification), not assumed.
- **Real-time visibility.** Operators need to see runs progress live; the
  domain emits events at every state transition.

## Reading Order

For a contributor onboarding to the domain:

1. [Ubiquitous language](./ubiquitous-language.md) — vocabulary first.
2. [Subdomains](./subdomains.md) — what is core vs supporting.
3. [Bounded contexts](./bounded-contexts.md) — where the pieces live.
4. [Context map](./context-map.md) — how the pieces talk.
5. [Tactical design](./tactical-design.md) — building blocks.
6. The specific [context page](./contexts/) for the work at hand.
