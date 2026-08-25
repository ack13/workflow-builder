-- Workflow Builder DB Schema (Postgres)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- A workflow. The graph (nodes + edges) is stored as JSONB.
-- draft_graph is what the builder UI edits. published_graph is the
-- immutable snapshot that the rule engine actually executes against,
-- so live executions are never affected by someone editing the draft.
CREATE TABLE workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  draft_graph     JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}',
  published_graph JSONB,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One run of a published workflow for one "entity" (e.g. an application,
-- a student). Holds the engine's current position + working memory.
CREATE TABLE executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id         UUID NOT NULL REFERENCES workflows(id),
  published_at        TIMESTAMPTZ NOT NULL, -- pins execution to the graph version that was live when it started
  entity_type         TEXT NOT NULL,        -- e.g. 'application'
  entity_id           TEXT NOT NULL,        -- id of the record this run is about
  status              TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'waiting', 'completed', 'failed', 'cancelled')),
  current_node_id     TEXT,
  context             JSONB NOT NULL DEFAULT '{}', -- variables the engine/nodes read & write
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_executions_workflow ON executions(workflow_id);
CREATE INDEX idx_executions_status ON executions(status);

-- Audit trail: one row per node the engine visited for an execution.
CREATE TABLE execution_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID NOT NULL REFERENCES executions(id),
  node_id       TEXT NOT NULL,
  node_type     TEXT NOT NULL,
  action        TEXT NOT NULL,       -- e.g. 'entered', 'branch_taken', 'email_sent', 'completed'
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_execution ON execution_logs(execution_id);

-- Delay nodes park an execution here instead of blocking a thread.
-- A scheduler polls this table and resumes executions whose time has come.
CREATE TABLE scheduled_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID NOT NULL REFERENCES executions(id),
  node_id       TEXT NOT NULL,
  run_at        TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_due ON scheduled_jobs(status, run_at);
