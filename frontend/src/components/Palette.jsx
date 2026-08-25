import React from 'react';
import { NODE_CONFIG, NODE_TYPE_LIST } from '../nodeTypes';

export default function Palette() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="palette-panel">
      <div className="panel-eyebrow">Builder</div>
      <h3 className="panel-title">Workflow steps</h3>
      <p className="panel-subtitle">Drag a step onto the canvas</p>
      {NODE_TYPE_LIST.map((type) => {
        const config = NODE_CONFIG[type];
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            className="palette-item"
            style={{ '--step-color': config.color }}
            title={config.description}
          >
            <div className="palette-item-icon" />
            <div>
              <div className="palette-item-label">{config.label}</div>
              <div className="palette-item-description">{config.description}</div>
            </div>
          </div>
        );
      })}
      <div className="palette-tip"><span>↗</span> Drag, drop, then connect</div>
    </aside>
  );
}
