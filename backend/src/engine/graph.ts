import { WorkflowGraph, GraphNode } from '../types';

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
