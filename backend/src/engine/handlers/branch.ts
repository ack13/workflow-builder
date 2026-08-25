import { NodeHandler, Execution } from '../../types';
import { nextNodeId } from '../graph';

type Operator = 'equals' | 'not_equals' | 'gt' | 'lt' | 'exists';

// data: { field: string, operator: Operator, value?: any }
// Reads `field` out of execution.context (dot-path, e.g. "application.feePaid").
// Edges leaving a branch node must set sourceHandle to 'yes' or 'no'.
function readPath(obj: Record<string, any>, path: string) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function evaluate(operator: Operator, actual: any, expected: any): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'exists':
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

export const branchHandler: NodeHandler = {
  execute(node, graph, execution: Execution) {
    const { field, operator, value } = node.data ?? {};
    const actual = readPath(execution.context, field);
    const matched = evaluate(operator, actual, value);
    const handle = matched ? 'yes' : 'no';
    return { action: 'continue', nextNodeId: nextNodeId(graph, node.id, handle) };
  },
};
