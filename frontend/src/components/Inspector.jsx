import React from 'react';
import { NODE_CONFIG, summarizeNode } from '../nodeTypes';

export default function Inspector({ node, allNodes, onChange, onDelete, onClose }) {
  if (!node) {
    return (
      <aside style={{ width: 280, borderLeft: '1px solid #e5e7eb', padding: 12, fontFamily: 'sans-serif', color: '#999' }}>
        Select a step to edit it.
      </aside>
    );
  }

  const config = NODE_CONFIG[node.type];

  const setField = (key, value) => {
    onChange(node.id, { ...node.data, [key]: value });
  };

  return (
    <aside style={{ width: 280, borderLeft: '1px solid #e5e7eb', padding: 12, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 13, color: config.color, textTransform: 'uppercase' }}>{config.label}</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
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

      <button
        onClick={() => onDelete(node.id)}
        style={{ marginTop: 8, color: '#be123c', border: '1px solid #be123c', background: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}
      >
        Remove step
      </button>
    </aside>
  );
}
