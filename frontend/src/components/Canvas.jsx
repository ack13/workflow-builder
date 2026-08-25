import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import { nodeTypes, NODE_CONFIG } from '../nodeTypes';
import Palette from './Palette.jsx';
import Inspector from './Inspector.jsx';
import ExecutionHistory from './ExecutionHistory.jsx';
import { api } from '../api.js';

let idCounter = 1;
const nextId = () => `node_${idCounter++}`;

// After loading an existing graph, bump the counter past any ids already
// used (e.g. "node_7") so newly dropped nodes never collide with loaded ones.
function bumpCounterPast(loadedNodes) {
  const max = loadedNodes.reduce((m, n) => {
    const match = /^node_(\d+)$/.exec(n.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  idCounter = Math.max(idCounter, max + 1);
}

function editableGraph(nodes, edges) {
  return {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, target, sourceHandle, label }) => ({ id, source, target, sourceHandle, label })),
  };
}

const graphFingerprint = (graph) => JSON.stringify(graph);

export default function Canvas({ workflowId, onBack }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const wrapperRef = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [status, setStatus] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowNameError, setWorkflowNameError] = useState('');
  const savedNameRef = useRef(''); // last name confirmed saved to the backend
  const savedDraftRef = useRef(''); // normalized graph last loaded/saved
  const [loaded, setLoaded] = useState(false);
  const [runEntityType, setRunEntityType] = useState('test');
  const [runEntityId, setRunEntityId] = useState('1');
  const [runContext, setRunContext] = useState('{}');
  const [workflowStatus, setWorkflowStatus] = useState('draft');
  const [runResult, setRunResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [publishErrors, setPublishErrors] = useState([]);

  // A delayed execution initially returns "waiting". Keep its status current
  // so the result card eventually shows completed/failed without another run.
  useEffect(() => {
    if (!runResult || !['running', 'waiting'].includes(runResult.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const execution = await api.getExecution(runResult.id);
        setRunResult(execution);
      } catch {
        // A transient refresh failure should not discard the last known result.
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [runResult?.id, runResult?.status]);

  // Load the workflow's saved draft graph whenever we open a (possibly
  // different) workflow id — without this the canvas always started blank.
  useEffect(() => {
    setLoaded(false);
    api.getWorkflow(workflowId).then((wf) => {
      const savedNodes = wf.draft_graph?.nodes ?? [];
      const savedEdges = wf.draft_graph?.edges ?? [];
      savedDraftRef.current = graphFingerprint(editableGraph(savedNodes, savedEdges));
      setNodes(savedNodes);
      setEdges(savedEdges);
      bumpCounterPast(savedNodes);
      setWorkflowName(wf.name);
      setWorkflowNameError('');
      setWorkflowStatus(wf.status);
      savedNameRef.current = wf.name;
      setSelectedNodeId(null);
      setLoaded(true);
    });
  }, [workflowId, setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const currentGraph = editableGraph(nodes, edges);
  const hasUnsavedChanges = loaded && graphFingerprint(currentGraph) !== savedDraftRef.current;

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const id = nextId();
      const newNode = {
        id,
        type,
        position,
        data: { ...NODE_CONFIG[type].defaultData },
      };
      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(id);
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((_, node) => setSelectedNodeId(node.id), []);

  const updateNodeData = (id, data) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)));
  };

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  };

  const saveDraft = async () => {
    setStatus('Saving...');
    const draft = editableGraph(nodes, edges);
    await api.saveDraft(workflowId, draft);
    savedDraftRef.current = graphFingerprint(draft);
    setStatus('Saved');
  };

  const refreshDraft = async () => {
    if (hasUnsavedChanges && !window.confirm('Discard your unsaved canvas changes and reload the draft from the database?')) {
      return;
    }

    setStatus('Refreshing draft...');
    try {
      const wf = await api.getWorkflow(workflowId);
      const savedNodes = wf.draft_graph?.nodes ?? [];
      const savedEdges = wf.draft_graph?.edges ?? [];
      savedDraftRef.current = graphFingerprint(editableGraph(savedNodes, savedEdges));
      setNodes(savedNodes);
      setEdges(savedEdges);
      bumpCounterPast(savedNodes);
      setSelectedNodeId(null);
      setWorkflowStatus(wf.status);
      setStatus('Draft refreshed from database');
    } catch (error) {
      setStatus(`Refresh failed: ${error.message}`);
    }
  };

  const publish = async () => {
    setPublishErrors([]);
    try {
      await saveDraft();
      await api.publish(workflowId);
      setWorkflowStatus('published');
      setStatus('Published — ready for manual runs');
    } catch (error) {
      setStatus(`Cannot publish: ${error.message}`);
      setPublishErrors(error.details ?? [error.message]);
    }
  };

  const run = async () => {
    setStatus('Running...');
    setRunResult(null);
    try {
      let context;
      try {
        context = JSON.parse(runContext);
      } catch {
        throw new Error('Test context is not valid JSON.');
      }
      if (!context || Array.isArray(context) || typeof context !== 'object') {
        throw new Error('Test context must be a JSON object.');
      }

      const execution = await api.run(workflowId, runEntityType, runEntityId, context);
      setRunResult(execution);
      setStatus('Run started successfully');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const renameWorkflow = async (newName) => {
    if (!newName.trim()) {
      setWorkflowName(savedNameRef.current);
      setWorkflowNameError('Workflow name cannot be empty.');
      return false;
    }
    if (newName === savedNameRef.current) return true;
    try {
      const workflow = await api.renameWorkflow(workflowId, newName);
      setWorkflowName(workflow.name);
      savedNameRef.current = workflow.name;
      setWorkflowNameError('');
      setStatus('Workflow renamed');
      return true;
    } catch (error) {
      setWorkflowName(savedNameRef.current);
      setWorkflowNameError(error.message);
      return false;
    }
  };

  const handleBack = async () => {
    await renameWorkflow(workflowName); // flush any unsaved name edit before leaving
    onBack();
  };

  return (
    <div className="builder-shell">
      <Palette />
      <main className="builder-main">
        <div className="command-bar">
          <button className="button button-ghost" onClick={handleBack}>← All workflows</button>
          <input
            value={workflowName}
            onChange={(e) => {
              setWorkflowName(e.target.value);
              setWorkflowNameError('');
            }}
            onBlur={(e) => renameWorkflow(e.target.value)}
            className={`workflow-name-input ${workflowNameError ? 'has-error' : ''}`}
            aria-invalid={Boolean(workflowNameError)}
            aria-describedby={workflowNameError ? 'workflow-name-error' : undefined}
            onFocus={(e) => (e.target.style.border = '1px solid #ccc')}
          />
          {workflowNameError && <span id="workflow-name-error" className="workflow-name-error" role="alert">{workflowNameError}</span>}
          <div className="command-spacer" />
          <button className="button button-ghost" onClick={refreshDraft} title="Reload the saved draft from the database">↻ Refresh</button>
          <button className="button button-secondary" onClick={saveDraft}>Save draft</button>
          <button className="button button-primary" onClick={publish}>Publish</button>
          <button className="button button-run"
            onClick={run}
            disabled={workflowStatus !== 'published' || !runEntityType.trim() || !runEntityId.trim()}
            title={workflowStatus !== 'published' ? 'Publish the workflow before running it' : 'Manually run the published version'}
          >
            Run manually
          </button>
          <button className="button button-secondary" onClick={() => setShowHistory((shown) => !shown)}>
            {showHistory ? 'Hide history' : 'Execution history'}
          </button>
          {hasUnsavedChanges && <span className="status-pill status-unsaved">● Unsaved</span>}
        </div>
        {status && <div className="status-strip">{status}</div>}
        {publishErrors.length > 0 && (
          <div role="alert" className="validation-banner">
            <strong>Fix these issues before publishing:</strong>
            <ul style={{ margin: '5px 0 0', paddingLeft: 20 }}>
              {publishErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}
        <div className="run-panel">
          <div>
            <label>Entity type</label>
            <input aria-label="Run entity type" value={runEntityType} onChange={(e) => setRunEntityType(e.target.value)} style={{ width: 100, padding: '4px 6px' }} />
          </div>
          <div>
            <label>Entity ID</label>
            <input aria-label="Run entity ID" value={runEntityId} onChange={(e) => setRunEntityId(e.target.value)} style={{ width: 90, padding: '4px 6px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Test context <span>JSON</span></label>
            <textarea aria-label="Test context JSON" value={runContext} onChange={(e) => setRunContext(e.target.value)} rows={3} spellCheck={false} style={{ width: '100%', padding: 6, boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
            <div className="field-hint">Manual runs always use the latest published version.</div>
          </div>
          {runResult && (
            <div className="run-result-card">
              <div><strong>Execution ID:</strong> <span style={{ wordBreak: 'break-all' }}>{runResult.id}</span></div>
              <div style={{ marginTop: 5 }}><strong>Status:</strong> {runResult.status}</div>
            </div>
          )}
        </div>
        {showHistory && <ExecutionHistory workflowId={workflowId} latestExecution={runResult} />}
        <div className="canvas-area" ref={wrapperRef} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          {!loaded ? (
            <div style={{ padding: 24, color: '#666', fontFamily: 'sans-serif' }}>Loading…</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          )}
        </div>
      </main>
      <Inspector
        node={selectedNode}
        allNodes={nodes}
        onChange={updateNodeData}
        onDelete={deleteNode}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
