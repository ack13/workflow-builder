import { NodeHandler } from '../../types';

// data: { durationMs: number }  (builder UI can offer "3 days" and convert to ms)
export const delayHandler: NodeHandler = {
  execute(node) {
    const durationMs = Number(node.data?.durationMs ?? 0);
    const resumeAt = new Date(Date.now() + durationMs);
    return { action: 'wait', resumeAt };
  },
};
