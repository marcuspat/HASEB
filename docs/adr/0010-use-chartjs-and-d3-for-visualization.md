# ADR 0010: Use Chart.js and D3 for visualization

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** frontend, visualization

## Context and Problem Statement

HASEB visualizations cover a spectrum: simple time series and bar charts
(every dashboard), and bespoke domain-specific views (cost-vs-quality
scatter, multi-dimensional metrics radar, run timelines).

Which charting tools should HASEB use?

## Decision Drivers

- Speed of authoring for "standard" charts.
- Flexibility for bespoke visualizations.
- Bundle-size impact.
- Accessibility (ARIA, keyboard navigation).
- Compatibility with React 19 and Tailwind.

## Considered Options

1. **Chart.js + `react-chartjs-2` for standard charts; D3 for bespoke.**
2. **D3 only.**
3. **Recharts only.**
4. **Plotly.**

## Decision Outcome

**Chosen option: Chart.js for standard charts and D3 for bespoke
visualizations.** This split optimises authoring speed for 80 % of the
dashboard while preserving flexibility for the metrics views that matter
most to evaluation insight.

### Positive Consequences

- Most charts authored in minutes via `react-chartjs-2`.
- Bespoke visualizations leverage the full D3 selection model.
- Both libraries are well represented in AI training data.

### Negative Consequences

- Two libraries to maintain; we accept the cost given the productivity gain.
- D3 components must be carefully wrapped in React (effect-based mount /
  unmount).

## Implementation Notes

- Standard charts: `src/components/*Chart.tsx` using `react-chartjs-2`.
- Bespoke charts: D3-based components live alongside their consumers and
  expose declarative props.
- A shared theme module synchronises colours with Tailwind tokens.

## Validation

- Initial chart render < 50 ms per chart on the reference container.
- Charts respond to dark-mode token changes without remounting.

## Links

- ADR 0007 — Use React 19 for the dashboard UI
- ADR 0009 — Use Tailwind CSS for styling
