import React from 'react';
import { useBPMN } from '../../hooks/useBPMN';

function BPMNEditor({ 
  selectedWorkflowId, 
  workflowDetail, 
  activities, 
  transitions, 
  isActive, 
  onReload 
}) {
  const { 
    bpmnContainerRef, 
    loading, 
    error, 
    saveBpmn 
  } = useBPMN(selectedWorkflowId, workflowDetail, activities, transitions, isActive);

  const handleSave = async () => {
    const result = await saveBpmn();
    if (result.success) {
      await onReload();
      alert('✅ Đã lưu BPMN thành công!\n\n💡 Chỉ lưu layout và vị trí elements, không thay đổi logic workflow.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <b>BPMN Diagram Editor</b>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wf-btn" onClick={handleSave} disabled={loading}>
            💾 Lưu BPMN
          </button>
          <button className="wf-btn" onClick={onReload} disabled={loading}>
            🔄 Reload
          </button>
        </div>
      </div>
      {error && <div className="wf-alert" style={{ marginBottom: 12 }}>Error: {error}</div>}
      <div ref={bpmnContainerRef} className="wf-bpmn" style={{ height: '600px', border: '1px solid #333' }} />
    </div>
  );
}

export default BPMNEditor;