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
  if (triggers.length === 0) errors.push('Add a Trigger step before running this workflow.');
  if (triggers.length > 1) errors.push('A workflow must contain exactly one Trigger step.');

  for (const edge of edges) {
    if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      errors.push('Every connection must have a source and target.');
      continue;
    }
    if (!ids.has(edge.source)) errors.push(`Connection source "${edge.source}" does not exist.`);
    if (!ids.has(edge.target)) errors.push(`Connection target "${edge.target}" does not exist.`);
  }

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
