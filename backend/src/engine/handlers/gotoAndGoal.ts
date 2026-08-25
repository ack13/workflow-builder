import { NodeHandler } from '../../types';
import { getNode } from '../graph';

// data: { targetNodeId: string } - jumps directly, ignoring outgoing edges.
export const gotoHandler: NodeHandler = {
  execute(node, graph) {
    const targetId = node.data?.targetNodeId;
    if (!targetId) {
      return { action: 'fail', reason: 'Go to action has no target step configured' };
    }
    try {
      getNode(graph, targetId); // validate target exists so a bad jump fails loudly instead of hanging
    } catch {
      return { action: 'fail', reason: `Go to action points at a step that no longer exists: ${targetId}` };
    }
    return { action: 'continue', nextNodeId: targetId };
  },
};

// data: { label: string } - terminal success node.
export const goalHandler: NodeHandler = {
  execute() {
    return { action: 'complete' };
  },
};
