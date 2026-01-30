import React, { useState, useRef, useEffect } from 'react';
import BpmnJS from 'bpmn-js/dist/bpmn-modeler.development.js';
import { debounce } from '../utils';
import { apiGet } from '../services/apiClient';

// Validate BPMN XML structure
const isValidBpmnXml = (xml) => {
  if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
    return false;
  }
  
  try {
    // Basic checks
    const trimmed = xml.trim();
    return trimmed.includes('<bpmn:definitions') && 
           trimmed.includes('</bpmn:definitions>') &&
           trimmed.includes('xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
  } catch (e) {
    return false;
  }
};

// Helper function to build BPMN XML from activities and transitions
const buildBpmnFromActivities = (workflowId, activities = [], transitions = []) => {
  console.log('🔧 buildBpmnFromActivities called:', {
    workflowId,
    activitiesCount: activities.length,
    transitionsCount: transitions.length,
    activities,
    transitions
  });

  const positions = {};
  const y = 150;
  let x = 200;

  activities.forEach((a, idx) => {
    positions[`Activity_${a.id}`] = { x: x + idx * 160, y };
  });

  const tasksXml = activities.map((a) => {
    const id = `Activity_${a.id}`;
    const name = a.name || '';
    
    switch (a.type) {
      case 'start':
        return `    <bpmn:startEvent id="${id}" name="${name}" />`;
      case 'end':
        return `    <bpmn:endEvent id="${id}" name="${name}" />`;
      case 'service':
        return `    <bpmn:serviceTask id="${id}" name="${name}">
      <bpmn:extensionElements>
        <wf:handler>${a.handler || ''}</wf:handler>
      </bpmn:extensionElements>
    </bpmn:serviceTask>`;
      case 'parallelGateway':
        return `    <bpmn:parallelGateway id="${id}" name="${name}" />`;
      case 'exclusiveGateway':
        return `    <bpmn:exclusiveGateway id="${id}" name="${name}" />`;
      case 'role':
        return `    <bpmn:userTask id="${id}" name="[role] ${name}">
      <bpmn:extensionElements>
        <wf:type>role</wf:type>
      </bpmn:extensionElements>
    </bpmn:userTask>`;
      case 'department':
        return `    <bpmn:userTask id="${id}" name="[department] ${name}">
      <bpmn:extensionElements>
        <wf:type>department</wf:type>
      </bpmn:extensionElements>
    </bpmn:userTask>`;
      default: // user
        return `    <bpmn:userTask id="${id}" name="${name}" />`;
    }
  }).join('\n');

  const sequenceFlows = transitions.map((t) => {
    const flowId = `Flow_${t.id}`;
    const sourceRef = `Activity_${t.from_activity_id}`;
    const targetRef = `Activity_${t.to_activity_id}`;
    const conditionName = t.condition && t.condition !== 'Done' ? ` name="${t.condition}"` : '';
    
    return `    <bpmn:sequenceFlow id="${flowId}" sourceRef="${sourceRef}" targetRef="${targetRef}"${conditionName} />`;
  }).join('\n');

  const flowDiEdges = transitions.map((t) => {
    const flowId = `Flow_${t.id}`;
    const sourcePos = positions[`Activity_${t.from_activity_id}`];
    const targetPos = positions[`Activity_${t.to_activity_id}`];
    
    if (sourcePos && targetPos) {
      const sourceActivity = activities.find(a => a.id === t.from_activity_id);
      let sourceWidth = 100;
      if (sourceActivity && (sourceActivity.type === 'parallelGateway' || sourceActivity.type === 'exclusiveGateway')) {
        sourceWidth = 50;
      } else if (sourceActivity && (sourceActivity.type === 'start' || sourceActivity.type === 'end')) {
        sourceWidth = 36;
      }

      return `      <bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
        <di:waypoint x="${sourcePos.x + sourceWidth/2}" y="${sourcePos.y + 40}" />
        <di:waypoint x="${targetPos.x + 50}" y="${targetPos.y + 40}" />
      </bpmndi:BPMNEdge>`;
    }
    return '';
  }).filter(Boolean).join('\n');

  const shapes = activities.map((a) => {
    const p = positions[`Activity_${a.id}`];
    let width = 100, height = 80;
    if (a.type === 'start' || a.type === 'end') {
      width = height = 36;
    } else if (a.type === 'parallelGateway' || a.type === 'exclusiveGateway') {
      width = height = 50;
    }
    
    return `      <bpmndi:BPMNShape id="Activity_${a.id}_di" bpmnElement="Activity_${a.id}">
        <dc:Bounds x="${p.x}" y="${p.y}" width="${width}" height="${height}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:wf="http://workflow.local/schema"
                  id="Definitions_${workflowId}"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_${workflowId}" isExecutable="true">
${tasksXml}
${sequenceFlows}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${workflowId}">
    <bpmndi:BPMNPlane id="BPMNPlane_${workflowId}" bpmnElement="Process_${workflowId}">
${shapes}
${flowDiEdges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
};

const BPMNEditor = ({ 
  bpmnXml, 
  onSave, 
  workflowId, 
  activities: propActivities = [], 
  transitions: propTransitions = [], 
  isReadOnly = false 
}) => {
  console.log('🔍 BPMNEditor received props:', {
    workflowId,
    bpmnXml: bpmnXml ? `${bpmnXml.length} chars` : 'null',
    activitiesCount: propActivities.length,
    transitionsCount: propTransitions.length,
    propActivities,
    propTransitions
  });
  
  const containerRef = useRef();
  const bpmnModelerRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use props data instead of state
  const activities = propActivities;
  const transitions = propTransitions;

  // Debounced save function
  const debouncedSave = debounce(async (xml) => {
    if (onSave && workflowId && !isReadOnly) {
      try {
        await onSave(workflowId, xml);
      } catch (error) {
        console.error('Error saving BPMN:', error);
        setError('Lỗi khi lưu BPMN: ' + error.message);
      }
    }
  }, 2000);

  useEffect(() => {
    if (!containerRef.current) return;

    const bpmnModeler = new BpmnJS({
      container: containerRef.current
    });

    bpmnModelerRef.current = bpmnModeler;

    // Wait for modeler to be fully initialized
    const initializeModeler = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Short delay
        
        let xmlToLoad = null;
        
        // Priority 1: Use saved BPMN XML if it exists and is valid
        if (bpmnXml && isValidBpmnXml(bpmnXml)) {
          console.log('✅ Using saved BPMN XML (length:', bpmnXml.length, ')');
          xmlToLoad = bpmnXml;
        } 
        // Priority 2: Generate from activities and transitions if no saved XML
        else if (activities.length > 0) {
          console.log('🔧 No valid saved BPMN XML, generating from activities/transitions...');
          console.log('📊 Activities data:', activities);
          console.log('🔄 Transitions data:', transitions);
          
          xmlToLoad = buildBpmnFromActivities(workflowId, activities, transitions);
          console.log('✅ Generated BPMN XML (length:', xmlToLoad.length, ')');
          
          // Save generated XML to see structure
          console.log('🔍 Full Generated XML:', xmlToLoad);
        } 
        // Priority 3: Create empty diagram
        else {
          console.log('📝 No data available, creating empty diagram');
          await bpmnModeler.createDiagram();
          setLoading(false);
          return;
        }
        
        if (xmlToLoad) {
          console.log('🚀 Loading BPMN XML into modeler...');
          console.log('📄 XML Preview:', xmlToLoad.substring(0, 200) + '...');
          
          // Additional validation
          if (!isValidBpmnXml(xmlToLoad)) {
            throw new Error('Generated/provided XML is not valid BPMN format');
          }
          
          await bpmnModeler.importXML(xmlToLoad);
          console.log('✅ BPMN loaded successfully');
          
          // Auto-fit viewport with error handling
          setTimeout(() => {
            try {
              const canvas = bpmnModeler.get('canvas');
              const viewbox = canvas.viewbox();
              if (viewbox.inner && viewbox.inner.width > 0 && viewbox.inner.height > 0) {
                canvas.zoom('fit-viewport');
              } else {
                console.log('Skipping auto-fit: invalid viewbox dimensions');
              }
            } catch (e) {
              console.warn('Could not auto-fit viewport:', e.message);
            }
          }, 200);
        }

        // Setup auto-save if not read-only
        if (!isReadOnly && onSave) {
          const eventBus = bpmnModeler.get('eventBus');
          eventBus.on(['commandStack.changed'], debounce(async () => {
            try {
              const { xml } = await bpmnModeler.saveXML({ format: true });
              debouncedSave(xml);
            } catch (error) {
              console.error('Error getting XML for auto-save:', error);
            }
          }, 1000));
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Critical error in initializeModeler:', error);
        
        // Last resort: create empty diagram
        try {
          await bpmnModeler.createDiagram();
          setError('Tạo sơ đồ trống do lỗi load dữ liệu: ' + error.message);
          console.log('✅ Created empty diagram as final fallback');
        } catch (finalError) {
          setError('Không thể khởi tạo BPMN Editor: ' + finalError.message);
        }
        
        setLoading(false);
      }
    };

    initializeModeler();

    return () => {
      if (bpmnModelerRef.current) {
        bpmnModelerRef.current.destroy();
      }
    };
  }, [workflowId, isReadOnly, bpmnXml, activities, transitions]);

  const handleManualSave = async () => {
    if (!bpmnModelerRef.current || !onSave || !workflowId || isReadOnly) return;

    try {
      setError(null);
      // Check if there's a valid diagram
      const canvas = bpmnModelerRef.current.get('canvas');
      if (!canvas || !canvas.getRootElement()) {
        setError('Không có sơ đồ để lưu. Vui lòng tạo sơ đồ trước.');
        return;
      }
      
      const { xml } = await bpmnModelerRef.current.saveXML({ format: true });
      if (!xml || xml.trim().length === 0) {
        setError('Không thể tạo XML từ sơ đồ.');
        return;
      }
      
      await onSave(workflowId, xml);
    } catch (error) {
      console.error('Error saving BPMN:', error);
      setError('Lỗi khi lưu BPMN: ' + error.message);
    }
  };

  const handleExport = async (format = 'xml') => {
    if (!bpmnModelerRef.current) {
      setError('BPMN Editor chưa sẵn sàng.');
      return;
    }

    try {
      setError(null);
      
      // Check if there's a valid diagram
      const canvas = bpmnModelerRef.current.get('canvas');
      if (!canvas || !canvas.getRootElement()) {
        setError('Không có sơ đồ để xuất. Vui lòng tạo sơ đồ trước.');
        return;
      }

      if (format === 'xml') {
        const { xml } = await bpmnModelerRef.current.saveXML({ format: true });
        if (!xml || xml.trim().length === 0) {
          setError('Không thể tạo XML từ sơ đồ.');
          return;
        }
        
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${workflowId || 'new'}.bpmn`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'svg') {
        const { svg } = await bpmnModelerRef.current.saveSVG();
        if (!svg || svg.trim().length === 0) {
          setError('Không thể tạo SVG từ sơ đồ.');
          return;
        }
        
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${workflowId || 'new'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting BPMN:', error);
      setError('Lỗi khi xuất BPMN: ' + error.message);
    }
  };

  return (
    <div className="bpmn-editor-container">
      <div className="bpmn-toolbar">
        {!isReadOnly && (
          <button onClick={handleManualSave} disabled={loading}>
            💾 Lưu
          </button>
        )}
        <button onClick={() => handleExport('xml')} disabled={loading}>
          📥 Xuất XML
        </button>
        <button onClick={() => handleExport('svg')} disabled={loading}>
          🖼️ Xuất SVG
        </button>
        {error && (
          <div className="error-message" style={{ color: 'red', marginLeft: '10px', maxWidth: '400px' }}>
            {error}
            {bpmnXml && (
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
                Dữ liệu BPMN có sẵn ({bpmnXml.length} ký tự). Có thể sơ đồ vẫn hiển thị được.
              </div>
            )}
          </div>
        )}
      </div>
      
      {loading && (
        <div className="bpmn-loading">
          <div className="loading-spinner">⏳</div>
          <div>Đang tải BPMN editor...</div>
          {bpmnXml && (
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
              Đang xử lý dữ liệu BPMN ({bpmnXml.length} ký tự)
            </div>
          )}
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="bpmn-container"
        style={{ 
          height: '500px', 
          border: '1px solid #ccc',
          background: 'white',
          display: loading ? 'none' : 'block'
        }}
      />
      
      <style jsx>{`
        .bpmn-editor-container {
          width: 100%;
          margin: 20px 0;
        }
        .bpmn-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: white;
          border: 1px solid #ccc;
          border-bottom: none;
        }
        .bpmn-toolbar button {
          padding: 5px 10px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .bpmn-toolbar button:hover:not(:disabled) {
          background: #0056b3;
        }
        .bpmn-toolbar button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .bpmn-loading {
          height: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid #ccc;
          background: white;
        }
        .loading-spinner {
          font-size: 2rem;
          margin-bottom: 10px;
        }
        .error-message {
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
};

export default BPMNEditor;