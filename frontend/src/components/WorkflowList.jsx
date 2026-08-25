import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS_STYLES = {
  draft: { color: '#92400e', background: '#fef3c7' },
  published: { color: '#065f46', background: '#d1fae5' },
  archived: { color: '#3f3f46', background: '#e4e4e7' },
};

export default function WorkflowList({ onOpen }) {
  const [workflows, setWorkflows] = useState(null); // null = loading
  const [creating, setCreating] = useState(false);

  const refresh = () => api.listWorkflows().then(setWorkflows);

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const wf = await api.createWorkflow('Untitled workflow');
    setCreating(false);
    onOpen(wf.id);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>Workflows</h1>
        <button onClick={handleCreate} disabled={creating} style={{ padding: '8px 14px', fontWeight: 700 }}>
          {creating ? 'Creating…' : '+ New workflow'}
        </button>
      </div>

      {workflows === null && <p style={{ color: '#666' }}>Loading…</p>}
      {workflows !== null && workflows.length === 0 && (
        <p style={{ color: '#666' }}>No workflows yet — create one to get started.</p>
      )}

      {workflows && workflows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#666' }}>
              <th style={{ padding: '8px 4px' }}>Name</th>
              <th style={{ padding: '8px 4px' }}>Status</th>
              <th style={{ padding: '8px 4px' }}>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => {
              const badge = STATUS_STYLES[wf.status] ?? STATUS_STYLES.draft;
              return (
                <tr
                  key={wf.id}
                  onClick={() => onOpen(wf.id)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #f1f1f1' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 4px', fontWeight: 500 }}>{wf.name}</td>
                  <td style={{ padding: '10px 4px' }}>
                    <span
                      style={{
                        ...badge,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                      }}
                    >
                      {wf.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 4px', fontSize: 13, color: '#666' }}>
                    {new Date(wf.updated_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
