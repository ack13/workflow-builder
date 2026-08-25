import StepNode from './StepNode.jsx';
import { NODE_TYPE_LIST } from './stepConfig';

export const nodeTypes = Object.fromEntries(NODE_TYPE_LIST.map((t) => [t, StepNode]));
export { NODE_CONFIG, NODE_TYPE_LIST, summarizeNode } from './stepConfig';
