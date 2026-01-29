import React from 'react';

function TransitionPanel({ 
  transitions, 
  activities, 
  onCreateTransition, 
  onEditTransition, 
  onDeleteTransition 
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <b>Transition Definitions</b>
        <button className="wf-btn" onClick={onCreateTransition}>
          + Thêm Transition
        </button>
      </div>
      {transitions.length === 0 ? <div className="wf-muted">Chưa có transition nào.</div> : null}
      {transitions.map((trans) => {
        const fromAct = activities.find((a) => a.id === trans.from_activity_id);
        const toAct = activities.find((a) => a.id === trans.to_activity_id);
        return (
          <div key={trans.id} className="wf-row">
            <div>
              <b>#{trans.id}</b> — {fromAct?.name || trans.from_activity_id} → {toAct?.name || trans.to_activity_id}{' '}
              <span className="wf-muted">(condition: {trans.condition})</span>
              <span className="wf-muted"> — priority: {trans.priority ?? '-'} — default: {trans.is_default ? 'Yes' : 'No'}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button
                className="wf-btn"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() => onEditTransition(trans)}
              >
                Sửa
              </button>
              <button
                className="wf-btn"
                style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f44336', color: 'white' }}
                onClick={() => onDeleteTransition(trans.id, `${trans.from_activity_id} → ${trans.to_activity_id}`)}
              >
                Xóa
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TransitionPanel;