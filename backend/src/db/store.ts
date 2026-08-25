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
  const baseName = name.trim() || 'Untitled workflow';
  for (let number = 1; number <= 1000; number++) {
    const candidate = number === 1 ? baseName : `${baseName} ${number}`;
    try {
      const { rows } = await pool.query(
        `INSERT INTO workflows (name)
         SELECT $1
         WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE lower(btrim(name)) = lower(btrim($1)))
         RETURNING *`,
        [candidate]
      );
      if (rows[0]) return rows[0];
    } catch (error: any) {
      if (error?.code !== '23505') throw error;
    }
  }
  throw new Error('Unable to generate a unique workflow name.');
}

export async function renameWorkflow(id: string, name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Workflow name cannot be empty.');
  const duplicate = await pool.query(
    `SELECT 1 FROM workflows WHERE id <> $1 AND lower(btrim(name)) = lower($2) LIMIT 1`,
    [id, trimmedName]
  );
  if (duplicate.rows[0]) throw new Error(`A workflow named "${trimmedName}" already exists.`);

  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE workflows SET name = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, trimmedName]
    ));
  } catch (error: any) {
    if (error?.code === '23505') throw new Error(`A workflow named "${trimmedName}" already exists.`);
    throw error;
  }
  if (!rows[0]) throw new Error(`Workflow ${id} not found`);
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
      `SELECT id, node_id, run_at, status, retry_count, last_error, last_attempt_at, claimed_at, created_at
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

/** Atomically claim due jobs. SKIP LOCKED lets many workers safely poll together. */
export async function claimDueJobs(limit = 20) {
  const { rows } = await pool.query(
    `WITH candidates AS (
       SELECT id FROM scheduled_jobs
       WHERE status = 'pending'
         AND run_at <= now()
         AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes')
       ORDER BY run_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE scheduled_jobs job
     SET claimed_at = now(), last_attempt_at = now(), retry_count = retry_count + 1
     FROM candidates
     WHERE job.id = candidates.id
     RETURNING job.*`,
    [limit]
  );
  return rows;
}

export async function markJobDone(id: string) {
  await pool.query(`UPDATE scheduled_jobs SET status = 'done', claimed_at = NULL, last_error = NULL WHERE id = $1`, [id]);
}

export async function markJobFailed(id: string, error: string, maxAttempts: number, retryDelaySeconds: number) {
  const { rows } = await pool.query(
    `UPDATE scheduled_jobs
     SET status = CASE WHEN retry_count >= $3 THEN 'failed' ELSE 'pending' END,
         last_error = $2,
         claimed_at = NULL,
         run_at = CASE WHEN retry_count >= $3 THEN run_at ELSE now() + ($4 * interval '1 second') END
     WHERE id = $1
     RETURNING *`,
    [id, error, maxAttempts, retryDelaySeconds]
  );
  return rows[0];
}

export async function markExecutionFailed(id: string) {
  await pool.query(`UPDATE executions SET status = 'failed', updated_at = now() WHERE id = $1`, [id]);
}
