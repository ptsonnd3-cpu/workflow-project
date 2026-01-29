import React from 'react';
import { useOutbox } from '../../hooks/useOutbox';

function OutboxPanel({ isActive }) {
  const {
    outbox,
    outboxStatus,
    setOutboxStatus,
    loading,
    error,
    loadOutbox,
    retryOutbox
  } = useOutbox(isActive);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <b>Outbox - Quản lý Side Effects</b>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Lọc theo trạng thái:</label>
          <select
            className="wf-control"
            style={{ fontSize: 12, padding: '4px 8px', minWidth: '120px' }}
            value={outboxStatus}
            onChange={(e) => setOutboxStatus(e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="PENDING">PENDING</option>
            <option value="DONE">DONE</option>
            <option value="FAILED">FAILED</option>
          </select>
          <button className="wf-btn" onClick={loadOutbox} disabled={loading}>
            🔄 Reload
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: 12, padding: '12px', background: 'var(--panel)', borderRadius: '8px', fontSize: '13px' }}>
        <strong>💡 Outbox là gì?</strong><br />
        Outbox theo dõi các tác vụ phụ (side effects) của workflow như gửi email, thông báo, đồng bộ dữ liệu ERP.
        Khi workflow chuyển bước, hệ thống sẽ tự động tạo các events trong Outbox và xử lý chúng bất đồng bộ.
      </div>

      {error && <div className="wf-alert" style={{ marginBottom: 12 }}>Error: {error}</div>}

      {outbox.length === 0 ? (
        <div className="wf-muted" style={{ textAlign: 'center', padding: '20px' }}>
          Chưa có events nào trong Outbox
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {outbox.map((event) => (
            <div 
              key={event.id} 
              className="wf-row" 
              style={{ 
                border: event.status === 'FAILED' ? '1px solid var(--danger-border)' : '1px solid var(--border)',
                backgroundColor: event.status === 'FAILED' ? 'var(--danger-bg)' : 'var(--panel)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: event.status === 'PENDING' ? '#FFA500' : 
                             event.status === 'DONE' ? '#4CAF50' : '#F44336'
                    }}>
                      #{event.id}
                    </span>
                    <span style={{ 
                      fontSize: 11, 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      backgroundColor: event.status === 'PENDING' ? '#FFA500' : 
                                     event.status === 'DONE' ? '#4CAF50' : '#F44336',
                      color: 'white'
                    }}>
                      {event.status}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{event.event_type}</span>
                  </div>
                  
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                    📅 Tạo: {new Date(event.created_at).toLocaleString('vi-VN')}
                    {event.processed_at && (
                      <span> • ✅ Xử lý: {new Date(event.processed_at).toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                  
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                      📋 Payload & Details
                    </summary>
                    <div style={{ 
                      marginTop: 8, 
                      padding: '8px', 
                      background: 'var(--bg)', 
                      borderRadius: '4px',
                      fontSize: 11,
                      fontFamily: 'monospace'
                    }}>
                      <strong>Payload:</strong>
                      <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(JSON.parse(event.payload_json || '{}'), null, 2)}
                      </pre>
                      {event.error && (
                        <>
                          <strong style={{ color: '#F44336' }}>Error:</strong>
                          <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap', color: '#F44336' }}>
                            {event.error}
                          </pre>
                        </>
                      )}
                    </div>
                  </details>
                </div>
                
                {event.status === 'FAILED' && (
                  <button
                    className="wf-btn"
                    style={{ 
                      fontSize: 11, 
                      padding: '4px 8px',
                      backgroundColor: '#FF9800',
                      color: 'white'
                    }}
                    onClick={() => retryOutbox(event.id)}
                  >
                    🔄 Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OutboxPanel;