import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const COLORS = {
  running: '#2563eb',
  waiting: '#d97706',
  completed: '#059669',
  failed: '#dc2626',
  cancelled: '#64748b',
};

const formatTime = (value) => value ? new Date(value).toLocaleString() : '—';

export default function ExecutionHistory({ workflowId, latestExecution }) {
  const [executions, setExecutions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError('');
      const rows = await api.listExecutions(workflowId);
      setExecutions(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      setError(err.message);
    }
  }, [workflowId]);

  useEffect(() => { refresh(); }, [refresh, latestExecution?.id, latestExecution?.status]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api.getExecutionHistory(selectedId).then(setDetail).catch((err) => setError(err.message));
  }, [selectedId, latestExecution?.status]);

  const selected = executions.find((execution) => execution.id === selectedId);

  return (
    <section style={{ height: 270, borderBottom: '1px solid #dbe2ea', background: '#fff', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Execution history</strong>
        <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b' }}>{executions.length} recent runs</span>
        <button onClick={refresh} style={{ marginLeft: 'auto' }}>Refresh</button>
      </div>
      {error && <div style={{ padding: 8, color: '#b91c1c', fontSize: 12 }}>{error}</div>}
      <div style={{ minHeight: 0, flex: 1, display: 'grid', gridTemplateColumns: '52% 48%' }}>
        <div style={{ overflow: 'auto', borderRight: '1px solid #e5e7eb' }}>
          {executions.length === 0 ? (
            <p style={{ padding: 12, color: '#64748b', fontSize: 12 }}>No executions yet. Run the published workflow to create one.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                <th style={{ padding: 6 }}>Started</th><th>Entity</th><th>Status</th><th>Resume time</th><th>Execution ID</th>
              </tr></thead>
              <tbody>{executions.map((execution) => (
                <tr key={execution.id} onClick={() => setSelectedId(execution.id)} style={{ cursor: 'pointer', background: execution.id === selectedId ? '#eff6ff' : 'transparent', borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{formatTime(execution.created_at)}</td>
                  <td>{execution.entity_type}:{execution.entity_id}</td>
                  <td style={{ color: COLORS[execution.status], fontWeight: 700 }}>{execution.status}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatTime(execution.scheduled_resume_at)}</td>
                  <td title={execution.id} style={{ fontFamily: 'monospace' }}>{execution.id.slice(0, 8)}…</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div style={{ overflow: 'auto', padding: '8px 12px' }}>
          {!selected ? <span style={{ color: '#64748b', fontSize: 12 }}>Select an execution.</span> : (
            <>
              <div style={{ fontSize: 11, marginBottom: 8 }}>
                <strong>ID:</strong> <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{selected.id}</span>
              </div>
              <strong style={{ fontSize: 11 }}>Nodes visited</strong>
              {!detail ? <p style={{ fontSize: 11 }}>Loading…</p> : (
                <div>{detail.logs.map((log) => (
                  <div key={log.id} style={{ borderLeft: `3px solid ${log.action === 'branch_taken' ? '#d97706' : log.action === 'email_sent' ? '#2563eb' : '#94a3b8'}`, padding: '4px 7px', marginTop: 5, background: '#f8fafc', fontSize: 11 }}>
                    <span style={{ fontWeight: 700 }}>{log.node_type}</span> · {log.node_id} · {log.action}
                    <span style={{ float: 'right', color: '#64748b' }}>{formatTime(log.created_at)}</span>
                    {log.action === 'branch_taken' && (
                      <div style={{ marginTop: 3, color: '#92400e' }}>
                        {String(log.detail?.actual)} {log.detail?.operator} {String(log.detail?.expected)} → <strong>{log.detail?.selected}</strong>
                      </div>
                    )}
                    {log.action === 'email_sent' && (
                      <div style={{ marginTop: 3, color: '#1e40af' }}>
                        Mocked email to <strong>{log.detail?.recipient || 'empty recipient'}</strong><br />
                        Subject: {log.detail?.subject || '(empty)'} · ID: {log.detail?.messageId}
                        <div style={{ color: '#b45309', fontWeight: 700 }}>Simulation only — no real email was delivered.</div>
                      </div>
                    )}
                  </div>
                ))}
                {detail.scheduledJobs.map((job) => (
                  <div key={job.id} style={{ padding: '5px 7px', marginTop: 5, background: '#fff7ed', fontSize: 11 }}>
                    Delay scheduled for <strong>{formatTime(job.run_at)}</strong> · {job.status}
                    <div style={{ marginTop: 2 }}>Attempts: {job.retry_count}{job.last_attempt_at ? ` · Last attempt: ${formatTime(job.last_attempt_at)}` : ''}</div>
                    {job.last_error && <div style={{ marginTop: 2, color: '#b91c1c' }}>Last error: {job.last_error}</div>}
                  </div>
                ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
