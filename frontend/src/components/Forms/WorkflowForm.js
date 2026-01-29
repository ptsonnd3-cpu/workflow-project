import React, { useState } from 'react';

function WorkflowForm({ workflow, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    name: workflow?.name || '',
    description: workflow?.description || '',
    version: workflow?.version || 1
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="wf-modal-backdrop" onClick={onCancel}>
      <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{workflow ? 'Sửa Workflow' : 'Tạo Workflow mới'}</h3>
        <div className="wf-field">
          <label>Tên</label>
          <input
            className="wf-control"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="wf-field">
          <label>Mô tả</label>
          <textarea
            className="wf-control"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
        <div className="wf-field">
          <label>Version</label>
          <input
            className="wf-control"
            type="number"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: Number(e.target.value) })}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="wf-btn wf-btn-primary" onClick={handleSubmit} disabled={loading}>
            {workflow ? 'Cập nhật' : 'Tạo mới'}
          </button>
          <button className="wf-btn" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowForm;