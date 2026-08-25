import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import Canvas from './components/Canvas.jsx';
import WorkflowList from './components/WorkflowList.jsx';

export default function App() {
  // No router library used here to keep the scaffold dependency-light —
  // this is the same idea as client-side routing, just with local state
  // standing in for the URL. Swap for react-router if this grows.
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);

  if (!activeWorkflowId) {
    return <WorkflowList onOpen={setActiveWorkflowId} />;
  }

  return (
    <ReactFlowProvider>
      <Canvas workflowId={activeWorkflowId} onBack={() => setActiveWorkflowId(null)} />
    </ReactFlowProvider>
  );
}
