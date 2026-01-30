import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import './App.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

const API_BASE = process.env.REACT_APP_API_URL;//'http://localhost:5000';

// Utility function for safe BPMN canvas zooming
const safeBpmnZoom = (canvas, zoomType = 'fit-viewport', fallbackZoom = 1.0) => {
  try {
    if (!canvas) return false;
    
    let vb = null;
    try { vb = canvas.viewbox && canvas.viewbox(); } catch (_) { vb = null; }
    
    if (zoomType === 'fit-viewport') {
      const isValid = vb && Number.isFinite(vb.width) && Number.isFinite(vb.height) && vb.width > 0 && vb.height > 0;
      if (isValid) {
        canvas.zoom('fit-viewport');
        return true;
      } else {
        console.warn('Invalid viewbox for fit-viewport, using fallback zoom:', fallbackZoom);
        canvas.zoom(fallbackZoom);
        return false;
      }
    } else {
      // Direct zoom value
      if (Number.isFinite(zoomType) && zoomType > 0) {
        canvas.zoom(zoomType);
        return true;
      } else {
        console.warn('Invalid zoom value:', zoomType, 'using fallback:', fallbackZoom);
        canvas.zoom(fallbackZoom);
        return false;
      }
    }
  } catch (e) {
    console.warn('Failed to zoom BPMN canvas:', e.message);
    try { 
      canvas.zoom(fallbackZoom); 
      return false;
    } catch (_) { 
      return false; 
    }
  }
};

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || text;
    } catch (e) {
      // Not JSON, use text as is
    }
    throw new Error(errorMsg);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || text;
    } catch (e) {
      // Not JSON, use text as is
    }
    throw new Error(errorMsg);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {};
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || text;
    } catch (e) {
      // Not JSON, use text as is
    }
    throw new Error(errorMsg);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {};
}

async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || text;
    } catch (e) {
      // Not JSON, use text as is
    }
    throw new Error(errorMsg);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {};
}

function buildBpmnXml(workflow, activities, transitions) {
  if (!workflow) return '';

  const startId = 'StartEvent_1';
  const endId = 'EndEvent_1';

  // Create basic BPMN even if no activities
  if (!activities || activities.length === 0) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             id="Definitions_${workflow.id}"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_${workflow.id}" isExecutable="true">
    <startEvent id="${startId}" name="Bắt đầu" />
    <sequenceFlow id="Flow_start_to_end" sourceRef="${startId}" targetRef="${endId}" />
    <endEvent id="${endId}" name="Kết thúc" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${workflow.id}">
    <bpmndi:BPMNPlane id="BPMNPlane_${workflow.id}" bpmnElement="Process_${workflow.id}">
      <bpmndi:BPMNShape id="${startId}_di" bpmnElement="${startId}">
        <dc:Bounds x="200" y="150" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="${endId}_di" bpmnElement="${endId}">
        <dc:Bounds x="350" y="150" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_start_to_end_di" bpmnElement="Flow_start_to_end">
        <di:waypoint x="236" y="168" />
        <di:waypoint x="350" y="168" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;
    return xml;
  }

  const positions = {};
  const y = 150;
  let x = 200;

  activities.forEach((a, idx) => {
    positions[`Activity_${a.id}`] = { x: x + idx * 160, y };
  });

  const startPos = { x: 100, y };
  const lastActivityKey = activities.length > 0 ? `Activity_${activities[activities.length - 1].id}` : null;
  const endPos = lastActivityKey ? { x: positions[lastActivityKey].x + 160, y } : { x: 260, y };

  const tasksXml = activities.map((a) => `<userTask id="Activity_${a.id}" name="${a.name}" />`).join('\n    ');

  const sequenceFlows = [];
  const flowDiEdges = [];

  if (activities.length > 0) {
    const firstActivityId = activities[0].id;
    const flowId = 'Flow_start';
    sequenceFlows.push(`<sequenceFlow id="${flowId}" sourceRef="${startId}" targetRef="Activity_${firstActivityId}" />`);
    const target = positions[`Activity_${firstActivityId}`];
    flowDiEdges.push(
      `<bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
        <di:waypoint x="${startPos.x + 36}" y="${startPos.y + 18}" />
        <di:waypoint x="${target.x}" y="${target.y + 18}" />
      </bpmndi:BPMNEdge>`
    );
  }

  transitions.forEach((t) => {
    const flowId = `Flow_${t.id}`;
    sequenceFlows.push(
      `<sequenceFlow id="${flowId}" sourceRef="Activity_${t.from_activity_id}" targetRef="Activity_${t.to_activity_id}" />`
    );
    const source = positions[`Activity_${t.from_activity_id}`];
    const target = positions[`Activity_${t.to_activity_id}`];
    if (source && target) {
      flowDiEdges.push(
        `<bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
        <di:waypoint x="${source.x + 100}" y="${source.y + 18}" />
        <di:waypoint x="${target.x}" y="${target.y + 18}" />
      </bpmndi:BPMNEdge>`
      );
    }
  });

  if (lastActivityKey) {
    const flowId = 'Flow_to_end';
    sequenceFlows.push(`<sequenceFlow id="${flowId}" sourceRef="${lastActivityKey}" targetRef="${endId}" />`);
    const source = positions[lastActivityKey];
    flowDiEdges.push(
      `<bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
        <di:waypoint x="${source.x + 100}" y="${source.y + 18}" />
        <di:waypoint x="${endPos.x}" y="${endPos.y + 18}" />
      </bpmndi:BPMNEdge>`
    );
  }

  const shapes = [
    `<bpmndi:BPMNShape id="${startId}_di" bpmnElement="${startId}">
      <dc:Bounds x="${startPos.x}" y="${startPos.y}" width="36" height="36" />
    </bpmndi:BPMNShape>`,
    ...activities.map((a) => {
      const p = positions[`Activity_${a.id}`];
      return `<bpmndi:BPMNShape id="Activity_${a.id}_di" bpmnElement="Activity_${a.id}">
      <dc:Bounds x="${p.x}" y="${p.y}" width="100" height="36" />
    </bpmndi:BPMNShape>`;
    }),
    `<bpmndi:BPMNShape id="${endId}_di" bpmnElement="${endId}">
      <dc:Bounds x="${endPos.x}" y="${endPos.y}" width="36" height="36" />
    </bpmndi:BPMNShape>`
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             id="Definitions_${workflow.id}"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_${workflow.id}" isExecutable="true">
    <startEvent id="${startId}" name="Bắt đầu" />
    ${tasksXml}
    <endEvent id="${endId}" name="Kết thúc" />
    ${sequenceFlows.join('\n    ')}
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${workflow.id}">
    <bpmndi:BPMNPlane id="BPMNPlane_${workflow.id}" bpmnElement="Process_${workflow.id}">
      ${shapes.join('\n      ')}
      ${flowDiEdges.join('\n      ')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

  return xml;
}

function WorkflowManagement({ onBack }) {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [workflowDetail, setWorkflowDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [activeTab, setActiveTab] = useState('activities'); // activities | transitions | bpmn | outbox
  const [outbox, setOutbox] = useState([]);
  const [outboxStatus, setOutboxStatus] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(null); // 'workflow' | 'activity' | 'transition' | null
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // BPMN refs
  const bpmnContainerRef = useRef(null);
  const bpmnModelerRef = useRef(null);

  useEffect(() => {
    loadWorkflows();
    
    // Cleanup function
    return () => {
      cleanupBpmnModeler();
    };
  }, []);

  useEffect(() => {
    if (selectedWorkflowId) {
      // Cleanup previous modeler when switching workflow
      cleanupBpmnModeler();
      loadWorkflowDetail();
    } else {
      setWorkflowDetail(null);
      setActivities([]);
      setTransitions([]);
      cleanupBpmnModeler();
    }
  }, [selectedWorkflowId]);

  useEffect(() => {
    console.log('BPMN effect triggered:', {
      activeTab,
      hasWorkflowDetail: !!workflowDetail,
      activitiesCount: activities.length,
      transitionsCount: transitions.length
    });
    
    if (activeTab === 'bpmn' && workflowDetail && activities.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => initBpmn(), 100);
    } else if (activeTab !== 'bpmn') {
      // Cleanup when leaving BPMN tab to free memory
      cleanupBpmnModeler();
    }
  }, [activeTab, workflowDetail, activities, transitions]);

  const loadWorkflows = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiGet('/api/workflows');
      setWorkflows(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowDetail = async () => {
    if (!selectedWorkflowId) return;
    setError('');
    setLoading(true);
    try {
      const [wfData, actsData, transData] = await Promise.all([
        apiGet(`/api/workflows/${selectedWorkflowId}`),
        apiGet(`/api/workflows/${selectedWorkflowId}/activities`),
        apiGet(`/api/workflows/${selectedWorkflowId}/transitions`)
      ]);
      console.log('Loaded workflow detail:', {
        id: wfData.workflow?.id,
        name: wfData.workflow?.name,
        hasBpmnXml: !!wfData.workflow?.bpmn_xml,
        bpmnXmlLength: wfData.workflow?.bpmn_xml?.length || 0
      });
      setWorkflowDetail(wfData.workflow);
      setActivities(actsData);
      setTransitions(transData);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const cleanupBpmnModeler = () => {
    if (bpmnModelerRef.current) {
      try {
        // Destroy the modeler instance to free memory and avoid conflicts
        bpmnModelerRef.current.destroy();
      } catch (e) {
        console.warn('Error cleaning up BPMN modeler:', e.message);
      }
      bpmnModelerRef.current = null;
    }
  };

  const initBpmn = () => {
    console.log('initBpmn called:', {
      container: !!bpmnContainerRef.current,
      workflowDetail: !!workflowDetail,
      activitiesCount: activities.length,
      hasXML: !!(workflowDetail && workflowDetail.bpmn_xml)
    });
    
    if (!bpmnContainerRef.current || !workflowDetail || activities.length === 0) {
      console.warn('Cannot init BPMN: missing container, workflow detail, or activities');
      return;
    }

    try {
      // Always cleanup and recreate to avoid conflicts
      cleanupBpmnModeler();
      
      // Create new modeler instance
      bpmnModelerRef.current = new BpmnModeler({
        container: bpmnContainerRef.current,
        // Remove keyboard binding to avoid warnings
        height: '400px'
      });

      // Use saved BPMN XML if available, otherwise generate from activities/transitions
      let xml;
      if (workflowDetail.bpmn_xml && workflowDetail.bpmn_xml.trim()) {
        xml = workflowDetail.bpmn_xml;
        console.log('BPMN XML source: loaded from database, length:', xml.length);
        
        // Debug: check if XML has diagram elements
        const hasDiagram = xml.includes('<bpmndi:BPMNDiagram') || xml.includes('bpmndi:BPMNDiagram');
        const hasProcess = xml.includes('<process') || xml.includes('process');
        console.log('BPMN XML validation:', {
          hasDiagram,
          hasProcess,
          preview: xml.substring(0, 500) + '...'
        });
        
        // If no diagram, regenerate
        if (!hasDiagram) {
          console.warn('BPMN XML missing diagram elements, regenerating...');
          xml = buildBpmnXml(workflowDetail, activities, transitions);
        }
      } else {
        console.log('No saved BPMN XML, generating from activities/transitions:', {
          activitiesCount: activities.length,
          transitionsCount: transitions.length
        });
        xml = buildBpmnXml(workflowDetail, activities, transitions);
        console.log('BPMN XML source: generated from activities/transitions, length:', xml.length);
      }
      
      // Validate XML before importing
      if (!xml || !xml.trim() || xml.length < 50) {
        throw new Error('Invalid BPMN XML generated');
      }
      
      bpmnModelerRef.current
        .importXML(xml)
        .then(() => {
          console.log('BPMN imported successfully');
          try {
            const canvas = bpmnModelerRef.current?.get('canvas');
            if (canvas) {
              // Wait for DOM to be ready then apply safe zoom
              requestAnimationFrame(() => requestAnimationFrame(() => {
                safeBpmnZoom(canvas, 'fit-viewport', 1.0);
              }));
            }
          } catch (e) {
            console.warn('Error setting up canvas:', e.message);
          }
        })
        .catch((e) => {
          console.error('BPMN import error:', e);
          setError(`Không thể tải BPMN: ${e.message || String(e)}`);
        });
    } catch (e) {
      console.error('Error initializing BPMN modeler:', e);
      setError(`Lỗi khởi tạo BPMN editor: ${e.message || String(e)}`);
    }
  };

  const handleSaveBpmn = async () => {
    if (!bpmnModelerRef.current || !selectedWorkflowId) {
      setError('Không có BPMN editor hoặc workflow được chọn');
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      const { xml } = await bpmnModelerRef.current.saveXML({ format: true });
      console.log('Saving BPMN XML length:', xml.length);
      console.log('BPMN XML preview:', xml.substring(0, 200));
      
      // Use simple save endpoint instead of complex import
      const response = await apiPost(`/api/workflows/${selectedWorkflowId}/save-bpmn-xml`, {
        bpmnXml: xml
      });
      
      await loadWorkflowDetail();
      alert('✅ Đã lưu BPMN thành công!\n\n💡 Chỉ lưu layout và vị trí elements, không thay đổi logic workflow.');
    } catch (e) {
      console.error('Save BPMN error details:', e);
      let errorMsg = e.message || String(e);
      
      // Parse detailed error from backend
      if (errorMsg.includes('validation failed')) {
        errorMsg = `❌ BPMN Validation Error:\n\nCác vấn đề có thể gặp:\n• Elements bị disconnected (không có sequence flow)\n• Missing start/end events\n• Invalid BPMN structure\n\n💡 Giải pháp:\n• Reload BPMN để khôi phục\n• Kiểm tra tất cả elements có kết nối\n• Đảm bảo có Start và End event\n\nLỗi chi tiết: ${errorMsg}`;
      }
      
      setError(`Lỗi lưu BPMN: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    setError('');
    setLoading(true);
    try {
      await apiPost('/api/workflows', formData);
      setShowForm(null);
      setFormData({});
      await loadWorkflows();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdvancedApprovalWorkflow = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await apiPost('/api/demo/create-advanced-approval-workflow', {
        name: 'Quy trình phê duyệt nâng cao',
        description: 'Workflow với xử lý từ chối thông minh: Song song gửi thông báo + quay về soạn lại'
      });
      
      await loadWorkflows();
      setSelectedWorkflowId(result.workflowId);
      alert(`✅ ${result.message}\n\n🔥 Tính năng nâng cao:\n${Object.entries(result.features).map(([k,v]) => `• ${v}`).join('\n')}\n\n📋 Hướng dẫn:\n${Object.values(result.usage).join('\n')}`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApprovalWorkflow = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await apiPost('/api/demo/create-approval-workflow', {
        name: 'Quy trình phê duyệt với thông báo',
        description: 'Workflow mẫu: Soạn đơn → Lãnh đạo phê duyệt → Gửi thông báo tự động'
      });
      
      await loadWorkflows();
      setSelectedWorkflowId(result.workflowId);
      alert(`✅ ${result.message}\n\n📋 Hướng dẫn sử dụng:\n${Object.values(result.usage).join('\n')}`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWorkflow = async () => {
    if (!editingItem) return;
    setError('');
    setLoading(true);
    try {
      await apiPut(`/api/workflows/${editingItem.id}`, formData);
      setShowForm(null);
      setEditingItem(null);
      setFormData({});
      await loadWorkflows();
      if (selectedWorkflowId === editingItem.id) {
        await loadWorkflowDetail();
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkflow = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa workflow này?')) return;
    setError('');
    setLoading(true);
    try {
      await apiDelete(`/api/workflows/${id}`);
      if (selectedWorkflowId === id) {
        setSelectedWorkflowId(null);
      }
      await loadWorkflows();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!selectedWorkflowId) return;
    setError('');
    setLoading(true);
    try {
      await apiPost(`/api/workflows/${selectedWorkflowId}/activities`, formData);
      setShowForm(null);
      setFormData({});
      await loadWorkflowDetail();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateActivity = async () => {
    if (!editingItem) return;
    setError('');
    setLoading(true);
    try {
      await apiPut(`/api/activities/${editingItem.id}`, formData);
      setShowForm(null);
      setEditingItem(null);
      setFormData({});
      await loadWorkflowDetail();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa activity này?')) return;
    setError('');
    setLoading(true);
    try {
      await apiDelete(`/api/activities/${id}`);
      await loadWorkflowDetail();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransition = async () => {
    if (!selectedWorkflowId) return;
    setError('');
    setLoading(true);
    try {
      await apiPost(`/api/workflows/${selectedWorkflowId}/transitions`, formData);
      setShowForm(null);
      setFormData({});
      await loadWorkflowDetail();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTransition = async () => {
    if (!editingItem) return;
    setError('');
    setLoading(true);
    try {
      await apiPut(`/api/transitions/${editingItem.id}`, formData);
      setShowForm(null);
      setEditingItem(null);
      setFormData({});
      await loadWorkflowDetail();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransition = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa transition này?')) return;
    setError('');
    setLoading(true);
    try {
      await apiDelete(`/api/transitions/${id}`);
      await loadWorkflowDetail();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Outbox helpers
  const loadOutbox = async () => {
    setError('');
    try {
      const q = outboxStatus ? `?status=${encodeURIComponent(outboxStatus)}` : '';
      const data = await apiGet(`/api/outbox${q}`);
      setOutbox(data);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  useEffect(() => {
    if (activeTab === 'outbox') loadOutbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, outboxStatus]);

  const retryOutbox = async (id) => {
    setError('');
    try {
      await apiPost(`/api/outbox/${id}/retry`);
      await loadOutbox();
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  return (
    <div className="wf-page">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Quản lý Workflow Definitions</h2>
          <p className="wf-subtitle">Tạo và quản lý định nghĩa quy trình, activities và transitions</p>
        </div>
        <button className="wf-btn wf-btn-primary" onClick={onBack}>
          ← Về Workflow Demo
        </button>
      </div>

      {error ? <div className="wf-alert">Error: {error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginTop: 16 }}>
        {/* Sidebar: Danh sách workflows */}
        <div className="wf-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 className="wf-card-title" style={{ margin: 0 }}>Workflows</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="wf-btn"
                style={{ fontSize: 10, backgroundColor: '#4caf50', color: 'white' }}
                onClick={handleCreateApprovalWorkflow}
              >
                🔄 Demo Cơ bản
              </button>
              <button
                className="wf-btn"
                style={{ fontSize: 10, backgroundColor: '#ff9800', color: 'white' }}
                onClick={handleCreateAdvancedApprovalWorkflow}
              >
                ⚡ Demo Nâng cao
              </button>
              <button
                className="wf-btn"
                onClick={() => {
                  setShowForm('workflow');
                  setEditingItem(null);
                  setFormData({ name: '', description: '', version: 1 });
                }}
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
              onClick={() => setSelectedWorkflowId(wf.id)}
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
                    setShowForm('workflow');
                    setEditingItem(wf);
                    setFormData({ name: wf.name, description: wf.description || '', version: wf.version });
                  }}
                >
                  Sửa
                </button>
                <button
                  className="wf-btn"
                  style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f44336', color: 'white' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWorkflow(wf.id);
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Main: Chi tiết workflow */}
        <div className="wf-card">
          {!selectedWorkflowId ? (
            <div className="wf-muted">Chọn một workflow từ danh sách bên trái để xem chi tiết.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 className="wf-card-title" style={{ margin: 0 }}>{workflowDetail?.name || 'Loading...'}</h3>
                  {workflowDetail ? (
                    <div className="wf-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Version {workflowDetail.version} • ID: {workflowDetail.id}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #333' }}>
                <button
                  className={activeTab === 'activities' ? 'wf-btn wf-btn-primary' : 'wf-btn'}
                  onClick={() => setActiveTab('activities')}
                >
                  Activities
                </button>
                <button
                  className={activeTab === 'transitions' ? 'wf-btn wf-btn-primary' : 'wf-btn'}
                  onClick={() => setActiveTab('transitions')}
                >
                  Transitions
                </button>
                <button
                  className={activeTab === 'bpmn' ? 'wf-btn wf-btn-primary' : 'wf-btn'}
                  onClick={() => setActiveTab('bpmn')}
                >
                  BPMN Editor
                </button>
                <button
                  className={activeTab === 'outbox' ? 'wf-btn wf-btn-primary' : 'wf-btn'}
                  onClick={() => setActiveTab('outbox')}
                >
                  Outbox
                </button>
              </div>

              {/* Tab content */}
              {activeTab === 'activities' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <b>Activity Definitions</b>
                    <button
                      className="wf-btn"
                      onClick={() => {
                        setShowForm('activity');
                        setEditingItem(null);
                        setFormData({ name: '', type: 'user' });
                      }}
                    >
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
                          onClick={() => {
                            setShowForm('activity');
                            setEditingItem(act);
                            setFormData({ name: act.name, type: act.type, handler: act.handler || '' });
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          className="wf-btn"
                          style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f44336', color: 'white' }}
                          onClick={() => handleDeleteActivity(act.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'transitions' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <b>Transition Definitions</b>
                    <button
                      className="wf-btn"
                      onClick={() => {
                        setShowForm('transition');
                        setEditingItem(null);
                        setFormData({ from_activity_id: '', to_activity_id: '', condition: 'Done' });
                      }}
                    >
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
                            onClick={() => {
                              setShowForm('transition');
                              setEditingItem(trans);
                              setFormData({
                                from_activity_id: trans.from_activity_id,
                                to_activity_id: trans.to_activity_id,
                                condition: trans.condition,
                                priority: trans.priority ?? '',
                                is_default: !!trans.is_default
                              });
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            className="wf-btn"
                            style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f44336', color: 'white' }}
                            onClick={() => handleDeleteTransition(trans.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'bpmn' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <b>BPMN Diagram Editor</b>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="wf-btn" onClick={handleSaveBpmn} disabled={loading}>
                        💾 Lưu BPMN
                      </button>
                      <button className="wf-btn" onClick={loadWorkflowDetail} disabled={loading}>
                        🔄 Reload
                      </button>
                    </div>
                  </div>
                  <div ref={bpmnContainerRef} className="wf-bpmn" style={{ height: '600px', border: '1px solid #333' }} />
                </div>
              )}

              {activeTab === 'outbox' && (
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
              )}
            </>
          )}
        </div>
      </div>

      {/* Forms */}
      {showForm === 'workflow' && (
        <div className="wf-modal-backdrop" onClick={() => setShowForm(null)}>
          <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingItem ? 'Sửa Workflow' : 'Tạo Workflow mới'}</h3>
            <div className="wf-field">
              <label>Tên</label>
              <input
                className="wf-control"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="wf-field">
              <label>Mô tả</label>
              <textarea
                className="wf-control"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="wf-field">
              <label>Version</label>
              <input
                className="wf-control"
                type="number"
                value={formData.version || 1}
                onChange={(e) => setFormData({ ...formData, version: Number(e.target.value) })}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="wf-btn wf-btn-primary" onClick={editingItem ? handleUpdateWorkflow : handleCreateWorkflow} disabled={loading}>
                {editingItem ? 'Cập nhật' : 'Tạo mới'}
              </button>
              <button className="wf-btn" onClick={() => setShowForm(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm === 'activity' && (
        <div className="wf-modal-backdrop" onClick={() => setShowForm(null)}>
          <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingItem ? 'Sửa Activity' : 'Tạo Activity mới'}</h3>
            <div className="wf-field">
              <label>Tên</label>
              <input
                className="wf-control"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="wf-field">
              <label>Type</label>
              <select
                className="wf-control"
                value={formData.type || 'user'}
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
                  value={formData.handler || ''}
                  onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
                  placeholder="Ví dụ: NotifyERP"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="wf-btn wf-btn-primary" onClick={editingItem ? handleUpdateActivity : handleCreateActivity} disabled={loading}>
                {editingItem ? 'Cập nhật' : 'Tạo mới'}
              </button>
              <button className="wf-btn" onClick={() => setShowForm(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm === 'transition' && (
        <div className="wf-modal-backdrop" onClick={() => setShowForm(null)}>
          <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingItem ? 'Sửa Transition' : 'Tạo Transition mới'}</h3>
            <div className="wf-field">
              <label>From Activity ID</label>
              <select
                className="wf-control"
                value={formData.from_activity_id || ''}
                onChange={(e) => setFormData({ ...formData, from_activity_id: Number(e.target.value) })}
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
                value={formData.to_activity_id || ''}
                onChange={(e) => setFormData({ ...formData, to_activity_id: Number(e.target.value) })}
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
                value={formData.condition || 'Done'}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                placeholder="Done, Approved, Rejected... hoặc = ctx.amount > 10000"
              />
            </div>
            <div className="wf-field">
              <label>Priority</label>
              <input
                className="wf-control"
                type="number"
                value={formData.priority ?? ''}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <div className="wf-field">
              <label>
                <input
                  type="checkbox"
                  checked={!!formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />{' '}
                Default
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="wf-btn wf-btn-primary" onClick={editingItem ? handleUpdateTransition : handleCreateTransition} disabled={loading}>
                {editingItem ? 'Cập nhật' : 'Tạo mới'}
              </button>
              <button className="wf-btn" onClick={() => setShowForm(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowManagement;

