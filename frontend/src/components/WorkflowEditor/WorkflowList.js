import React from 'react';

function WorkflowList({ 
  workflows, 
  selectedWorkflowId, 
  onSelectWorkflow, 
  onCreateWorkflow, 
  onEditWorkflow, 
  onDeleteWorkflow,
  onCreateDemoWorkflow,
  loading 
}) {
  return (
    <div className="wf-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 className="wf-card-title" style={{ margin: 0 }}>Workflows</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="wf-btn"
            style={{ fontSize: 10, backgroundColor: '#4caf50', color: 'white' }}
            onClick={() => onCreateDemoWorkflow('basic')}
          >
            🔄 Demo Cơ bản
          </button>
          <button
            className="wf-btn"
            style={{ fontSize: 10, backgroundColor: '#ff9800', color: 'white' }}
            onClick={() => onCreateDemoWorkflow('advanced')}
          >
            ⚡ Demo Nâng cao
          </button>
          <button
            className="wf-btn"
            onClick={onCreateWorkflow}
          >
            + Tạo mới
          </button>
        </div>
      </div>

      {loading && workflows.length === 0 ? <div>Loading...</div> : null}
      {workflows.length === 0 ? <div className="wf-muted">Chưa có workflow nào.</div> : null}

      {workflows.map((wf) => (
        <div
          key={wf.id}
          className="wf-row"
          style={{
            cursor: 'pointer',
            backgroundColor: selectedWorkflowId === wf.id ? '#7c5cff20' : 'transparent'
          }}
          onClick={() => onSelectWorkflow(wf.id)}
        >
          <div>
            <b>{wf.name}</b>
          </div>
          <div className="wf-muted" style={{ fontSize: 12 }}>
            v{wf.version} • ID: {wf.id}
          </div>
          {wf.description ? <div className="wf-muted" style={{ fontSize: 12, marginTop: 4 }}>{wf.description}</div> : null}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button
              className="wf-btn"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={(e) => {
                e.stopPropagation();
                onEditWorkflow(wf);
              }}
            >
              Sửa
            </button>
            <button
              className="wf-btn"
              style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f44336', color: 'white' }}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteWorkflow(wf.id, wf.name);
              }}
            >
              Xóa
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WorkflowList;