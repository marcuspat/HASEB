/**
 * Shared seed constants, kept in a side-effect-free module (no `import.meta`
 * CLI guard) so they can be imported from route/runtime code and test contexts.
 */

/** Deterministic id for the seeded SWE-bench Lite benchmark (valid UUID for PG). */
export const SWE_BENCH_LITE_BENCHMARK_ID = '00000000-0000-4000-8000-000000000001';
export const SWE_BENCH_LITE_BENCHMARK_NAME = 'SWE-bench Lite';
