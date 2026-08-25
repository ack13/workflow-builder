import React from 'react';
import { Handle, Position } from 'reactflow';
import { NODE_CONFIG, summarizeNode } from './stepConfig';

export default function StepNode({ id, type, data, selected }) {
  const config = NODE_CONFIG[type];

  return (
    <div
      style={{
        border: `2px solid ${config.color}`,
        borderRadius: 8,
        padding: '8px 14px',
        background: '#fff',
        minWidth: 160,
        boxShadow: selected ? `0 0 0 3px ${config.color}33` : '0 1px 3px rgba(0,0,0,0.15)',
        fontFamily: 'sans-serif',
      }}
    >
      {config.hasInput && <Handle type="target" position={Position.Top} />}

      <div style={{ fontSize: 11, fontWeight: 700, color: config.color, textTransform: 'uppercase' }}>
        {config.label}
      </div>
      <div style={{ fontSize: 13, marginTop: 2, color: '#111', wordBreak: 'break-word' }}>
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

