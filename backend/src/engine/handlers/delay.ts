import { NodeHandler } from '../../types';

const UNIT_MS: Record<string, number> = {
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

// New graphs store a readable value/unit pair. durationMs remains supported
// for workflows saved before the duration controls were introduced.
export const delayHandler: NodeHandler = {
  execute(node) {
    const value = Number(node.data?.durationValue);
    const multiplier = UNIT_MS[node.data?.durationUnit];
    const durationMs = Number.isFinite(value) && value > 0 && multiplier
      ? value * multiplier
      : Number(node.data?.durationMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return { action: 'fail', reason: 'Delay duration must be greater than zero.' };
    }
    const resumeAt = new Date(Date.now() + durationMs);
    return { action: 'wait', resumeAt };
  },
};
