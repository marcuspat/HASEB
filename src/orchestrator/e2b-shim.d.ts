// Ambient declaration for the optional `@e2b/code-interpreter` dependency.
// This package is not installed by default; it is loaded dynamically at
// runtime via `await import('@e2b/code-interpreter')` and is only available
// when the E2B sandbox feature is enabled. Declaring it here lets the project
// type-check without the optional package present.
declare module '@e2b/code-interpreter';
