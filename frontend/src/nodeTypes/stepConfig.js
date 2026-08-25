// Single source of truth for what a node type looks like on the canvas,
// in the legend/palette, and in the config (inspector) panel.
export const NODE_CONFIG = {
  trigger: {
    label: 'Trigger',
    description: 'Starts manually from the Run button.',
    color: '#7c3aed',
    hasInput: false,
    outputs: ['default'],
    defaultData: { triggerType: 'manual' },
    fields: [
      { key: 'triggerType', label: 'Trigger type', type: 'select', options: ['manual'] },
    ],
  },
  delay: {
    label: 'Delay',
    description: 'Wait.',
    color: '#0891b2',
    hasInput: true,
    outputs: ['default'],
    defaultData: { durationValue: 10, durationUnit: 'seconds' },
    fields: [{ key: 'duration', label: 'Wait for', type: 'duration' }],
  },
  branch: {
    label: 'Branch',
    description: 'Split the path.',
    color: '#d97706',
    hasInput: true,
    outputs: ['yes', 'no'],
    defaultData: { field: '', operator: 'equals', value: '' },
    fields: [
      { key: 'field', label: 'Context field', type: 'text', placeholder: 'e.g. record.status, order.total' },
      { key: 'operator', label: 'Operator', type: 'select', options: ['equals', 'not_equals', 'gt', 'lt', 'exists'] },
      { key: 'value', label: 'Value', type: 'text' },
    ],
  },
  communicate: {
    label: 'Communicate',
    description: 'Send an email.',
    color: '#2563eb',
    hasInput: true,
    outputs: ['default'],
    defaultData: { to: '{{contact.email}}', subject: '', body: '' },
    fields: [
      { key: 'to', label: 'To', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea' },
    ],
  },
  set_status: {
    label: 'Set status',
    description: "Change the record's status.",
    color: '#059669',
    hasInput: true,
    outputs: ['default'],
    defaultData: { status: '' },
    fields: [{ key: 'status', label: 'New status', type: 'text' }],
  },
  goto: {
    label: 'Go to action',
    description: 'Jump to another step.',
    color: '#4b5563',
    hasInput: true,
    outputs: [], // jumps are resolved via data.targetNodeId, not an edge
    defaultData: { targetNodeId: '' },
    fields: [{ key: 'targetNodeId', label: 'Target step', type: 'node_select' }],
  },
  goal: {
    label: 'Goal',
    description: 'What counts as success.',
    color: '#be123c',
    hasInput: true,
    outputs: [],
    defaultData: { label: 'Success' },
    fields: [{ key: 'label', label: 'Goal label', type: 'text' }],
  },
};

export const NODE_TYPE_LIST = Object.keys(NODE_CONFIG);

// Short human-readable summary of a node's config — used both on the node
// card itself and in the "go to" step picker, so a step reads the same way
// wherever it's referenced.
export function summarizeNode(type, data) {
  switch (type) {
    case 'trigger':
      return data.triggerType === 'manual' ? 'Manual · Run button' : data.triggerType || 'Manual · Run button';
    case 'delay':
      if (data.durationValue && data.durationUnit) return `Wait ${data.durationValue} ${data.durationUnit}`;
      return data.durationMs ? `Wait ${Math.round(data.durationMs / 3600000)}h` : 'Set duration';
    case 'branch':
      return data.field ? `${data.field} ${data.operator} ${data.value}` : 'Set condition';
    case 'communicate':
      return data.subject || 'Set subject';
    case 'set_status':
      return data.status || 'Set status';
    case 'goto':
      return data.targetNodeId ? `→ ${data.targetNodeId}` : 'Choose target';
    case 'goal':
      return data.label || 'Success';
    default:
      return '';
  }
}
