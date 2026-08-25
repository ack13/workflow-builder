import * as store from '../db/store';
import { WorkflowEngine } from './WorkflowEngine';

const POLL_INTERVAL_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_SECONDS = 30;
const engine = new WorkflowEngine();

// A simple poller is enough at moderate volume. At real scale, swap this
// for a proper job queue (BullMQ/pg-boss) driven off the same
// scheduled_jobs table, using SELECT ... FOR UPDATE SKIP LOCKED so
// multiple worker instances don't double-process the same job.
export function startScheduler() {
  setInterval(async () => {
    try {
      const due = await store.claimDueJobs();
      for (const job of due) {
        try {
          await engine.resume(job.execution_id);
          await store.markJobDone(job.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const updated = await store.markJobFailed(job.id, message, MAX_ATTEMPTS, RETRY_DELAY_SECONDS);
          await store.logStep(job.execution_id, job.node_id, 'delay', updated.status === 'failed' ? 'scheduler_failed' : 'scheduler_retry', {
            attempt: updated.retry_count,
            maxAttempts: MAX_ATTEMPTS,
            error: message,
          });
          if (updated.status === 'failed') await store.markExecutionFailed(job.execution_id);
          console.error(`[scheduler] attempt ${updated.retry_count}/${MAX_ATTEMPTS} failed for execution ${job.execution_id}:`, err);
        }
      }
    } catch (err) {
      console.error('[scheduler] failed to claim due jobs:', err);
    }
  }, POLL_INTERVAL_MS);
}
