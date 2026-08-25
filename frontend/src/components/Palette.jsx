import React from 'react';
import { NODE_CONFIG, NODE_TYPE_LIST } from '../nodeTypes';

export default function Palette() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside style={{ width: 220, borderRight: '1px solid #e5e7eb', padding: 12, fontFamily: 'sans-serif' }}>
      <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: '#666' }}>Legend</h3>
      {NODE_TYPE_LIST.map((type) => {
        const config = NODE_CONFIG[type];
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            style={{
              border: `1.5px solid ${config.color}`,
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 8,
              cursor: 'grab',
              background: '#fff',
            }}
            title={config.description}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: config.color }}>{config.label}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{config.description}</div>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: '#999', marginTop: 16 }}>Drag a step onto the canvas to add it.</p>
    </aside>
  );
}
