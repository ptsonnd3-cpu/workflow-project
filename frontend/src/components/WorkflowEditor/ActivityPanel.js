import React from 'react';

function ActivityPanel({ activities, onCreateActivity, onEditActivity, onDeleteActivity }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <b>Activity Definitions</b>
        <button className="wf-btn" onClick={onCreateActivity}>
          + Thêm Activity
        </button>
      </div>
      {activities.length === 0 ? <div className="wf-muted">Chưa có activity nào.</div> : null}
      {activities.map((act) => (
        <div key={act.id} className="wf-row">
          <div>
            <b>#{act.id}</b> — {act.name} <span className="wf-muted">({act.type})</span>
            {act.type === 'service' && (
              <span className="wf-muted"> — handler: {act.handler || '(none)'} </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button
              className="wf-btn"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => onEditActivity(act)}
            >
              Sửa
            </button>
            <button
              className="wf-btn"
              style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f44336', color: 'white' }}
              onClick={() => onDeleteActivity(act.id, act.name)}
            >
              Xóa
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityPanel;