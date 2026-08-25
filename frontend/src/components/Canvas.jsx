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

export default function Canvas({ workflowId, onBack }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const wrapperRef = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [status, setStatus] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const savedNameRef = useRef(''); // last name confirmed saved to the backend
  const [loaded, setLoaded] = useState(false);
  const [runEntityType, setRunEntityType] = useState('test');
  const [runEntityId, setRunEntityId] = useState('1');
  const [runContext, setRunContext] = useState('{}');
  const [workflowStatus, setWorkflowStatus] = useState('draft');
  const [runResult, setRunResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

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
      setNodes(savedNodes);
      setEdges(savedEdges);
      bumpCounterPast(savedNodes);
      setWorkflowName(wf.name);
      setWorkflowStatus(wf.status);
      savedNameRef.current = wf.name;
      setSelectedNodeId(null);
      setLoaded(true);
    });
  }, [workflowId, setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

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

  const graph = () => ({
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, target, sourceHandle, label }) => ({ id, source, target, sourceHandle, label })),
  });

  const saveDraft = async () => {
    setStatus('Saving...');
    await api.saveDraft(workflowId, graph());
    setStatus('Saved');
  };

  const publish = async () => {
    try {
      await saveDraft();
      await api.publish(workflowId);
      setWorkflowStatus('published');
      setStatus('Published — ready for manual runs');
    } catch (error) {
      setStatus(`Cannot publish: ${error.message}`);
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
    if (!newName.trim() || newName === savedNameRef.current) return;
    savedNameRef.current = newName;
    await api.renameWorkflow(workflowId, newName);
  };

  const handleBack = async () => {
    await renameWorkflow(workflowName); // flush any unsaved name edit before leaving
    onBack();
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Palette />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleBack}>← Workflows</button>
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            onBlur={(e) => renameWorkflow(e.target.value)}
            style={{ fontSize: 14, fontWeight: 700, border: '1px solid transparent', padding: '4px 6px', borderRadius: 4 }}
            onFocus={(e) => (e.target.style.border = '1px solid #ccc')}
          />
          <div style={{ flex: 1 }} />
          <button onClick={saveDraft}>Save draft</button>
          <button onClick={publish} style={{ fontWeight: 700 }}>Publish</button>
          <button
            onClick={run}
            disabled={workflowStatus !== 'published' || !runEntityType.trim() || !runEntityId.trim()}
            title={workflowStatus !== 'published' ? 'Publish the workflow before running it' : 'Manually run the published version'}
          >
            Run manually
          </button>
          <button onClick={() => setShowHistory((shown) => !shown)}>
            {showHistory ? 'Hide history' : 'Execution history'}
          </button>
          <span style={{ fontSize: 12, color: '#666' }}>{status}</span>
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'sans-serif' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Entity type</label>
            <input aria-label="Run entity type" value={runEntityType} onChange={(e) => setRunEntityType(e.target.value)} style={{ width: 100, padding: '4px 6px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Entity ID</label>
            <input aria-label="Run entity ID" value={runEntityId} onChange={(e) => setRunEntityId(e.target.value)} style={{ width: 90, padding: '4px 6px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Test context (JSON)</label>
            <textarea aria-label="Test context JSON" value={runContext} onChange={(e) => setRunContext(e.target.value)} rows={3} spellCheck={false} style={{ width: '100%', padding: 6, boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>Run manually starts the latest published version, never unsaved canvas changes.</div>
          </div>
          {runResult && (
            <div style={{ minWidth: 230, fontSize: 12, padding: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }}>
              <div><strong>Execution ID:</strong> <span style={{ wordBreak: 'break-all' }}>{runResult.id}</span></div>
              <div style={{ marginTop: 5 }}><strong>Status:</strong> {runResult.status}</div>
            </div>
          )}
        </div>
        {showHistory && <ExecutionHistory workflowId={workflowId} latestExecution={runResult} />}
        <div ref={wrapperRef} style={{ flex: 1 }} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
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
      </div>
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
