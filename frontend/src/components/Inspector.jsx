import React from 'react';
import { NODE_CONFIG, summarizeNode } from '../nodeTypes';

function getDurationParts(data) {
  if (data.durationValue && data.durationUnit) return { value: data.durationValue, unit: data.durationUnit };
  const milliseconds = Number(data.durationMs);
  const units = [['days', 86400000], ['hours', 3600000], ['minutes', 60000], ['seconds', 1000]];
  const match = units.find(([, size]) => milliseconds >= size && milliseconds % size === 0);
  return match ? { value: milliseconds / match[1], unit: match[0] } : { value: 10, unit: 'seconds' };
}

export default function Inspector({ node, allNodes, onChange, onDelete, onClose }) {
  if (!node) {
    return (
      <aside className="inspector-panel inspector-empty">
        <div className="empty-icon">◇</div>
        <strong>No step selected</strong>
        <span>Select a node on the canvas to configure it.</span>
      </aside>
    );
  }

  const config = NODE_CONFIG[node.type];
  const duration = getDurationParts(node.data);

  const setField = (key, value) => {
    onChange(node.id, { ...node.data, [key]: value });
  };

  return (
    <aside className="inspector-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="panel-eyebrow">Step settings</div><h3 style={{ color: config.color }}>{config.label}</h3></div>
        <button className="icon-button" onClick={onClose}>✕</button>
      </div>

      {config.fields.map((field) => (
        <div key={field.key} style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 4 }}>{field.label}</label>
          {field.type === 'select' && (
            <select
              value={node.data[field.key] ?? ''}
              onChange={(e) => setField(field.key, e.target.value)}
              style={{ width: '100%', padding: 6 }}
            >
              {field.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
          {field.type === 'node_select' && (
            <>
              <select
                value={node.data[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                style={{ width: '100%', padding: 6 }}
                disabled={allNodes.filter((n) => n.id !== node.id).length === 0}
              >
                <option value="">Choose a step…</option>
                {allNodes
                  .filter((n) => n.id !== node.id) // a step can't jump to itself
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {NODE_CONFIG[n.type].label}: {summarizeNode(n.type, n.data) || '(unconfigured)'}
                    </option>
                  ))}
              </select>
              {allNodes.filter((n) => n.id !== node.id).length === 0 && (
                <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  Add another step to the canvas first, then pick it here.
                </p>
              )}
            </>
          )}
          {field.type === 'text' && (
            <input
              type="text"
              value={node.data[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.key, e.target.value)}
              style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
            />
          )}
          {field.type === 'number' && (
            <input
              type="number"
              value={node.data[field.key] ?? 0}
              onChange={(e) => setField(field.key, Number(e.target.value))}
              style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
            />
          )}
          {field.type === 'duration' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                min="1"
                value={duration.value}
                onChange={(e) => onChange(node.id, { ...node.data, durationValue: Math.max(1, Number(e.target.value) || 1), durationUnit: duration.unit, durationMs: undefined })}
                style={{ width: '45%', padding: 6, boxSizing: 'border-box' }}
              />
              <select
                value={duration.unit}
                onChange={(e) => onChange(node.id, { ...node.data, durationValue: duration.value, durationUnit: e.target.value, durationMs: undefined })}
                style={{ flex: 1, padding: 6 }}
              >
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
          )}
          {field.type === 'textarea' && (
            <textarea
              value={node.data[field.key] ?? ''}
              onChange={(e) => setField(field.key, e.target.value)}
              rows={4}
              style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
            />
          )}
        </div>
      ))}

      <button className="danger-button"
        onClick={() => onDelete(node.id)}
        style={{ marginTop: 8, color: '#be123c', border: '1px solid #be123c', background: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}
      >
        Remove step
      </button>
    </aside>
  );
}
