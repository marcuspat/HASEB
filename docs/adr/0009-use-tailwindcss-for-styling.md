# ADR 0009: Use Tailwind CSS for styling

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** frontend, styling

## Context and Problem Statement

The dashboard requires a consistent design system across pages, charts, and
cards, with rapid iteration during the SPARC refinement phase.

Which styling approach should HASEB use?

## Decision Drivers

- Consistent design tokens (colours, spacing, typography).
- Co-location of styles with markup (low context-switch cost).
- Compatibility with `@headlessui/react`.
- Build-time pruning of unused CSS.
- Compatibility with AI agents that author UI code.

## Considered Options

1. **Tailwind CSS** with `@tailwindcss/forms`.
2. **CSS Modules.**
3. **Styled Components / Emotion.**
4. **Vanilla CSS with a custom design-system layer.**

## Decision Outcome

**Chosen option: Tailwind CSS.** Tailwind keeps styles co-located, prunes
unused classes at build time, and is well represented in AI training data,
which improves the quality of agent-generated UI.

### Positive Consequences

- Design tokens in `tailwind.config.js` are the single source of truth.
- `@tailwindcss/forms` solves the most painful default-form-element cases.
- Build output is small thanks to JIT pruning.

### Negative Consequences

- Long class strings on JSX elements; mitigated with `clsx` and component
  extraction once a pattern repeats three times.

## Implementation Notes

- Configuration: `tailwind.config.js`.
- Base styles: `src/index.css` (`@tailwind base/components/utilities`).
- Reusable components extract long class strings into composable wrappers.

## Validation

- Lighthouse CSS coverage > 60 % on the production build.
- No more than three different shades of the same colour in a release; the
  palette is curated.

## Links

- ADR 0007 — Use React 19 for the dashboard UI
- `@headlessui/react`, `@tailwindcss/forms`
