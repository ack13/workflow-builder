import React from 'react';
import { Handle, Position } from 'reactflow';
import { NODE_CONFIG, summarizeNode } from './stepConfig';

export default function StepNode({ id, type, data, selected }) {
  const config = NODE_CONFIG[type];

  return (
    <div className={`workflow-node ${selected ? 'is-selected' : ''}`} style={{ '--node-color': config.color }}>
      {config.hasInput && <Handle type="target" position={Position.Top} />}

      <div className="workflow-node-type">
        {config.label}
      </div>
      <div className="workflow-node-summary">
        {summarizeNode(type, data)}
      </div>

      {config.outputs.length === 1 && <Handle type="source" position={Position.Bottom} id={config.outputs[0]} />}
      {config.outputs.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {config.outputs.map((handleId) => (
            <div key={handleId} style={{ position: 'relative', fontSize: 10, color: '#666' }}>
              {handleId}
              <Handle
                type="source"
                position={Position.Bottom}
                id={handleId}
                style={{ left: handleId === 'yes' ? '25%' : '75%' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
