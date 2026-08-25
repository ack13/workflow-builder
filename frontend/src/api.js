const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error || `Request failed (${res.status}).`);
    error.details = body?.errors ?? [];
    throw error;
  }
  return res.json();
}

export const api = {
  listWorkflows: () => request('/workflows'),
  createWorkflow: (name) => request('/workflows', { method: 'POST', body: JSON.stringify({ name }) }),
  getWorkflow: (id) => request(`/workflows/${id}`),
  saveDraft: (id, graph) => request(`/workflows/${id}/draft`, { method: 'PUT', body: JSON.stringify(graph) }),
  renameWorkflow: (id, name) => request(`/workflows/${id}/name`, { method: 'PUT', body: JSON.stringify({ name }) }),
  publish: (id) => request(`/workflows/${id}/publish`, { method: 'POST' }),
  run: (id, entityType, entityId, context) =>
    request(`/workflows/${id}/run`, { method: 'POST', body: JSON.stringify({ entityType, entityId, context }) }),
  getExecution: (id) => request(`/executions/${id}`),
  listExecutions: (workflowId) => request(`/workflows/${workflowId}/executions`),
  getExecutionHistory: (id) => request(`/executions/${id}/history`),
};
