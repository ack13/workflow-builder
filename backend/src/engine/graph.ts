import { WorkflowGraph, GraphNode, NodeType } from '../types';

const NODE_TYPES = new Set<NodeType>([
  'trigger', 'delay', 'branch', 'communicate', 'set_status', 'goto', 'goal',
]);

/** Validate persisted JSON before the interpreter tries to execute it. */
export function validateGraph(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return ['The published workflow graph is missing or malformed.'];

  const graph = value as Partial<WorkflowGraph>;
  if (!Array.isArray(graph.nodes)) errors.push('The graph must contain a nodes array.');
  if (!Array.isArray(graph.edges)) errors.push('The graph must contain an edges array.');
  if (errors.length) return errors;

  const nodes = graph.nodes!;
  const edges = graph.edges!;
  const ids = new Set<string>();
  const isConfigured = (field: unknown) => typeof field === 'string' && field.trim().length > 0;

  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id.trim()) {
      errors.push('Every node must have a non-empty ID.');
      continue;
    }
    if (ids.has(node.id)) errors.push(`Node ID "${node.id}" is duplicated.`);
    ids.add(node.id);
    if (!NODE_TYPES.has(node.type)) errors.push(`Node "${node.id}" has unsupported type "${node.type}".`);
  }

  const triggers = nodes.filter((node) => node?.type === 'trigger');
  if (triggers.length === 0) errors.push('Add exactly one Trigger step before publishing.');
  if (triggers.length > 1) errors.push('A workflow must contain exactly one Trigger step.');
  if (triggers.length === 1 && triggers[0].data?.triggerType !== 'manual') {
    errors.push('Only Manual triggers are currently supported. Change the Trigger type to manual.');
  }

  for (const edge of edges) {
    if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      errors.push('Every connection must have a source and target.');
      continue;
    }
    if (!ids.has(edge.source)) errors.push(`Connection source "${edge.source}" does not exist.`);
    if (!ids.has(edge.target)) errors.push(`Connection target "${edge.target}" does not exist.`);
  }

  // Validate each step's required configuration and output paths.
  for (const node of nodes) {
    if (!node?.id || !NODE_TYPES.has(node.type)) continue;
    const outgoing = edges.filter((edge) => edge?.source === node.id);

    switch (node.type) {
      case 'trigger':
        if (outgoing.length === 0) errors.push(`Trigger "${node.id}" must have an outgoing connection.`);
        break;
      case 'delay': {
        const unitSizes: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
        const modernDuration = Number(node.data?.durationValue) * unitSizes[node.data?.durationUnit];
        const legacyDuration = Number(node.data?.durationMs);
        if ((!Number.isFinite(modernDuration) || modernDuration <= 0) && (!Number.isFinite(legacyDuration) || legacyDuration <= 0)) {
          errors.push(`Delay "${node.id}" requires a duration greater than zero.`);
        }
        break;
      }
      case 'branch': {
        if (!isConfigured(node.data?.field)) errors.push(`Branch "${node.id}" requires a context field.`);
        if (!['equals', 'not_equals', 'gt', 'lt', 'exists'].includes(node.data?.operator)) {
          errors.push(`Branch "${node.id}" requires a valid operator.`);
        }
        if (node.data?.operator !== 'exists' && !isConfigured(String(node.data?.value ?? ''))) {
          errors.push(`Branch "${node.id}" requires a comparison value.`);
        }
        const yesCount = outgoing.filter((edge) => edge.sourceHandle === 'yes').length;
        const noCount = outgoing.filter((edge) => edge.sourceHandle === 'no').length;
        if (yesCount !== 1) errors.push(`Branch "${node.id}" must have exactly one yes path.`);
        if (noCount !== 1) errors.push(`Branch "${node.id}" must have exactly one no path.`);
        break;
      }
      case 'communicate':
        if (!isConfigured(node.data?.to)) errors.push(`Send email "${node.id}" requires a recipient.`);
        if (!isConfigured(node.data?.subject)) errors.push(`Send email "${node.id}" requires a subject.`);
        break;
      case 'set_status':
        if (!isConfigured(node.data?.status)) errors.push(`Set status "${node.id}" requires a status value.`);
        break;
      case 'goto':
        if (!isConfigured(node.data?.targetNodeId)) {
          errors.push(`Go To "${node.id}" requires a target step.`);
        } else if (!ids.has(node.data.targetNodeId)) {
          errors.push(`Go To "${node.id}" targets missing step "${node.data.targetNodeId}".`);
        }
        break;
      case 'goal':
        if (!isConfigured(node.data?.label)) errors.push(`Goal "${node.id}" requires a label.`);
        break;
    }
  }

  // Build the graph the interpreter actually follows. Goal ignores outgoing
  // edges, while Go To ignores edges and jumps through targetNodeId.
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node?.id) continue;
    if (node.type === 'goal') {
      adjacency.set(node.id, []);
    } else if (node.type === 'goto') {
      adjacency.set(node.id, ids.has(node.data?.targetNodeId) ? [node.data.targetNodeId] : []);
    } else {
      adjacency.set(node.id, edges
        .filter((edge) => edge?.source === node.id && ids.has(edge.target))
        .map((edge) => edge.target));
    }
  }

  if (triggers.length === 1) {
    const reachable = new Set<string>();
    const pending = [triggers[0].id];
    while (pending.length) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const target of adjacency.get(id) ?? []) pending.push(target);
    }
    for (const node of nodes) {
      if (node?.id && !reachable.has(node.id)) errors.push(`${node.type} "${node.id}" is not reachable from the Trigger.`);
    }
  }

  // Any directed cycle can repeatedly execute side effects, so publishing it
  // is unsafe even though the runtime also has a maximum-step guard.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycleAt: string | null = null;
  const visit = (id: string): boolean => {
    if (visiting.has(id)) { cycleAt = id; return true; }
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of adjacency.get(id) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of ids) {
    if (visit(id)) break;
  }
  if (cycleAt) errors.push(`Unsafe cycle detected near step "${cycleAt}". Remove the loop before publishing.`);

  return [...new Set(errors)];
}

/** First outgoing edge's target from a node, optionally filtered by sourceHandle (branch outputs). */
export function nextNodeId(
  graph: WorkflowGraph,
  nodeId: string,
  sourceHandle?: string
): string | null {
  const edge = graph.edges.find(
    (e) => e.source === nodeId && (sourceHandle === undefined || e.sourceHandle === sourceHandle)
  );
  return edge ? edge.target : null;
}

export function getNode(graph: WorkflowGraph, nodeId: string): GraphNode {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found in graph`);
  return node;
}
