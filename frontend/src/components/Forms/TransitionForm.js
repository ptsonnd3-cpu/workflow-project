import React, { useState } from 'react';

function TransitionForm({ transition, activities, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    from_activity_id: transition?.from_activity_id || '',
    to_activity_id: transition?.to_activity_id || '',
    condition: transition?.condition || 'Done',
    priority: transition?.priority ?? '',
    is_default: !!transition?.is_default
  });

  const handleSubmit = () => {
    const data = {
      ...formData,
      from_activity_id: Number(formData.from_activity_id),
      to_activity_id: Number(formData.to_activity_id),
      priority: formData.priority === '' ? null : Number(formData.priority)
    };
    onSubmit(data);
  };

  return (
    <div className="wf-modal-backdrop" onClick={onCancel}>
      <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{transition ? 'Sửa Transition' : 'Tạo Transition mới'}</h3>
        <div className="wf-field">
          <label>From Activity ID</label>
          <select
            className="wf-control"
            value={formData.from_activity_id}
            onChange={(e) => setFormData({ ...formData, from_activity_id: e.target.value })}
          >
            <option value="">-- Chọn --</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} - {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="wf-field">
          <label>To Activity ID</label>
          <select
            className="wf-control"
            value={formData.to_activity_id}
            onChange={(e) => setFormData({ ...formData, to_activity_id: e.target.value })}
          >
            <option value="">-- Chọn --</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} - {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="wf-field">
          <label>Condition</label>
          <input
            className="wf-control"
            value={formData.condition}
            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
            placeholder="Done, Approved, Rejected... hoặc = ctx.amount > 10000"
          />
        </div>
        <div className="wf-field">
          <label>Priority</label>
          <input
            className="wf-control"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          />
        </div>
        <div className="wf-field">
          <label>
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
            />{' '}
            Default
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="wf-btn wf-btn-primary" onClick={handleSubmit} disabled={loading}>
            {transition ? 'Cập nhật' : 'Tạo mới'}
          </button>
          <button className="wf-btn" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default TransitionForm;