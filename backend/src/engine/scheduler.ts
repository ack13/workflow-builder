import * as store from '../db/store';
import { WorkflowEngine } from './WorkflowEngine';

const POLL_INTERVAL_MS = 15_000;
const engine = new WorkflowEngine();

// A simple poller is enough at moderate volume. At real scale, swap this
// for a proper job queue (BullMQ/pg-boss) driven off the same
// scheduled_jobs table, using SELECT ... FOR UPDATE SKIP LOCKED so
// multiple worker instances don't double-process the same job.
export function startScheduler() {
  setInterval(async () => {
    const due = await store.getDueJobs();
    for (const job of due) {
      try {
        await engine.resume(job.execution_id);
        await store.markJobDone(job.id);
      } catch (err) {
        console.error(`[scheduler] failed to resume execution ${job.execution_id}:`, err);
      }
    }
  }, POLL_INTERVAL_MS);
}
