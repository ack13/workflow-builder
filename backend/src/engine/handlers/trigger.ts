import { NodeHandler } from '../../types';
import { nextNodeId } from '../graph';

// data: { triggerType: 'manual' }. Event and schedule adapters are intentionally
// not exposed until something external is wired up to call engine.start().
// Purely descriptive at execution time — by the time the engine reaches
// this node the execution already exists, so it just moves on. The real
// "triggering" logic lives in whatever calls engine.start() (see below).
export const triggerHandler: NodeHandler = {
  execute(node, graph) {
    return { action: 'continue', nextNodeId: nextNodeId(graph, node.id) };
  },
};
