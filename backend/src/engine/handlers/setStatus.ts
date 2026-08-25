import { NodeHandler } from '../../types';
import { nextNodeId } from '../graph';
import { updateEntityStatus } from '../../services/entityService';

// data: { status: string }  e.g. "under_review", "offer_sent"
export const setStatusHandler: NodeHandler = {
  async execute(node, graph, execution) {
    await updateEntityStatus(execution.entity_type, execution.entity_id, node.data?.status);
    execution.context.status = node.data?.status; // keep in-memory context in sync too
    return { action: 'continue', nextNodeId: nextNodeId(graph, node.id) };
  },
};
