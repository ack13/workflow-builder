import { pool } from './pool';
import { Execution, WorkflowGraph } from '../types';

export async function listWorkflows() {
  const { rows } = await pool.query(
    `SELECT id, name, status, published_at, created_at, updated_at FROM workflows ORDER BY updated_at DESC`
  );
  return rows;
}

export async function getWorkflow(id: string) {
  const { rows } = await pool.query('SELECT * FROM workflows WHERE id = $1', [id]);
  if (!rows[0]) throw new Error(`Workflow ${id} not found`);
  return rows[0];
}

export async function createWorkflow(name: string) {
  const { rows } = await pool.query(
    `INSERT INTO workflows (name) VALUES ($1) RETURNING *`,
    [name]
  );
  return rows[0];
}

export async function renameWorkflow(id: string, name: string) {
  const { rows } = await pool.query(
    `UPDATE workflows SET name = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, name]
  );
  return rows[0];
}

export async function saveDraft(id: string, graph: WorkflowGraph) {
  const { rows } = await pool.query(
    `UPDATE workflows SET draft_graph = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, graph]
  );
  return rows[0];
}

export async function publish(id: string) {
  const { rows } = await pool.query(
    `UPDATE workflows
     SET status = 'published', published_graph = draft_graph, published_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

export async function createExecution(exec: Omit<Execution, 'id'>) {
  const { rows } = await pool.query(
    `INSERT INTO executions (workflow_id, published_at, entity_type, entity_id, status, current_node_id, context)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [exec.workflow_id, exec.published_at, exec.entity_type, exec.entity_id, exec.status, exec.current_node_id, exec.context]
  );
  return rows[0] as Execution;
}

export async function getExecution(id: string) {
  const { rows } = await pool.query('SELECT * FROM executions WHERE id = $1', [id]);
  if (!rows[0]) throw new Error(`Execution ${id} not found`);
  return rows[0] as Execution;
}

export async function listExecutions(workflowId: string, limit = 50) {
  const { rows } = await pool.query(
    `SELECT e.*,
            next_job.run_at AS scheduled_resume_at
     FROM executions e
     LEFT JOIN LATERAL (
       SELECT run_at
       FROM scheduled_jobs
       WHERE execution_id = e.id AND status = 'pending'
       ORDER BY run_at ASC
       LIMIT 1
     ) next_job ON true
     WHERE e.workflow_id = $1
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [workflowId, limit]
  );
  return rows;
}

export async function getExecutionHistory(id: string) {
  const execution = await getExecution(id);
  const [logsResult, jobsResult] = await Promise.all([
    pool.query(
      `SELECT id, node_id, node_type, action, detail, created_at
       FROM execution_logs WHERE execution_id = $1 ORDER BY created_at ASC, id ASC`,
      [id]
    ),
    pool.query(
      `SELECT id, node_id, run_at, status, created_at
       FROM scheduled_jobs WHERE execution_id = $1 ORDER BY created_at ASC, id ASC`,
      [id]
    ),
  ]);
  return { execution, logs: logsResult.rows, scheduledJobs: jobsResult.rows };
}

export async function saveExecution(exec: Execution) {
  await pool.query(
    `UPDATE executions SET status=$2, current_node_id=$3, context=$4, updated_at=now() WHERE id=$1`,
    [exec.id, exec.status, exec.current_node_id, exec.context]
  );
}

export async function logStep(executionId: string, nodeId: string, nodeType: string, action: string, detail: Record<string, any> = {}) {
  await pool.query(
    `INSERT INTO execution_logs (execution_id, node_id, node_type, action, detail) VALUES ($1,$2,$3,$4,$5)`,
    [executionId, nodeId, nodeType, action, detail]
  );
}

export async function scheduleJob(executionId: string, nodeId: string, runAt: Date) {
  await pool.query(
    `INSERT INTO scheduled_jobs (execution_id, node_id, run_at) VALUES ($1,$2,$3)`,
    [executionId, nodeId, runAt]
  );
}

/** Jobs whose time has come, oldest first. Used by the scheduler poller. */
export async function getDueJobs(limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM scheduled_jobs WHERE status = 'pending' AND run_at <= now() ORDER BY run_at ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function markJobDone(id: string) {
  await pool.query(`UPDATE scheduled_jobs SET status = 'done' WHERE id = $1`, [id]);
}
