import { Router } from 'express';
import * as store from '../db/store';
import { WorkflowEngine } from '../engine/WorkflowEngine';
import { validateGraph } from '../engine/graph';

export const router = Router();
const engine = new WorkflowEngine();

// List view: intentionally excludes draft_graph/published_graph (they're
// full JSONB blobs) since a list page only needs name/status/timestamps.
router.get('/workflows', async (req, res) => {
  const workflows = await store.listWorkflows();
  res.json(workflows);
});

router.post('/workflows', async (req, res) => {
  const workflow = await store.createWorkflow(req.body.name ?? 'Untitled workflow');
  res.status(201).json(workflow);
});

router.get('/workflows/:id', async (req, res) => {
  const workflow = await store.getWorkflow(req.params.id);
  res.json(workflow);
});

router.get('/workflows/:id/executions', async (req, res) => {
  try {
    const executions = await store.listExecutions(req.params.id);
    return res.json(executions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load execution history.';
    return res.status(500).json({ error: message });
  }
});

// Autosave target for the canvas: { nodes: [...], edges: [...] }
router.put('/workflows/:id/draft', async (req, res) => {
  const workflow = await store.saveDraft(req.params.id, req.body);
  res.json(workflow);
});

router.put('/workflows/:id/name', async (req, res) => {
  const workflow = await store.renameWorkflow(req.params.id, req.body.name);
  res.json(workflow);
});

router.post('/workflows/:id/publish', async (req, res) => {
  try {
    const current = await store.getWorkflow(req.params.id);
    const errors = validateGraph(current.draft_graph);
    if (errors.length) return res.status(400).json({ error: 'Workflow validation failed.', errors });

    const workflow = await store.publish(req.params.id);
    return res.json(workflow);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish workflow.';
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

// Manually fire a workflow for testing, or wire this up behind real
// triggers (form submission webhook, cron for "fee overdue", etc).
router.post('/workflows/:id/run', async (req, res) => {
  try {
    const { entityType, entityId, context } = req.body;
    if (typeof entityType !== 'string' || !entityType.trim()) {
      return res.status(400).json({ error: 'Enter an entity type before running the workflow.' });
    }
    if (typeof entityId !== 'string' || !entityId.trim()) {
      return res.status(400).json({ error: 'Enter an entity ID before running the workflow.' });
    }
    if (context !== undefined && (context === null || Array.isArray(context) || typeof context !== 'object')) {
      return res.status(400).json({ error: 'Test context must be a JSON object.' });
    }

    const execution = await engine.start(req.params.id, entityType.trim(), entityId.trim(), context ?? {});
    return res.status(201).json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run workflow.';
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

router.get('/executions/:id', async (req, res) => {
  try {
    const execution = await store.getExecution(req.params.id);
    return res.json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution not found.';
    return res.status(404).json({ error: message });
  }
});

router.get('/executions/:id/history', async (req, res) => {
  try {
    const history = await store.getExecutionHistory(req.params.id);
    return res.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution history not found.';
    return res.status(404).json({ error: message });
  }
});
