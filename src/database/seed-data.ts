import { db } from './connection';
import { logger } from '../utils/logger';

/**
 * SQLite database seeding script to populate dashboard with meaningful data
 */
async function seedDashboardData(): Promise<void> {
  try {
    logger.info('Seeding SQLite database with dashboard data...');

    // Insert sample agents
    await db.query(`
      INSERT OR IGNORE INTO agents (id, name, type, description, capabilities, configuration, status, created_at, updated_at) VALUES
      ('agent-001', 'SWE-Agent-v1', 'swe', 'Software engineering agent for code generation and debugging',
       '["code-generation", "debugging", "test-writing", "refactoring"]',
       '{"model": "gpt-4", "temperature": 0.1, "max_tokens": 4000}',
       'active', datetime('now', '-2 days'), datetime('now', '-1 hour')),
      ('agent-002', 'GUI-Agent-v1', 'gui', 'Graphical user interface automation agent',
       '["automation", "visual-recognition", "interaction", "screenshot-analysis"]',
       '{"model": "claude-3", "temperature": 0.2, "max_tokens": 3000}',
       'active', datetime('now', '-3 days'), datetime('now', '-30 minutes')),
      ('agent-003', 'General-Agent-v1', 'general', 'General purpose reasoning and planning agent',
       '["reasoning", "planning", "execution", "analysis"]',
       '{"model": "gpt-3.5-turbo", "temperature": 0.3, "max_tokens": 2000}',
       'inactive', datetime('now', '-5 days'), datetime('now', '-2 days')),
      ('agent-004', 'Orchestrator-v1', 'orchestrator', 'Multi-agent coordination and orchestration',
       '["coordination", "planning", "delegation", "monitoring"]',
       '{"model": "gpt-4", "temperature": 0.1, "max_tokens": 5000}',
       'active', datetime('now', '-1 day'), datetime('now', '-15 minutes')),
      ('agent-005', 'Benchmark-Agent-v1', 'general', 'Specialized benchmark evaluation agent',
       '["evaluation", "metrics", "analysis", "reporting"]',
       '{"model": "claude-3", "temperature": 0.0, "max_tokens": 6000}',
       'active', datetime('now', '-4 days'), datetime('now', '-45 minutes'))
    `);

    // Insert sample benchmarks
    await db.query(`
      INSERT OR IGNORE INTO benchmarks (id, name, type, description, dataset, evaluation_criteria, configuration, is_active, created_at, updated_at) VALUES
      ('bench-001', 'SWE-Bench-Test', 'swe-bench', 'Software engineering benchmark with real GitHub issues',
       'https://github.com/princeton-nlp/SWE-bench',
       '["correctness", "efficiency", "code-quality", "test-coverage"]',
       '{"timeout": 1800, "max_retries": 3, "languages": ["python", "javascript"]}',
       1, datetime('now', '-7 days'), datetime('now', '-1 day')),
      ('bench-002', 'GAIA-Test', 'gaia', 'General AI assistant benchmark for complex reasoning',
       'https://huggingface.co/datasets/gaia-benchmark',
       '["accuracy", "reasoning-quality", "tool-usage", "efficiency"]',
       '{"timeout": 3600, "tools_enabled": true, "difficulty_levels": [1,2,3]}',
       1, datetime('now', '-6 days'), datetime('now', '-12 hours')),
      ('bench-003', 'OSWorld-Test', 'osworld', 'Operating system world interaction benchmark',
       'https://osworld.org',
       '["task-completion", "efficiency", "error-rate", "adaptability"]',
       '{"os": "ubuntu-22.04", "gui_enabled": true, "network_access": false}',
       1, datetime('now', '-5 days'), datetime('now', '-6 hours')),
      ('bench-004', 'WebArena-Test', 'webarena', 'Web automation arena for browser-based tasks',
       'https://webarena.dev',
       '["completion-rate", "navigation-efficiency", "error-handling", "speed"]',
       '{"browser": "chrome", "headless": false, "timeout": 900}',
       0, datetime('now', '-4 days'), datetime('now', '-2 days')),
      ('bench-005', 'AgentBench-Test', 'agentbench', 'Comprehensive agent capability evaluation',
       'https://agentbench.org',
       '["versatility", "robustness", "learning", "adaptation"]',
       '{"categories": 12, "adaptive_difficulty": true, "randomization": true}',
       1, datetime('now', '-3 days'), datetime('now', '-3 hours'))
    `);

    // Insert sample evaluations with completed results
    await db.query(`
      INSERT OR IGNORE INTO evaluations (id, agent_id, benchmark_id, status, start_time, end_time, metrics, logs, configuration, created_at, updated_at) VALUES
      ('eval-001', 'agent-001', 'bench-001', 'completed',
       datetime('now', '-2 days', '-3 hours'), datetime('now', '-2 days', '-1 hour'),
       '{"taskSuccessRate": 0.85, "executionTime": 7200000, "latencyPerStep": 150, "totalSteps": 48, "totalTokens": 12500, "estimatedCost": 0.125, "toolCallErrorRate": 0.08, "recoveryRate": 0.92, "toolSelectionAccuracy": 0.89, "parameterAccuracy": 0.85}',
       '[{"timestamp": "' || datetime('now', '-2 days', '-3 hours') || '", "level": "info", "message": "Started SWE-Bench evaluation", "source": "orchestrator"}, {"timestamp": "' || datetime('now', '-2 days', '-2 hours') || '", "level": "info", "message": "Completed 25/50 tasks", "source": "evaluator"}, {"timestamp": "' || datetime('now', '-2 days', '-1 hour') || '", "level": "info", "message": "Evaluation completed successfully", "source": "orchestrator"}]',
       '{"agent_config": {"model": "gpt-4"}, "benchmark_config": {"timeout": 1800}}',
       datetime('now', '-2 days', '-3 hours'), datetime('now', '-2 days', '-1 hour')),

      ('eval-002', 'agent-002', 'bench-002', 'completed',
       datetime('now', '-1 day', '-4 hours'), datetime('now', '-1 day', '-2 hours'),
       '{"taskSuccessRate": 0.78, "executionTime": 7200000, "latencyPerStep": 240, "totalSteps": 30, "totalTokens": 8900, "estimatedCost": 0.089, "toolCallErrorRate": 0.12, "recoveryRate": 0.88, "toolSelectionAccuracy": 0.82, "parameterAccuracy": 0.79}',
       '[{"timestamp": "' || datetime('now', '-1 day', '-4 hours') || '", "level": "info", "message": "Started GAIA evaluation", "source": "orchestrator"}, {"timestamp": "' || datetime('now', '-1 day', '-3 hours') || '", "level": "warn", "message": "Encountered tool timeout on task 15", "source": "evaluator"}, {"timestamp": "' || datetime('now', '-1 day', '-2 hours') || '", "level": "info", "message": "Evaluation completed with warnings", "source": "orchestrator"}]',
       '{"agent_config": {"model": "claude-3"}, "benchmark_config": {"timeout": 3600}}',
       datetime('now', '-1 day', '-4 hours'), datetime('now', '-1 day', '-2 hours')),

      ('eval-003', 'agent-004', 'bench-003', 'running',
       datetime('now', '-3 hours'), NULL,
       '{"taskSuccessRate": 0.0, "executionTime": 0, "latencyPerStep": 0, "totalSteps": 0, "totalTokens": 0, "estimatedCost": 0.0, "toolCallErrorRate": 0.0, "recoveryRate": 0.0, "toolSelectionAccuracy": 0.0, "parameterAccuracy": 0.0}',
       '[{"timestamp": "' || datetime('now', '-3 hours') || '", "level": "info", "message": "Started OSWorld evaluation", "source": "orchestrator"}, {"timestamp": "' || datetime('now', '-2 hours') || '", "level": "info", "message": "Progress: 15/40 tasks completed", "source": "evaluator"}, {"timestamp": "' || datetime('now', '-1 hour') || '", "level": "info", "message": "Progress: 25/40 tasks completed", "source": "evaluator"}]',
       '{"agent_config": {"model": "gpt-4"}, "benchmark_config": {"timeout": 3600}}',
       datetime('now', '-3 hours'), datetime('now', '-10 minutes')),

      ('eval-004', 'agent-005', 'bench-005', 'completed',
       datetime('now', '-2 days', '-6 hours'), datetime('now', '-2 days', '-4 hours'),
       '{"taskSuccessRate": 0.92, "executionTime": 5400000, "latencyPerStep": 90, "totalSteps": 60, "totalTokens": 15600, "estimatedCost": 0.156, "toolCallErrorRate": 0.05, "recoveryRate": 0.95, "toolSelectionAccuracy": 0.94, "parameterAccuracy": 0.91}',
       '[{"timestamp": "' || datetime('now', '-2 days', '-6 hours') || '", "level": "info", "message": "Started AgentBench evaluation", "source": "orchestrator"}, {"timestamp": "' || datetime('now', '-2 days', '-5 hours') || '", "level": "info", "message": "Halfway through evaluation", "source": "evaluator"}, {"timestamp": "' || datetime('now', '-2 days', '-4 hours') || '", "level": "info", "message": "Evaluation completed with excellent results", "source": "orchestrator"}]',
       '{"agent_config": {"model": "claude-3"}, "benchmark_config": {"categories": 12}}',
       datetime('now', '-2 days', '-6 hours'), datetime('now', '-2 days', '-4 hours')),

      ('eval-005', 'agent-001', 'bench-002', 'failed',
       datetime('now', '-6 hours'), datetime('now', '-5 hours'),
       '{"taskSuccessRate": 0.0, "executionTime": 3600000, "latencyPerStep": 300, "totalSteps": 12, "totalTokens": 3200, "estimatedCost": 0.032, "toolCallErrorRate": 0.75, "recoveryRate": 0.25, "toolSelectionAccuracy": 0.45, "parameterAccuracy": 0.38}',
       '[{"timestamp": "' || datetime('now', '-6 hours') || '", "level": "info", "message": "Started GAIA evaluation with SWE-Agent", "source": "orchestrator"}, {"timestamp": "' || datetime('now', '-5.5 hours') || '", "level": "error", "message": "Multiple tool failures encountered", "source": "evaluator"}, {"timestamp": "' || datetime('now', '-5 hours') || '", "level": "error", "message": "Evaluation failed due to excessive errors", "source": "orchestrator"}]',
       '{"agent_config": {"model": "gpt-4"}, "benchmark_config": {"timeout": 3600}}',
       datetime('now', '-6 hours'), datetime('now', '-5 hours'))
    `);

    // Insert sample tasks for evaluations
    await db.query(`
      INSERT OR IGNORE INTO tasks (id, evaluation_id, type, description, input, expected_output, actual_output, status, execution_time, tokens_used, errors, created_at, updated_at) VALUES
      ('task-001', 'eval-001', 'code-fix', 'Fix login authentication bug',
       '{"repository": "https://github.com/example/auth", "issue": "Login fails with valid credentials", "files": ["login.js", "auth.js"]}',
       '{"status": "fixed", "test_results": {"passed": 8, "total": 8}}',
       '{"status": "fixed", "changes": 15, "test_results": {"passed": 8, "total": 8}}',
       'completed', 1800000, 450,
       '[]', datetime('now', '-2 days', '-3 hours'), datetime('now', '-2 days', '-2.5 hours')),

      ('task-002', 'eval-001', 'feature-add', 'Implement user search functionality',
       '{"repository": "https://github.com/example/auth", "requirement": "Add full-text search for users", "files": ["users.js", "search.js"]}',
       '{"status": "implemented", "search_time": "<200ms", "relevance_score": ">0.9"}',
       '{"status": "implemented", "search_time": "150ms", "relevance_score": "0.95"}',
       'completed', 2400000, 620,
       '[]', datetime('now', '-2 days', '-2.5 hours'), datetime('now', '-2 days', '-2 hours')),

      ('task-003', 'eval-002', 'gui-automation', 'Navigate to settings page and change theme',
       '{"website": "https://example.com", "goal": "Change theme to dark mode", "steps": ["login", "navigate", "click", "verify"]}',
       '{"status": "success", "theme_changed": true, "time_taken": "<30s"}',
       '{"status": "success", "theme_changed": true, "time_taken": "25s"}',
       'completed', 900000, 280,
       '[]', datetime('now', '-1 day', '-3.5 hours'), datetime('now', '-1 day', '-3.3 hours')),

      ('task-004', 'eval-003', 'os-interaction', 'Create new folder and move files',
       '{"os": "ubuntu", "actions": ["mkdir", "mv", "ls"], "files": ["file1.txt", "file2.txt"]}',
       '{"status": "in_progress", "current_step": "moving_files"}',
       '{"status": "in_progress", "current_step": "moving_files", "progress": "60%"}',
       'running', 1080000, 190,
       '[]', datetime('now', '-2.5 hours'), datetime('now', '-1.5 hours'))
    `);

    // Update some agent status to be active
    await db.query(`
      UPDATE agents SET status = 'active', updated_at = datetime('now')
      WHERE id IN ('agent-001', 'agent-002', 'agent-004', 'agent-005')
    `);

    logger.info('Database seeding completed successfully');
    logger.info('Added 5 agents, 5 benchmarks, 5 evaluations, and 4 tasks');

  } catch (error) {
    logger.error('Failed to seed database:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDashboardData()
    .then(() => {
      console.log('✅ Database seeded successfully with dashboard data');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to seed database:', error);
      process.exit(1);
    });
}

export { seedDashboardData };