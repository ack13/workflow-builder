import { Execution, GraphNode, NodeHandler, NodeType, WorkflowGraph } from '../types';
import { getNode, nextNodeId, validateGraph } from './graph';
import { triggerHandler } from './handlers/trigger';
import { delayHandler } from './handlers/delay';
import { branchHandler } from './handlers/branch';
import { communicateHandler } from './handlers/communicate';
import { setStatusHandler } from './handlers/setStatus';
import { gotoHandler, goalHandler } from './handlers/gotoAndGoal';
import * as store from '../db/store';

const handlers: Record<NodeType, NodeHandler> = {
  trigger: triggerHandler,
  delay: delayHandler,
  branch: branchHandler,
  communicate: communicateHandler,
  set_status: setStatusHandler,
  goto: gotoHandler,
  goal: goalHandler,
};

const MAX_STEPS_PER_TICK = 100; // guards against accidental infinite loops (goto cycles)

export class WorkflowEngine {
  /** Start a fresh execution against a workflow's *published* graph. */
  async start(workflowId: string, entityType: string, entityId: string, initialContext: Record<string, any> = {}) {
    const workflow = await store.getWorkflow(workflowId);
    if (!workflow.published_graph) throw new Error('Workflow has no published version');

    const graph: WorkflowGraph = workflow.published_graph;
    const graphErrors = validateGraph(graph);
    if (graphErrors.length) throw new Error(graphErrors.join(' '));
    const trigger = graph.nodes.find((n) => n.type === 'trigger');
    if (!trigger) throw new Error('Add a Trigger step before running this workflow.');

    const execution = await store.createExecution({
      workflow_id: workflowId,
      published_at: workflow.published_at,
      entity_type: entityType,
      entity_id: entityId,
      status: 'running',
      current_node_id: trigger.id,
      context: initialContext,
    });

    return this.run(execution, graph);
  }

  /** Resume an execution that was parked by a delay node whose time is due. */
  async resume(executionId: string) {
    const execution = await store.getExecution(executionId);
    const workflow = await store.getWorkflow(execution.workflow_id);
    const graph: WorkflowGraph = workflow.published_graph;

    // current_node_id still points at the delay node that parked us here.
    // Re-running it would just schedule another wait, so step past it
    // onto whatever it points to before re-entering the loop.
    execution.current_node_id = nextNodeId(graph, execution.current_node_id!);
    execution.status = execution.current_node_id ? 'running' : 'completed';

    if (!execution.current_node_id) {
      await store.saveExecution(execution);
      return execution;
    }
    return this.run(execution, graph);
  }

  /** Advance the execution, node by node, until it waits, completes, fails, or dead-ends. */
  private async run(execution: Execution, graph: WorkflowGraph) {
    let steps = 0;

    while (execution.current_node_id && steps < MAX_STEPS_PER_TICK) {
      steps++;
      const node: GraphNode = getNode(graph, execution.current_node_id);
      const handler = handlers[node.type];
      if (!handler) throw new Error(`No handler registered for node type "${node.type}"`);

      await store.logStep(execution.id, node.id, node.type, 'entered');
      const result = await handler.execute(node, graph, execution);

      if (result.action === 'continue') {
        execution.current_node_id = result.nextNodeId;
        if (result.nextNodeId === null) {
          execution.status = 'completed'; // ran off the end of the graph
          break;
        }
        continue;
      }

      if (result.action === 'wait') {
        execution.status = 'waiting';
        await store.scheduleJob(execution.id, node.id, result.resumeAt);
        break;
      }

      if (result.action === 'complete') {
        execution.status = 'completed';
        await store.logStep(execution.id, node.id, node.type, 'goal_reached');
        break;
      }

      if (result.action === 'fail') {
        execution.status = 'failed';
        await store.logStep(execution.id, node.id, node.type, 'failed', { reason: result.reason });
        break;
      }
    }

    if (steps >= MAX_STEPS_PER_TICK) {
      execution.status = 'failed';
      await store.logStep(execution.id, execution.current_node_id ?? 'unknown', 'unknown', 'failed', {
        reason: 'exceeded max steps - likely a goto loop',
      });
    }

    await store.saveExecution(execution);
    return execution;
  }
}
