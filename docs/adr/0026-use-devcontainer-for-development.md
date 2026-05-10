# ADR 0026: Use a Dev Container for development environments

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** dx, environment

## Context and Problem Statement

Contributors and AI agents must produce identical environments. Variation
in Node versions, Postgres versions, or system tooling causes flake and
"works on my machine" failures.

How should HASEB standardise the development environment?

## Decision Drivers

- One-command setup for new contributors.
- Reproducible toolchain across humans and AI agents.
- Compatibility with VS Code Dev Containers and GitHub Codespaces.

## Considered Options

1. **`.devcontainer/` configuration with a pinned base image.**
2. **A bare Docker Compose for Postgres, but native Node on the host.**
3. **A `Brewfile` / `nvmrc` only.**

## Decision Outcome

**Chosen option: `.devcontainer/`.** A Dev Container gives us a single,
versioned image used by humans and Claude-Flow agents alike. It also
matches the Codespaces story we want for outside contributors.

### Positive Consequences

- Same Node/TypeScript/Postgres versions for everyone.
- Pre-installed tooling for `claude-flow@alpha`, `npx`, and Playwright
  browsers.
- VS Code launches with the right settings via `devcontainer.json`.

### Negative Consequences

- Image rebuilds when toolchain pins change; standard cost of containerised
  environments.

## Implementation Notes

- Configuration: `.devcontainer/devcontainer.json` and (optionally)
  `Dockerfile`.
- Post-create commands run `npm install`, `playwright install --with-deps`,
  and seed the local database.

## Validation

- A new contributor can run `npm test` within five minutes of cloning.
- CI uses the same base image to avoid drift.

## Links

- ADR 0023 — Use Jest and Playwright for testing
- ADR 0028 — Use GitHub Actions for CI/CD
