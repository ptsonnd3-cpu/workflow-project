import React, { useState } from 'react';

function ActivityForm({ activity, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    name: activity?.name || '',
    type: activity?.type || 'user',
    handler: activity?.handler || ''
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="wf-modal-backdrop" onClick={onCancel}>
      <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{activity ? 'Sửa Activity' : 'Tạo Activity mới'}</h3>
        <div className="wf-field">
          <label>Tên</label>
          <input
            className="wf-control"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="wf-field">
          <label>Type</label>
          <select
            className="wf-control"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="user">user</option>
            <option value="role">role</option>
            <option value="department">department</option>
            <option value="group">group</option>
            <option value="service">service</option>
          </select>
        </div>
        {formData.type === 'service' && (
          <div className="wf-field">
            <label>Handler</label>
            <input
              className="wf-control"
              value={formData.handler}
              onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
              placeholder="Ví dụ: NotifyERP"
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="wf-btn wf-btn-primary" onClick={handleSubmit} disabled={loading}>
            {activity ? 'Cập nhật' : 'Tạo mới'}
          </button>
          <button className="wf-btn" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActivityForm;