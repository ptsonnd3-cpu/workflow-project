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

  // Create intelligent positioning based on flow
  const positions = {};
  const activityMap = {};
  
  // Build activity lookup map
  activities.forEach(a => {
    activityMap[a.id] = a;
  });
  
  // Create flow-based positioning
  const layoutActivities = () => {
    let currentX = 100;
    let currentY = 120;
    const yIncrement = 120;
    const xIncrement = 200;
    
    // Find start and end activities
    const startActivity = activities.find(a => a.type === 'start');
    const endActivity = activities.find(a => a.type === 'end');
    
    // Position start activity
    if (startActivity) {
      positions[`Activity_${startActivity.id}`] = { x: currentX, y: currentY };
      currentX += xIncrement;
    }
    
    // Track positioned activities and queue for processing
    const positioned = new Set(startActivity ? [startActivity.id] : []);
    const queue = startActivity ? [startActivity.id] : [];
    let maxX = currentX; // Track rightmost position for end activity
    
    while (queue.length > 0) {
      const currentActivityId = queue.shift();
      const currentPos = positions[`Activity_${currentActivityId}`];
      
      // Find outgoing transitions (exclude transitions TO end activity for now)
      const outgoingTransitions = transitions.filter(t => 
        t.from_activity_id === currentActivityId && 
        (!endActivity || t.to_activity_id !== endActivity.id)
      );
      
      if (outgoingTransitions.length === 1) {
        // Single path - continue horizontally
        const nextActivity = activityMap[outgoingTransitions[0].to_activity_id];
        if (nextActivity && !positioned.has(nextActivity.id)) {
          const nextX = currentPos.x + xIncrement;
          positions[`Activity_${nextActivity.id}`] = { 
            x: nextX, 
            y: currentPos.y 
          };
          maxX = Math.max(maxX, nextX + xIncrement);
          positioned.add(nextActivity.id);
          queue.push(nextActivity.id);
        }
      } else if (outgoingTransitions.length > 1) {
        // Multiple paths - create branches vertically with proper spacing
        const branchSpacing = Math.max(yIncrement, 120);
        let branchY = currentPos.y - ((outgoingTransitions.length - 1) * branchSpacing / 2);
        
        // Sort transitions to ensure consistent ordering
        const sortedTransitions = outgoingTransitions.sort((a, b) => {
          if (a.condition === 'Approved') return -1;
          if (b.condition === 'Approved') return 1;
          if (a.condition === 'Rejected') return 1;
          if (b.condition === 'Rejected') return -1;
          return a.priority - b.priority;
        });
        
        sortedTransitions.forEach((transition, index) => {
          const nextActivity = activityMap[transition.to_activity_id];
          if (nextActivity && !positioned.has(nextActivity.id)) {
            const nextX = currentPos.x + xIncrement;
            const nextY = branchY + (index * branchSpacing);
            positions[`Activity_${nextActivity.id}`] = { x: nextX, y: nextY };
            maxX = Math.max(maxX, nextX + xIncrement);
            positioned.add(nextActivity.id);
            queue.push(nextActivity.id);
          }
        });
      }
    }
    
    // Position end activity at the rightmost position
    if (endActivity && !positioned.has(endActivity.id)) {
      positions[`Activity_${endActivity.id}`] = { x: maxX, y: currentY };
      positioned.add(endActivity.id);
    }
    
    // Position any remaining activities
    activities.forEach(a => {
      if (!positioned.has(a.id)) {
        positions[`Activity_${a.id}`] = { x: maxX + xIncrement, y: currentY };
        maxX += xIncrement;
      }
    });
  };
  
  layoutActivities();

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
      const targetActivity = activities.find(a => a.id === t.to_activity_id);
      
      // Calculate source dimensions and exit point
      let sourceWidth = 100, sourceHeight = 80;
      if (sourceActivity && (sourceActivity.type === 'parallelGateway' || sourceActivity.type === 'exclusiveGateway')) {
        sourceWidth = sourceHeight = 50;
      } else if (sourceActivity && (sourceActivity.type === 'start' || sourceActivity.type === 'end')) {
        sourceWidth = sourceHeight = 36;
      }
      
      // Calculate target dimensions and entry point
      let targetWidth = 100, targetHeight = 80;
      if (targetActivity && (targetActivity.type === 'parallelGateway' || targetActivity.type === 'exclusiveGateway')) {
        targetWidth = targetHeight = 50;
      } else if (targetActivity && (targetActivity.type === 'start' || targetActivity.type === 'end')) {
        targetWidth = targetHeight = 36;
      }
      
      // Calculate connection points at shape borders
      const sourceCenterX = sourcePos.x + sourceWidth / 2;
      const sourceCenterY = sourcePos.y + sourceHeight / 2;
      const targetCenterX = targetPos.x + targetWidth / 2;
      const targetCenterY = targetPos.y + targetHeight / 2;
      
      // Determine exit and entry points with proper margins
      let sourceExitX, sourceExitY, targetEntryX, targetEntryY;
      
      if (targetPos.x > sourcePos.x + sourceWidth) {
        // Target is clearly to the right - exit from right side, enter from left side
        sourceExitX = sourcePos.x + sourceWidth;
        sourceExitY = sourceCenterY;
        targetEntryX = targetPos.x;
        targetEntryY = targetCenterY;
      } else if (targetPos.x + targetWidth < sourcePos.x) {
        // Target is clearly to the left - exit from left side, enter from right side
        sourceExitX = sourcePos.x;
        sourceExitY = sourceCenterY;
        targetEntryX = targetPos.x + targetWidth;
        targetEntryY = targetCenterY;
      } else {
        // Overlapping X positions - use vertical connection
        if (targetPos.y > sourcePos.y + sourceHeight) {
          // Target below - exit from bottom, enter from top
          sourceExitX = sourceCenterX;
          sourceExitY = sourcePos.y + sourceHeight;
          targetEntryX = targetCenterX;
          targetEntryY = targetPos.y;
        } else if (targetPos.y + targetHeight < sourcePos.y) {
          // Target above - exit from top, enter from bottom
          sourceExitX = sourceCenterX;
          sourceExitY = sourcePos.y;
          targetEntryX = targetCenterX;
          targetEntryY = targetPos.y + targetHeight;
        } else {
          // Shapes overlap - use right to left connection with small offset
          sourceExitX = sourcePos.x + sourceWidth;
          sourceExitY = sourceCenterY;
          targetEntryX = targetPos.x;
          targetEntryY = targetCenterY;
        }
      }
      
      // Create waypoints for orthogonal routing with better spacing
      let waypoints = [];
      
      // Check if direct connection is appropriate (same horizontal level)
      if (Math.abs(sourceExitY - targetEntryY) < 15 && targetEntryX > sourceExitX) {
        waypoints = [
          `<di:waypoint x="${sourceExitX}" y="${sourceExitY}" />`,
          `<di:waypoint x="${targetEntryX}" y="${targetEntryY}" />`
        ];
      }
      // Orthogonal routing with proper clearance
      else {
        const horizontalGap = targetEntryX - sourceExitX;
        const verticalGap = targetEntryY - sourceExitY;
        
        if (horizontalGap > 0) {
          // Normal left-to-right flow
          const midX = sourceExitX + horizontalGap / 2;
          
          waypoints = [
            `<di:waypoint x="${sourceExitX}" y="${sourceExitY}" />`,
            `<di:waypoint x="${midX}" y="${sourceExitY}" />`,
            `<di:waypoint x="${midX}" y="${targetEntryY}" />`,
            `<di:waypoint x="${targetEntryX}" y="${targetEntryY}" />`
          ];
        } else {
          // Backward flow or complex routing
          const clearanceX = sourceExitX + 50; // Move out first
          
          waypoints = [
            `<di:waypoint x="${sourceExitX}" y="${sourceExitY}" />`,
            `<di:waypoint x="${clearanceX}" y="${sourceExitY}" />`,
            `<di:waypoint x="${clearanceX}" y="${targetEntryY}" />`,
            `<di:waypoint x="${targetEntryX}" y="${targetEntryY}" />`
          ];
        }
      }

      return `      <bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
        ${waypoints.join('\n        ')}
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
    bpmnXmlActual: bpmnXml,
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

    // Force cleanup any existing modeler
    if (bpmnModelerRef.current) {
      try {
        bpmnModelerRef.current.destroy();
        bpmnModelerRef.current = null;
      } catch (e) {
        console.warn('Error destroying old modeler:', e);
      }
    }

    // Clear container content to ensure clean state
    containerRef.current.innerHTML = '';

    const bpmnModeler = new BpmnJS({
      container: containerRef.current
    });

    bpmnModelerRef.current = bpmnModeler;

    // Wait for modeler to be fully initialized
    const initializeModeler = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Longer delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if component is still mounted and modeler exists
        if (!bpmnModelerRef.current || !containerRef.current) {
          console.log('🚫 Component unmounted or modeler destroyed, skipping initialization');
          return;
        }
        
        let xmlToLoad = null;
        
        // TEMPORARY FIX: Always generate from activities for workflow 3 to avoid corrupted XML
        if (workflowId === 3 && activities.length > 0) {
          console.log('🔧 Force generating from activities for workflow 3 (bypassing saved XML)...');
          xmlToLoad = buildBpmnFromActivities(workflowId, activities, transitions);
          console.log('✅ Generated BPMN XML (length:', xmlToLoad.length, ')');
        }
        // Priority 1: Use saved BPMN XML if it exists and is valid
        else if (bpmnXml && bpmnXml !== 'null' && isValidBpmnXml(bpmnXml)) {
          console.log('✅ Using saved BPMN XML (length:', bpmnXml.length, ')');
          xmlToLoad = bpmnXml;
        } 
        // Priority 2: Generate from activities and transitions if no saved XML
        else if (activities.length > 0) {
          console.log('🔧 No valid saved BPMN XML, generating from activities/transitions...');
          xmlToLoad = buildBpmnFromActivities(workflowId, activities, transitions);
          console.log('✅ Generated BPMN XML (length:', xmlToLoad.length, ')');
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
          
          // Check if modeler still exists before importing
          if (!bpmnModelerRef.current) {
            console.log('🚫 Modeler destroyed before import, skipping');
            return;
          }
          
          await bpmnModeler.importXML(xmlToLoad);
          console.log('✅ BPMN loaded successfully');
          
          // Auto-fit viewport with error handling
          setTimeout(() => {
            try {
              if (bpmnModelerRef.current) {
                const canvas = bpmnModeler.get('canvas');
                canvas.zoom('fit-viewport');
              }
            } catch (e) {
              console.warn('Could not auto-fit viewport:', e.message);
            }
          }, 300);
        }

        // Setup auto-save if not read-only
        if (!isReadOnly && onSave && bpmnModelerRef.current) {
          try {
            const eventBus = bpmnModeler.get('eventBus');
            eventBus.on(['commandStack.changed'], debounce(async () => {
              try {
                if (bpmnModelerRef.current) {
                  const { xml } = await bpmnModeler.saveXML({ format: true });
                  debouncedSave(xml);
                }
              } catch (error) {
                console.error('Error getting XML for auto-save:', error);
              }
            }, 1000));
          } catch (e) {
            console.warn('Could not setup auto-save:', e);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Critical error in initializeModeler:', error);
        setError('Không thể khởi tạo BPMN Editor: ' + error.message);
        setLoading(false);
      }
    };

    initializeModeler();

    return () => {
      if (bpmnModelerRef.current) {
        try {
          console.log('🧹 Cleaning up BPMN Editor');
          bpmnModelerRef.current.destroy();
          bpmnModelerRef.current = null;
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
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