# HASEB Database Schema Design

## Overview

This document provides comprehensive database schema design for the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) platform, optimized for performance, scalability, and efficient querying of evaluation metrics.

## Database Architecture

### Technology Choice
- **Primary Database**: PostgreSQL 15+
- **Cache Layer**: Redis 7+
- **Connection Pooling**: PgBouncer
- **Replication**: Streaming replication with read replicas

### Design Principles
1. **ACID Compliance**: Ensure data integrity for evaluation results
2. **Scalability**: Horizontal scaling through read replicas and partitioning
3. **Performance**: Optimized indexes and query patterns
4. **Flexibility**: JSONB columns for evolving data structures
5. **Auditability**: Complete audit trail for all operations

## Core Schema Design

### 1. Core Tables

#### evaluations
Primary table for managing evaluation executions.

```sql
CREATE TABLE evaluations (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent information
    agent_name VARCHAR(255) NOT NULL,
    agent_version VARCHAR(50) NOT NULL,
    agent_id UUID REFERENCES agents(id),

    -- Benchmark information
    benchmark_type VARCHAR(100) NOT NULL,
    benchmark_version VARCHAR(50) NOT NULL,
    benchmark_id UUID REFERENCES benchmarks(id),

    -- Status and timing
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Configuration and metadata
    configuration JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Summary statistics (computed fields)
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    successful_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,

    -- Constraints
    CONSTRAINT eval_time_order CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= started_at) AND
        (completed_tasks <= total_tasks) AND
        (successful_tasks <= completed_tasks) AND
        (failed_tasks <= completed_tasks)
    ),

    -- Generated columns for performance
    duration_seconds BIGINT GENERATED ALWAYS AS (
        CASE
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))::BIGINT
            ELSE NULL
        END
    ) STORED,

    success_rate DECIMAL(5,4) GENERATED ALWAYS AS (
        CASE
            WHEN completed_tasks > 0
            THEN ROUND(successful_tasks::DECIMAL / completed_tasks, 4)
            ELSE NULL
        END
    ) STORED
);

-- Indexes for optimal query performance
CREATE INDEX idx_evaluations_agent_benchmark ON evaluations(agent_name, benchmark_type);
CREATE INDEX idx_evaluations_status_created ON evaluations(status, created_at DESC);
CREATE INDEX idx_evaluations_agent_version ON evaluations(agent_name, agent_version);
CREATE INDEX idx_evaluations_benchmark_version ON evaluations(benchmark_type, benchmark_version);
CREATE INDEX idx_evaluations_created_desc ON evaluations(created_at DESC);
CREATE INDEX idx_evaluations_duration ON evaluations(duration_seconds) WHERE duration_seconds IS NOT NULL;
CREATE INDEX idx_evaluations_success_rate ON evaluations(success_rate) WHERE success_rate IS NOT NULL;

-- Partitioning by created_at for large datasets
-- (Uncomment for production with large data volumes)
-- CREATE TABLE evaluations_y2024m01 PARTITION OF evaluations
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### tasks
Detailed information about individual tasks within evaluations.

```sql
CREATE TABLE tasks (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,

    -- Task identification
    task_id VARCHAR(255) NOT NULL, -- Original task ID from benchmark
    task_name TEXT NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    task_difficulty VARCHAR(20) CHECK (task_difficulty IN ('easy', 'medium', 'hard', 'expert')),

    -- Status and timing
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Configuration and results
    configuration JSONB NOT NULL DEFAULT '{}',
    input_data JSONB,
    expected_output JSONB,
    actual_output JSONB,
    result_summary JSONB,

    -- Performance metrics
    execution_time_ms BIGINT,
    steps_taken INTEGER DEFAULT 0,
    tools_used JSONB DEFAULT '[]',
    tokens_used BIGINT DEFAULT 0,
    cost_usd DECIMAL(10,4) DEFAULT 0.0000,

    -- Error information
    error_message TEXT,
    error_type VARCHAR(100),
    error_details JSONB,

    -- Constraints
    CONSTRAINT tasks_unique_eval_task UNIQUE(evaluation_id, task_id),
    CONSTRAINT tasks_time_order CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= started_at)
    ),
    CONSTRAINT tasks_positive_metrics CHECK (
        (execution_time_ms IS NULL OR execution_time_ms >= 0) AND
        (steps_taken >= 0) AND
        (tokens_used >= 0) AND
        (cost_usd >= 0)
    )
);

-- Indexes for task queries
CREATE INDEX idx_tasks_evaluation_id ON tasks(evaluation_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type_status ON tasks(task_type, status);
CREATE INDEX idx_tasks_execution_time ON tasks(execution_time_ms) WHERE execution_time_ms IS NOT NULL;
CREATE INDEX idx_tasks_cost ON tasks(cost_usd) WHERE cost_usd > 0;
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_tasks_difficulty ON tasks(task_difficulty) WHERE task_difficulty IS NOT NULL;

-- JSONB indexes for efficient querying of configuration and results
CREATE INDEX idx_tasks_config_gin ON tasks USING GIN(configuration);
CREATE INDEX idx_tasks_tools_gin ON tasks USING GIN(tools_used);
CREATE INDEX idx_tasks_input_gin ON tasks USING GIN(input_data) WHERE input_data IS NOT NULL;
```

#### metrics
Detailed metrics collection for each task.

```sql
CREATE TABLE metrics (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Metric identification
    metric_category VARCHAR(50) NOT NULL CHECK (metric_category IN ('performance', 'efficiency', 'cost', 'robustness', 'quality')),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(50),

    -- Timestamp and metadata
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT metrics_unique_task_metric UNIQUE(task_id, metric_category, metric_name),
    CONSTRAINT metrics_value_range CHECK (metric_value >= -999999999999.99 AND metric_value <= 999999999999.99)
);

-- Indexes for metric queries
CREATE INDEX idx_metrics_task_id ON metrics(task_id);
CREATE INDEX idx_metrics_category_name ON metrics(metric_category, metric_name);
CREATE INDEX idx_metrics_category_timestamp ON metrics(metric_category, timestamp DESC);
CREATE INDEX idx_metrics_name_timestamp ON metrics(metric_name, timestamp DESC);
CREATE INDEX idx_metrics_value ON metrics(metric_value) WHERE metric_value IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_metrics_task_category ON metrics(task_id, metric_category);
CREATE INDEX idx_metrics_eval_category ON metrics(evaluation_id, metric_category)
WHERE evaluation_id IS NOT NULL; -- Will be populated via trigger

-- Partial indexes for frequently accessed metrics
CREATE INDEX idx_metrics_performance ON metrics(metric_category, metric_name, metric_value)
WHERE metric_category = 'performance';
CREATE INDEX idx_metrics_efficiency ON metrics(metric_category, metric_name, metric_value)
WHERE metric_category = 'efficiency';
CREATE INDEX idx_metrics_cost ON metrics(metric_category, metric_name, metric_value)
WHERE metric_category = 'cost';
```

#### execution_events
Detailed timeline of execution events for debugging and analysis.

```sql
CREATE TABLE execution_events (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Event information
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,

    -- Timing and sequencing
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_number BIGSERIAL NOT NULL,

    -- Constraints
    CONSTRAINT events_unique_sequence UNIQUE(task_id, sequence_number)
);

-- Indexes for event timeline queries
CREATE INDEX idx_execution_events_task_timestamp ON execution_events(task_id, timestamp);
CREATE INDEX idx_execution_events_type_timestamp ON execution_events(event_type, timestamp DESC);
CREATE INDEX idx_execution_events_timestamp ON execution_events(timestamp DESC);
CREATE INDEX idx_execution_events_sequence ON execution_events(task_id, sequence_number);

-- JSONB index for event data queries
CREATE INDEX idx_execution_events_data_gin ON execution_events USING GIN(event_data);
```

### 2. Configuration Tables

#### agents
Agent configuration and metadata.

```sql
CREATE TABLE agents (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent information
    name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN ('swe-bench', 'gui-automation', 'general-reasoning', 'custom')),
    description TEXT,

    -- Configuration and capabilities
    configuration JSONB NOT NULL DEFAULT '{}',
    capabilities JSONB DEFAULT '[]',
    environment_requirements JSONB DEFAULT '{}',

    -- Status and metadata
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),

    -- Constraints
    CONSTRAINT agents_name_version_unique UNIQUE(name, version)
);

-- Indexes for agent queries
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type_status ON agents(type, status);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);

-- JSONB indexes for configuration queries
CREATE INDEX idx_agents_config_gin ON agents USING GIN(configuration);
CREATE INDEX idx_agents_capabilities_gin ON agents USING GIN(capabilities);
```

#### benchmarks
Benchmark definitions and configurations.

```sql
CREATE TABLE benchmarks (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Benchmark information
    name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN ('swe-bench', 'osworld', 'webarena', 'gaia', 'agentbench', 'custom')),
    description TEXT,

    -- Configuration
    configuration JSONB NOT NULL DEFAULT '{}',
    task_definition_format VARCHAR(50),
    evaluation_criteria JSONB DEFAULT '{}',
    success_thresholds JSONB DEFAULT '{}',

    -- Metadata
    task_count INTEGER NOT NULL DEFAULT 0,
    difficulty_distribution JSONB DEFAULT '{}',
    estimated_duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT benchmarks_name_version_unique UNIQUE(name, version),
    CONSTRAINT benchmarks_positive_task_count CHECK (task_count >= 0)
);

-- Indexes for benchmark queries
CREATE INDEX idx_benchmarks_name ON benchmarks(name);
CREATE INDEX idx_benchmarks_type ON benchmarks(type);
CREATE INDEX idx_benchmarks_task_count ON benchmarks(task_count);
CREATE INDEX idx_benchmarks_created_at ON benchmarks(created_at DESC);

-- JSONB indexes for configuration queries
CREATE INDEX idx_benchmarks_config_gin ON benchmarks USING GIN(configuration);
CREATE INDEX idx_benchmarks_criteria_gin ON benchmarks USING GIN(evaluation_criteria);
```

### 3. User and Access Control Tables

#### users
User accounts and authentication.

```sql
CREATE TABLE users (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User information
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),

    -- Authentication
    password_hash VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255),
    refresh_token_hash VARCHAR(255),

    -- Status and roles
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'operator', 'admin')),
    permissions JSONB DEFAULT '[]',

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for user queries
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_api_key ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;
```

#### user_sessions
Session management for authentication.

```sql
CREATE TABLE user_sessions (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session information
    session_token VARCHAR(255) NOT NULL UNIQUE,
    refresh_token VARCHAR(255) UNIQUE,

    -- Timing and status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    ip_address INET,
    user_agent TEXT,

    -- Constraints
    CONSTRAINT sessions_expiration_check CHECK (expires_at > created_at)
);

-- Indexes for session queries
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(is_active) WHERE is_active = true;
```

### 4. Audit and Logging Tables

#### audit_log
Comprehensive audit trail for all operations.

```sql
CREATE TABLE audit_log (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Operation information
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID,

    -- User information
    user_id UUID REFERENCES users(id),
    session_id UUID,

    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB DEFAULT '[]',

    -- Timing and metadata
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes for audit queries
CREATE INDEX idx_audit_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_operation ON audit_log(operation);
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_record_id ON audit_log(record_id);
CREATE INDEX idx_audit_table_timestamp ON audit_log(table_name, timestamp DESC);
```

### 5. System Management Tables

#### system_config
System configuration parameters.

```sql
CREATE TABLE system_config (
    -- Primary identification
    key VARCHAR(255) PRIMARY KEY,

    -- Configuration value
    value JSONB NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'object', 'array')),

    -- Metadata
    description TEXT,
    category VARCHAR(100),
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Indexes for config queries
CREATE INDEX idx_system_config_category ON system_config(category);
CREATE INDEX idx_system_config_sensitive ON system_config(is_sensitive) WHERE is_sensitive = true;
```

#### job_queue
Background job queue for async operations.

```sql
CREATE TABLE job_queue (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job information
    job_type VARCHAR(100) NOT NULL,
    job_data JSONB NOT NULL,

    -- Status and scheduling
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Retry information
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    error_details JSONB,

    -- Dependencies
    depends_on UUID REFERENCES job_queue(id),

    -- Constraints
    CONSTRAINT jobs_positive_priority CHECK (priority >= 0),
    CONSTRAINT jobs_positive_attempts CHECK (attempts >= 0 AND max_attempts > 0),
    CONSTRAINT jobs_time_order CHECK (
        (started_at IS NULL OR started_at >= scheduled_at) AND
        (completed_at IS NULL OR completed_at >= started_at)
    )
);

-- Indexes for job processing
CREATE INDEX idx_jobs_status_priority ON job_queue(status, priority DESC, scheduled_at);
CREATE INDEX idx_jobs_type_status ON job_queue(job_type, status);
CREATE INDEX idx_jobs_scheduled_at ON job_queue(scheduled_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_jobs_depends_on ON job_queue(depends_on) WHERE depends_on IS NOT NULL;
```

## Advanced Database Features

### 1. Triggers and Functions

#### Update Evaluation Statistics Trigger
```sql
-- Function to update evaluation statistics when tasks are updated
CREATE OR REPLACE FUNCTION update_evaluation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE evaluations SET
            completed_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE evaluation_id = NEW.evaluation_id
                AND status IN ('completed', 'failed', 'timeout', 'cancelled')
            ),
            successful_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE evaluation_id = NEW.evaluation_id
                AND status = 'completed'
                AND (result_summary->>'success')::boolean = true
            ),
            failed_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE evaluation_id = NEW.evaluation_id
                AND status IN ('failed', 'timeout')
            ),
            updated_at = NOW()
        WHERE id = NEW.evaluation_id;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE evaluations SET
            completed_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE evaluation_id = OLD.evaluation_id
                AND status IN ('completed', 'failed', 'timeout', 'cancelled')
            ),
            successful_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE evaluation_id = OLD.evaluation_id
                AND status = 'completed'
                AND (result_summary->>'success')::boolean = true
            ),
            failed_tasks = (
                SELECT COUNT(*) FROM tasks
                WHERE evaluation_id = OLD.evaluation_id
                AND status IN ('failed', 'timeout')
            ),
            updated_at = NOW()
        WHERE id = OLD.evaluation_id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_evaluation_stats
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_evaluation_stats();
```

#### Audit Logging Trigger
```sql
-- Generic audit logging function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values, changed_fields)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW),
                (SELECT array_agg(key) FROM jsonb_object_keys(row_to_json(NEW))));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, new_values, changed_fields)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD), row_to_json(NEW),
                (SELECT array_agg(key) FROM jsonb_object_keys(row_to_json(NEW))
                 WHERE jsonb_extract_path_text(row_to_json(NEW), key) !=
                       jsonb_extract_path_text(row_to_json(OLD), key)));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_evaluations
    AFTER INSERT OR UPDATE OR DELETE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_tasks
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_agents
    AFTER INSERT OR UPDATE OR DELETE ON agents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

### 2. Views for Common Queries

#### Evaluation Summary View
```sql
CREATE VIEW evaluation_summary AS
SELECT
    e.id,
    e.agent_name,
    e.agent_version,
    e.benchmark_type,
    e.benchmark_version,
    e.status,
    e.created_at,
    e.started_at,
    e.completed_at,
    e.duration_seconds,
    e.success_rate,
    e.total_tasks,
    e.completed_tasks,
    e.successful_tasks,
    e.failed_tasks,

    -- Aggregated performance metrics
    AVG(CASE WHEN m.metric_name = 'task_success_rate' THEN m.metric_value END) as avg_task_success_rate,
    AVG(CASE WHEN m.metric_name = 'completion_percentage' THEN m.metric_value END) as avg_completion_percentage,

    -- Aggregated efficiency metrics
    AVG(CASE WHEN m.metric_name = 'total_execution_time' THEN m.metric_value END) as avg_execution_time,
    AVG(CASE WHEN m.metric_name = 'latency_per_step' THEN m.metric_value END) as avg_latency_per_step,
    AVG(CASE WHEN m.metric_name = 'number_of_steps' THEN m.metric_value END) as avg_steps,

    -- Aggregated cost metrics
    AVG(CASE WHEN m.metric_name = 'total_llm_tokens' THEN m.metric_value END) as avg_tokens,
    AVG(CASE WHEN m.metric_name = 'estimated_api_cost' THEN m.metric_value END) as avg_cost,
    SUM(CASE WHEN m.metric_name = 'estimated_api_cost' THEN m.metric_value END) as total_cost

FROM evaluations e
LEFT JOIN tasks t ON e.id = t.evaluation_id
LEFT JOIN metrics m ON t.id = m.task_id
GROUP BY e.id, e.agent_name, e.agent_version, e.benchmark_type, e.benchmark_version,
         e.status, e.created_at, e.started_at, e.completed_at, e.duration_seconds,
         e.success_rate, e.total_tasks, e.completed_tasks, e.successful_tasks, e.failed_tasks;
```

#### Performance Leaderboard View
```sql
CREATE VIEW performance_leaderboard AS
SELECT
    e.agent_name,
    e.agent_version,
    e.benchmark_type,
    COUNT(DISTINCT e.id) as evaluation_count,
    SUM(e.total_tasks) as total_tasks,
    SUM(e.successful_tasks) as successful_tasks,
    AVG(e.success_rate) as avg_success_rate,
    AVG(e.duration_seconds) as avg_duration,

    -- Performance metrics
    AVG(p.task_success_rate) as avg_performance_success_rate,
    AVG(p.completion_percentage) as avg_completion_percentage,

    -- Efficiency metrics
    AVG(ef.total_execution_time) as avg_efficiency_time,
    AVG(ef.latency_per_step) as avg_latency,
    AVG(ef.number_of_steps) as avg_steps,

    -- Cost metrics
    AVG(c.total_llm_tokens) as avg_tokens,
    AVG(c.estimated_api_cost) as avg_cost,
    SUM(c.estimated_api_cost) as total_cost,

    -- Quality metrics
    AVG(q.tool_selection_accuracy) as avg_tool_accuracy,
    AVG(q.parameter_accuracy) as avg_param_accuracy,

    -- Ranking calculation (weighted score)
    (
        AVG(e.success_rate) * 0.4 +
        AVG(p.completion_percentage) * 0.2 +
        (1 - (AVG(c.estimated_api_cost) / NULLIF(MAX(c.estimated_api_cost) OVER (), 0))) * 0.2 +
        AVG(q.tool_selection_accuracy) * 0.2
    ) as weighted_score

FROM evaluations e
LEFT JOIN tasks t ON e.id = t.evaluation_id
LEFT JOIN metrics p ON t.id = p.task_id AND p.metric_category = 'performance'
LEFT JOIN metrics ef ON t.id = ef.task_id AND ef.metric_category = 'efficiency'
LEFT JOIN metrics c ON t.id = c.task_id AND c.metric_category = 'cost'
LEFT JOIN metrics q ON t.id = q.task_id AND q.metric_category = 'quality'
WHERE e.status = 'completed'
GROUP BY e.agent_name, e.agent_version, e.benchmark_type
HAVING COUNT(DISTINCT e.id) >= 1; -- At least one completed evaluation
```

#### Real-time Metrics View
```sql
CREATE MATERIALIZED VIEW real_time_metrics AS
SELECT
    e.id as evaluation_id,
    e.agent_name,
    e.benchmark_type,
    e.status,

    -- Current progress
    COUNT(t.id) as total_tasks_in_view,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks_current,
    COUNT(CASE WHEN t.status = 'running' THEN 1 END) as running_tasks_current,

    -- Latest metrics by category
    (SELECT metric_value FROM metrics m1
     JOIN tasks t1 ON m1.task_id = t1.id
     WHERE t1.evaluation_id = e.id AND m1.metric_category = 'performance' AND m1.metric_name = 'task_success_rate'
     ORDER BY m1.timestamp DESC LIMIT 1) as current_success_rate,

    (SELECT metric_value FROM metrics m2
     JOIN tasks t2 ON m2.task_id = t2.id
     WHERE t2.evaluation_id = e.id AND m2.metric_category = 'efficiency' AND m2.metric_name = 'total_execution_time'
     ORDER BY m2.timestamp DESC LIMIT 1) as latest_execution_time,

    -- Timestamps
    MAX(m.timestamp) as latest_metric_timestamp,
    e.updated_at as last_update

FROM evaluations e
LEFT JOIN tasks t ON e.id = t.evaluation_id
LEFT JOIN metrics m ON t.id = m.task_id
WHERE e.status IN ('running', 'pending')
GROUP BY e.id, e.agent_name, e.benchmark_type, e.status, e.updated_at;

-- Create unique index for refresh
CREATE UNIQUE INDEX idx_real_time_metrics_unique ON real_time_metrics(evaluation_id);

-- Index for querying
CREATE INDEX idx_real_time_metrics_status ON real_time_metrics(status, last_update DESC);
```

### 3. Indexing Strategy for Performance

#### Composite Indexes for Common Query Patterns
```sql
-- Evaluation dashboard queries
CREATE INDEX idx_evaluations_dashboard ON evaluations(status, benchmark_type, created_at DESC, success_rate);
CREATE INDEX idx_evaluations_agent_performance ON evaluations(agent_name, agent_version, success_rate, duration_seconds);

-- Task analysis queries
CREATE INDEX idx_tasks_analysis ON tasks(evaluation_id, status, task_type, execution_time_ms);
CREATE INDEX idx_tasks_cost_analysis ON tasks(evaluation_id, cost_usd, tokens_used) WHERE cost_usd > 0;

-- Metrics aggregation queries
CREATE INDEX idx_metrics_aggregation ON metrics(task_id, metric_category, metric_name, timestamp);
CREATE INDEX idx_metrics_time_series ON metrics(metric_category, metric_name, timestamp DESC, metric_value);

-- Leaderboard queries
CREATE INDEX idx_evaluations_leaderboard ON evaluations(benchmark_type, agent_name, success_rate, completed_at DESC);
CREATE INDEX idx_tasks_leaderboard ON tasks(evaluation_id, status, cost_usd, execution_time_ms);
```

#### Partial Indexes for Specific Use Cases
```sql
-- Active evaluations
CREATE INDEX idx_evaluations_active ON evaluations(id, agent_name, status, created_at)
WHERE status IN ('pending', 'running');

-- Failed tasks for error analysis
CREATE INDEX idx_tasks_failed ON tasks(evaluation_id, task_type, error_type, created_at)
WHERE status IN ('failed', 'timeout');

-- High-cost tasks for cost optimization
CREATE INDEX idx_tasks_high_cost ON tasks(evaluation_id, cost_usd DESC)
WHERE cost_usd > 1.0;

-- Slow tasks for performance analysis
CREATE INDEX idx_tasks_slow ON tasks(evaluation_id, execution_time_ms DESC)
WHERE execution_time_ms > 300000; -- 5 minutes

-- Recent metrics for dashboard
CREATE INDEX idx_metrics_recent ON metrics(timestamp DESC, metric_category, metric_value)
WHERE timestamp > NOW() - INTERVAL '7 days';
```

## Database Performance Optimization

### 1. Query Optimization

#### Efficient Pagination with Cursor-based Pagination
```sql
-- Function for efficient cursor-based pagination
CREATE OR REPLACE FUNCTION get_evaluations_cursor(
    p_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_agent_name VARCHAR(255) DEFAULT NULL,
    p_benchmark_type VARCHAR(100) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    agent_name VARCHAR(255),
    benchmark_type VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    success_rate DECIMAL(5,4),
    next_cursor TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.agent_name,
        e.benchmark_type,
        e.status,
        e.created_at,
        e.success_rate,
        e.created_at as next_cursor
    FROM evaluations e
    WHERE
        (p_cursor IS NULL OR e.created_at < p_cursor)
        AND (p_agent_name IS NULL OR e.agent_name = p_agent_name)
        AND (p_benchmark_type IS NULL OR e.benchmark_type = p_benchmark_type)
        AND (p_status IS NULL OR e.status = p_status)
    ORDER BY e.created_at DESC
    LIMIT p_limit + 1; -- +1 to check if there are more results
END;
$$ LANGUAGE plpgsql;
```

#### Materialized Views for Heavy Analytics
```sql
-- Refresh strategy for real-time metrics
CREATE OR REPLACE FUNCTION refresh_real_time_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY real_time_metrics;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every 30 seconds (requires pg_cron extension)
-- SELECT cron.schedule('refresh-real-time-metrics', '*/30 * * * *', 'SELECT refresh_real_time_metrics();');
```

### 2. Connection Pooling Configuration

#### PgBouncer Configuration
```ini
[databases]
haseb = host=localhost port=5432 dbname=haseb

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = postgres
stats_users = stats, postgres

# Connection pooling settings
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 50
max_user_connections = 50

# Server settings
server_reset_query = DISCARD ALL
server_check_delay = 30
server_check_query = select 1
server_lifetime = 3600
server_idle_timeout = 600
```

### 3. Partitioning Strategy

#### Time-based Partitioning for Large Tables
```sql
-- Enable partitioning (PostgreSQL 10+)
-- Partition evaluations by month
CREATE TABLE evaluations_partitioned (
    LIKE evaluations INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE evaluations_y2024m01 PARTITION OF evaluations_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE evaluations_y2024m02 PARTITION OF evaluations_partitioned
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Partition metrics by time for performance
CREATE TABLE metrics_partitioned (
    LIKE metrics INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create weekly partitions for metrics (more frequent updates)
CREATE TABLE metrics_y2024w01 PARTITION OF metrics_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-01-08');

-- Partition execution events by time (highest write frequency)
CREATE TABLE execution_events_partitioned (
    LIKE execution_events INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create daily partitions for execution events
CREATE TABLE execution_events_y2024m01d01 PARTITION OF execution_events_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-01-02');
```

### 4. Monitoring and Maintenance

#### Performance Monitoring Query
```sql
-- Query to monitor database performance
CREATE OR REPLACE VIEW database_performance_stats AS
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats
WHERE schemaname = 'public'
AND tablename IN ('evaluations', 'tasks', 'metrics', 'execution_events')
ORDER BY schemaname, tablename, attname;
```

#### Automated Maintenance Functions
```sql
-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old execution events (keep 30 days)
    DELETE FROM execution_events
    WHERE timestamp < NOW() - INTERVAL '30 days';

    -- Delete old metrics (keep 90 days)
    DELETE FROM metrics
    WHERE timestamp < NOW() - INTERVAL '90 days';

    -- Archive old evaluations (keep 1 year in primary table)
    -- Move to archive table or delete based on requirements

    -- Update table statistics
    ANALYZE evaluations;
    ANALYZE tasks;
    ANALYZE metrics;
    ANALYZE execution_events;

    -- Reindex fragmented indexes
    REINDEX INDEX CONCURRENTLY idx_evaluations_status_created;
    REINDEX INDEX CONCURRENTLY idx_metrics_task_id;
END;
$$ LANGUAGE plpgsql;
```

## Security Considerations

### 1. Row-Level Security (RLS)

#### Enable RLS for Sensitive Tables
```sql
-- Enable RLS on user-specific data
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own evaluations
CREATE POLICY user_evaluations_policy ON evaluations
    FOR ALL TO authenticated_users
    USING (created_by = current_setting('app.current_user_id')::UUID);

-- Policy for users to manage only their own sessions
CREATE POLICY user_sessions_policy ON user_sessions
    FOR ALL TO authenticated_users
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

### 2. Encryption and Data Protection

#### Column-level Encryption for Sensitive Data
```sql
-- Extension for encryption (pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt sensitive configuration data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data JSONB)
RETURNS JSONB AS $$
BEGIN
    -- Encrypt specific sensitive fields in configuration
    RETURN jsonb_set(
        jsonb_set(
            data,
            '{api_keys}',
            CASE
                WHEN data ? 'api_keys' THEN
                    ('"' || encode(encrypt(data->>'api_keys'::bytea, current_setting('app.encryption_key'), 'aes'), 'hex') || '"')::jsonb
                ELSE data->'api_keys'
            END
        ),
        '{passwords}',
        CASE
            WHEN data ? 'passwords' THEN
                ('"' || encode(encrypt(data->>'passwords'::bytea, current_setting('app.encryption_key'), 'aes'), 'hex') || '"')::jsonb
            ELSE data->'passwords'
        END
    );
END;
$$ LANGUAGE plpgsql;
```

This comprehensive database schema design provides a solid foundation for the HASEB platform, ensuring optimal performance, scalability, and data integrity while supporting complex evaluation workflows and real-time analytics requirements.