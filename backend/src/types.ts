// Node types the builder can place on the canvas.
export type NodeType =
  | 'trigger'
  | 'delay'
  | 'branch'
  | 'communicate'
  | 'set_status'
  | 'goto'
  | 'goal';

export interface GraphNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, any>; // shape depends on `type`, see handlers
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; // used by branch nodes: 'yes' | 'no' | condition id
  label?: string;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Execution {
  id: string;
  workflow_id: string;
  published_at: string;
  entity_type: string;
  entity_id: string;
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  current_node_id: string | null;
  context: Record<string, any>;
}

// What a node handler returns to the engine after it runs.
export type HandlerResult =
  | { action: 'continue'; nextNodeId: string | null } // move on (null = no outgoing edge -> dead end)
  | { action: 'wait'; resumeAt: Date }                 // park execution (delay nodes)
  | { action: 'complete' }                              // goal reached
  | { action: 'fail'; reason: string };

export interface NodeHandler {
  execute(
    node: GraphNode,
    graph: WorkflowGraph,
    execution: Execution
  ): Promise<HandlerResult> | HandlerResult;
}
