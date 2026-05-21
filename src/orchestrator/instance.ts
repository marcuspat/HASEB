import { EvaluationOrchestrator } from './EvaluationOrchestrator';

// Shared orchestrator singleton. Kept in its own module so both the server
// bootstrap (server.ts) and the orchestrator API routes (api/orchestrator.ts)
// can import it without forming a circular dependency between those files.
export const orchestrator = new EvaluationOrchestrator();
