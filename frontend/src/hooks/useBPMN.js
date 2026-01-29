import { useState, useEffect, useRef, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { workflowService } from '../services/workflowService';

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

export function useBPMN(selectedWorkflowId, workflowDetail, activities, transitions, isActive) {
  const bpmnContainerRef = useRef(null);
  const bpmnModelerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanupBpmnModeler = useCallback(() => {
    if (bpmnModelerRef.current) {
      try {
        bpmnModelerRef.current.destroy();
      } catch (e) {
        console.warn('Error cleaning up BPMN modeler:', e.message);
      }
      bpmnModelerRef.current = null;
    }
  }, []);

  const initBpmn = useCallback(() => {
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
      setError('');
      cleanupBpmnModeler();
      
      bpmnModelerRef.current = new BpmnModeler({
        container: bpmnContainerRef.current,
        height: '400px'
      });

      // Use saved BPMN XML if available, otherwise generate from activities/transitions
      let xml;
      if (workflowDetail.bpmn_xml && workflowDetail.bpmn_xml.trim()) {
        xml = workflowDetail.bpmn_xml;
        console.log('BPMN XML source: loaded from database, length:', xml.length);
        
        const hasDiagram = xml.includes('<bpmndi:BPMNDiagram') || xml.includes('bpmndi:BPMNDiagram');
        const hasProcess = xml.includes('<process') || xml.includes('process');
        console.log('BPMN XML validation:', {
          hasDiagram,
          hasProcess,
          preview: xml.substring(0, 500) + '...'
        });
        
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
  }, [workflowDetail, activities, transitions, cleanupBpmnModeler]);

  const saveBpmn = useCallback(async () => {
    if (!bpmnModelerRef.current || !selectedWorkflowId) {
      setError('Không có BPMN editor hoặc workflow được chọn');
      return { success: false, error: 'No BPMN editor or workflow selected' };
    }
    
    setError('');
    setLoading(true);
    try {
      const { xml } = await bpmnModelerRef.current.saveXML({ format: true });
      console.log('Saving BPMN XML length:', xml.length);
      console.log('BPMN XML preview:', xml.substring(0, 200));
      
      await workflowService.saveBpmnXml(selectedWorkflowId, xml);
      return { success: true };
    } catch (e) {
      console.error('Save BPMN error details:', e);
      let errorMsg = e.message || String(e);
      
      if (errorMsg.includes('validation failed')) {
        errorMsg = `❌ BPMN Validation Error:\n\nCác vấn đề có thể gặp:\n• Elements bị disconnected (không có sequence flow)\n• Missing start/end events\n• Invalid BPMN structure\n\n💡 Giải pháp:\n• Reload BPMN để khôi phục\n• Kiểm tra tất cả elements có kết nối\n• Đảm bảo có Start và End event\n\nLỗi chi tiết: ${errorMsg}`;
      }
      
      setError(`Lỗi lưu BPMN: ${errorMsg}`);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId]);

  // Initialize BPMN when conditions are met
  useEffect(() => {
    console.log('BPMN effect triggered:', {
      isActive,
      hasWorkflowDetail: !!workflowDetail,
      activitiesCount: activities.length,
      transitionsCount: transitions.length
    });
    
    if (isActive && workflowDetail && activities.length > 0) {
      setTimeout(() => initBpmn(), 100);
    } else if (!isActive) {
      cleanupBpmnModeler();
    }
  }, [isActive, workflowDetail, activities, transitions, initBpmn, cleanupBpmnModeler]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupBpmnModeler;
  }, [cleanupBpmnModeler]);

  return {
    bpmnContainerRef,
    loading,
    error,
    setError,
    initBpmn,
    saveBpmn,
    cleanupBpmnModeler
  };
}