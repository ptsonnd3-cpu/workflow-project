import React, { useState, useRef, useEffect } from 'react';
import BpmnJS from 'bpmn-js/dist/bpmn-modeler.development.js';
import { debounce } from '../utils';

// Helper function to create a basic BPMN diagram if missing
const createBasicBPMNDiagram = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  id="Definitions_1" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
    <bpmn:endEvent id="EndEvent_1" />
    <bpmn:sequenceFlow id="SequenceFlow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="279" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="SequenceFlow_1_di" bpmnElement="SequenceFlow_1">
        <di:waypoint x="215" y="97" />
        <di:waypoint x="279" y="97" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
};

const BPMNEditor = ({ bpmnXml, onSave, workflowId, isReadOnly = false }) => {
  const containerRef = useRef();
  const bpmnModelerRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      container: containerRef.current,
      keyboard: {
        bindTo: window
      }
    });

    bpmnModelerRef.current = bpmnModeler;

    // Load initial BPMN
    const loadBpmn = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (bpmnXml && bpmnXml.trim()) {
          console.log('Loading BPMN XML:', bpmnXml.substring(0, 200) + '...');
          
          try {
            // Try to import the XML as-is first
            const result = await bpmnModeler.importXML(bpmnXml);
            
            // Check if there are warnings but diagram loaded
            if (result.warnings && result.warnings.length > 0) {
              console.warn('BPMN import warnings:', result.warnings);
              // Don't treat warnings as errors - diagram can still be displayed
            }
            
            console.log('BPMN loaded successfully');
          } catch (importError) {
            console.error('BPMN import error:', importError);
            
            // Special handling for "no diagram to display" error
            if (importError.message.includes('no diagram to display')) {
              console.log('No diagram found, attempting to create diagram from process definition');
              
              // Try to check if there's process definition but no diagram
              try {
                // Parse XML to check structure
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(bpmnXml, 'text/xml');
                const processes = xmlDoc.getElementsByTagNameNS('*', 'process');
                const diagrams = xmlDoc.getElementsByTagNameNS('*', 'BPMNDiagram');
                
                if (processes.length > 0 && diagrams.length === 0) {
                  console.log('Found process definitions but no diagrams. Creating new diagram...');
                  // Create a new diagram and then try to preserve process elements
                  await bpmnModeler.createDiagram();
                  
                  // Try to import original XML again to get process definitions
                  try {
                    const modeling = bpmnModeler.get('modeling');
                    const elementRegistry = bpmnModeler.get('elementRegistry');
                    const canvas = bpmnModeler.get('canvas');
                    
                    // Get the root element (process)
                    const rootElement = canvas.getRootElement();
                    
                    if (rootElement) {
                      setError('Tạo lại diagram cho dữ liệu BPMN cũ. Sơ đồ hiển thị có thể không đầy đủ.');
                      console.log('Successfully created diagram with process definition');
                    }
                  } catch (diagramError) {
                    console.error('Error creating diagram:', diagramError);
                    setError('Không thể tạo diagram từ dữ liệu BPMN cũ: ' + diagramError.message);
                  }
                } else {
                  // No process definitions found
                  setError('Dữ liệu BPMN không chứa định nghĩa quy trình hợp lệ.');
                }
              } catch (parseError) {
                console.error('Error parsing BPMN XML:', parseError);
                setError('Không thể phân tích cú pháp BPMN XML.');
              }
            } else {
              // Try other fixes
              let fixedXml = bpmnXml;
              
              // Fix missing namespace declarations
              if (!bpmnXml.includes('xmlns:bpmn')) {
                fixedXml = bpmnXml.replace('<definitions', 
                  '<definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"');
              }
              
              // Try with fixed XML
              if (fixedXml !== bpmnXml) {
                try {
                  await bpmnModeler.importXML(fixedXml);
                  console.log('BPMN loaded with namespace fix');
                } catch (secondError) {
                  // If still fails, show error but don't create new diagram immediately
                  setError(`Không thể tải sơ đồ BPMN: ${importError.message}. Sơ đồ có thể bị hỏng.`);
                  console.error('Second import attempt failed:', secondError);
                }
              } else {
                // Show error but don't create new diagram
                setError(`Lỗi khi tải BPMN: ${importError.message}. Dữ liệu có thể không tương thích.`);
              }
            }
          }
        } else {
          // Only create new diagram if no XML data at all
          console.log('No BPMN XML provided, creating new diagram');
          await bpmnModeler.createDiagram();
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
        console.error('Critical error in loadBpmn:', error);
        setError('Lỗi nghiêm trọng khi khởi tạo BPMN Editor: ' + error.message);
        setLoading(false);
      }
    };

    loadBpmn();

    return () => {
      if (bpmnModelerRef.current) {
        bpmnModelerRef.current.destroy();
      }
    };
  }, [workflowId, isReadOnly]);

  // Update BPMN when prop changes
  useEffect(() => {
    if (bpmnModelerRef.current && bpmnXml && bpmnXml.trim() && !loading) {
      console.log('Updating BPMN with new XML');
      
      bpmnModelerRef.current.importXML(bpmnXml).then((result) => {
        if (result.warnings && result.warnings.length > 0) {
          console.warn('BPMN update warnings:', result.warnings);
          // Don't show warnings as errors to user
        }
        setError(null); // Clear any previous errors on successful load
      }).catch(error => {
        console.error('Error importing updated BPMN:', error);
        
        // Don't immediately show error - try to keep existing diagram
        // Only show error if it's critical
        if (error.message.includes('no parser')) {
          setError('Định dạng BPMN không được hỗ trợ.');
        } else {
          console.warn('BPMN update failed but keeping existing diagram:', error.message);
          // Don't update error state - keep existing diagram visible
        }
      });
    }
  }, [bpmnXml, loading]);

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