import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { LoadingProvider } from './contexts/LoadingContext';
import { ToastProvider } from './contexts/ToastContext';
import { PerformanceProvider } from './components/PerformanceMonitor';
import PerformanceMonitor from './components/PerformanceMonitor';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import WorkflowManagement from './WorkflowManagementNew';
import './App.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

const API_BASE = process.env.REACT_APP_API_URL;//'http://localhost:5000';

// Create Query Client with optimized configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 408, 429
        if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function buildBpmnXml(definition) {
  if (!definition) return '';
  const { workflow, activities, transitions } = definition;

  const startId = 'StartEvent_1';
  const endId = 'EndEvent_1';

  const positions = {};
  const y = 150;
  let x = 200;

  activities.forEach((a, idx) => {
    positions[`Activity_${a.id}`] = { x: x + idx * 160, y };
  });

  const startPos = { x: 100, y };
  const lastActivityKey =
    activities.length > 0 ? `Activity_${activities[activities.length - 1].id}` : null;
  const endPos = lastActivityKey
    ? { x: positions[lastActivityKey].x + 160, y }
    : { x: 260, y };

  const tasksXml = activities
    .map((a) => `<userTask id="Activity_${a.id}" name="${a.name}" />`)
    .join('\n    ');

  const sequenceFlows = [];
  const flowDiEdges = [];

  if (activities.length > 0) {
    const firstActivityId = activities[0].id;
    const flowId = 'Flow_start';
    sequenceFlows.push(
      `<sequenceFlow id="${flowId}" sourceRef="${startId}" targetRef="Activity_${firstActivityId}" />`
    );
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
    const cond = (t.condition || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    sequenceFlows.push(
      `<sequenceFlow id="${flowId}" name="${cond}" sourceRef="Activity_${t.from_activity_id}" targetRef="Activity_${t.to_activity_id}" />`
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
    sequenceFlows.push(
      `<sequenceFlow id="${flowId}" sourceRef="${lastActivityKey}" targetRef="${endId}" />`
    );
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

function WorkflowDefinitionDiagram({ runningActivityDefinitionIds, fullscreen, onClose, onOpenFull }) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const mountedRef = useRef(true);
  const [definition, setDefinition] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFlowLabels, setShowFlowLabels] = useState(true);

  const loadDefinition = async () => {
    setError('');
    const data = await apiGet('/api/workflows/1');
    setDefinition(data);
  };

  // Toggle hiển thị nhãn điều kiện trên các sequence flow
  const updateFlowLabelVisibility = (effectiveShow = showFlowLabels) => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get('canvas');
    const elementRegistry = modelerRef.current.get('elementRegistry');
    const flows = elementRegistry.filter((e) => e.type === 'bpmn:SequenceFlow');
    flows.forEach((flow) => {
      const label = flow.label;
      if (!label) return;
      if (effectiveShow) {
        canvas.removeMarker(label, 'wf-hide-label');
      } else {
        canvas.addMarker(label, 'wf-hide-label');
      }
    });
  };

  useEffect(() => {
    loadDefinition().catch((e) => setError(e.message || String(e)));
  }, []);

  // Load persisted showFlowLabels from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wf_showFlowLabels');
      if (saved !== null) {
        setShowFlowLabels(saved === '1' || saved === 'true');
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!containerRef.current || !definition) return;

    if (!modelerRef.current) {
      modelerRef.current = new BpmnModeler({
        container: containerRef.current
      });
    }

    const xml = definition?.workflow?.bpmn_xml ? definition.workflow.bpmn_xml : buildBpmnXml(definition);
    modelerRef.current
      .importXML(xml)
      .then(() => {
        if (!mountedRef.current) return;
        const canvas = modelerRef.current.get('canvas');
        const elementRegistry = modelerRef.current.get('elementRegistry');

        // clear old markers
        elementRegistry.getAll().forEach((el) => {
          canvas.removeMarker(el, 'wf-running');
        });

        // add marker to running activities
        (runningActivityDefinitionIds || []).forEach((defId) => {
          const el = elementRegistry.get(`Activity_${defId}`);
          if (el) {
            canvas.addMarker(el, 'wf-running');
          }
        });

        // safe fit-viewport: chỉ zoom khi container và viewbox hợp lệ
        const el = containerRef.current;
        const tryFit = (attempt = 0) => {
          if (!mountedRef.current) return;
          if (!el || !canvas) return;
          const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
          const w = rect ? rect.width : el.clientWidth;
          const h = rect ? rect.height : el.clientHeight;
          
          if (w > 0 && h > 0) {
            try { canvas.resized && canvas.resized(); } catch (_) {}
            // Chờ DOM ổn định thêm 2 frame trước khi zoom
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (!mountedRef.current) return;
              safeBpmnZoom(canvas, 'fit-viewport', 1.0);
            }));
          } else if (attempt < 40) {
            setTimeout(() => tryFit(attempt + 1), 50);
          }
        };
        tryFit();
        updateFlowLabelVisibility(fullscreen ? true : showFlowLabels);
      })
      .catch((e) => {
        console.error(e);
        setError(e.message || String(e));
      });

    return () => {
      // không destroy để tránh recreate nhiều lần khi re-render nhỏ
    };
  }, [definition]);

  useEffect(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get('canvas');
    const elementRegistry = modelerRef.current.get('elementRegistry');

    elementRegistry.getAll().forEach((el) => {
      canvas.removeMarker(el, 'wf-running');
    });

    (runningActivityDefinitionIds || []).forEach((defId) => {
      const el = elementRegistry.get(`Activity_${defId}`);
      if (el) canvas.addMarker(el, 'wf-running');
    });
  }, [runningActivityDefinitionIds]);

  useEffect(() => {
    updateFlowLabelVisibility(fullscreen ? true : showFlowLabels);
    try {
      localStorage.setItem('wf_showFlowLabels', showFlowLabels ? '1' : '0');
    } catch (_) {}
  }, [showFlowLabels]);

  // Áp dụng lại khi chuyển đổi fullscreen
  useEffect(() => {
    updateFlowLabelVisibility(fullscreen ? true : showFlowLabels);
  }, [fullscreen]);

  const handleSave = async () => {
    if (!modelerRef.current) return;
    setSaving(true);
    setError('');
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      await apiPost('/api/workflows/1/import-bpmn', { bpmnXml: xml });
      await loadDefinition();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (modelerRef.current) {
        try { modelerRef.current.destroy(); } catch (_) {}
        modelerRef.current = null;
      }
    },
    []
  );

  // Fit lại khi window resize
  useEffect(() => {
    const onResize = () => {
      if (!modelerRef.current) return;
      const canvas = modelerRef.current.get('canvas');
      if (!canvas) return;
      try { canvas.resized && canvas.resized(); } catch (_) {}
      // dùng lại logic fit an toàn
      const el = containerRef.current;
      const tryFit = (attempt = 0) => {
        if (!mountedRef.current) return;
        if (!el || !canvas) return;
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        const w = rect ? rect.width : el.clientWidth;
        const h = rect ? rect.height : el.clientHeight;
        
        if (w > 0 && h > 0) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!mountedRef.current) return;
            safeBpmnZoom(canvas, 'fit-viewport', 1.0);
          }));
        } else if (attempt < 20) {
          setTimeout(() => tryFit(attempt + 1), 50);
        }
      };
      tryFit();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="wf-card">
      <style>{`.wf-bpmn g.djs-element.wf-hide-label .djs-visual text { display: none !important; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <h3 className="wf-card-title" style={{ marginBottom: 0 }}>
          Workflow Definition (BPMN){fullscreen ? ' — Fullscreen' : ''}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {fullscreen ? (
            <button className="wf-btn" onClick={onClose} disabled={saving}>
              Close
            </button>
          ) : (
            <button className="wf-btn" onClick={onOpenFull} disabled={saving}>
              Zoom
            </button>
          )}
          <button className="wf-btn" onClick={() => loadDefinition().catch((e) => setError(e.message || String(e)))} disabled={saving}>
            Reload
          </button>
          {!fullscreen && (
            <label className="wf-field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showFlowLabels} onChange={(e) => setShowFlowLabels(e.target.checked)} />
              Hiện nhãn điều kiện
            </label>
          )}
          <button className="wf-btn wf-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save definition'}
          </button>
        </div>
      </div>
      {error ? (
        <div className="wf-alert">Error: {error}</div>
      ) : null}
      <div
        ref={containerRef}
        className={`wf-bpmn ${fullscreen ? 'wf-bpmn-full' : ''}`}
      />
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('demo'); // 'demo' | 'management'
  const [userId, setUserId] = useState('101');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [instanceId, setInstanceId] = useState('200');
  const [instanceDetail, setInstanceDetail] = useState(null);
  const [conditionByTaskId, setConditionByTaskId] = useState({});
  const [showBpmnFull, setShowBpmnFull] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(
    process.env.NODE_ENV === 'development'
  );

  const userOptions = useMemo(
    () => [
      { id: '101', name: 'Nguyễn A' },
      { id: '102', name: 'Trần B' },
      { id: '103', name: 'Lê C' }
    ],
    []
  );

  const runningActivityDefinitionIds = useMemo(
    () =>
      instanceDetail
        ? instanceDetail.activities
            .filter((a) => a.status === 'Running')
            .map((a) => a.activity_definition_id)
        : [],
    [instanceDetail]
  );

  const loadTasks = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiGet(`/api/users/${userId}/tasks`);
      setTasks(data);
      // preset condition cho mỗi task
      const next = {};
      data.forEach((t) => {
        next[t.id] = conditionByTaskId[t.id] || 'Done';
      });
      setConditionByTaskId(next);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadInstance = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiGet(`/api/workflow-instances/${instanceId}`);
      setInstanceDetail(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    loadInstance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const completeTask = async (taskId) => {
    setError('');
    setLoading(true);
    try {
      const condition = conditionByTaskId[taskId] || 'Done';
      await apiPost(`/api/tasks/${taskId}/complete`, {
        actorUserId: Number(userId),
        condition
      });
      await Promise.all([loadTasks(), loadInstance()]);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  if (currentView === 'management') {
    return (
      <QueryClientProvider client={queryClient}>
        <PerformanceProvider>
          <ToastProvider>
            <LoadingProvider>
              <WorkflowManagement onBack={() => setCurrentView('demo')} />
              <PerformanceMonitor 
                show={showPerformanceMonitor}
                onToggle={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
              />
            </LoadingProvider>
          </ToastProvider>
        </PerformanceProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <LoadingProvider>
          <div className="wf-page">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Workflow Demo</h2>
          <p className="wf-subtitle">
        Mục tiêu: xem task theo user và bấm Complete để workflow tự chuyển bước theo condition.
      </p>
        </div>
        <button className="wf-btn wf-btn-primary" onClick={() => setCurrentView('management')}>
          Quản lý Workflow Definitions →
        </button>
      </div>

      <div className="wf-toolbar">
        <label className="wf-field">
          User
          <select className="wf-control" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id} - {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="wf-field">
          WorkflowInstance ID
          <input
            className="wf-control"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            inputMode="numeric"
          />
        </label>

        <button className="wf-btn" onClick={loadTasks} disabled={loading}>
          Reload Tasks
        </button>
        <button className="wf-btn" onClick={loadInstance} disabled={loading}>
          Reload Instance
        </button>
      </div>

      {error ? (
        <div className="wf-alert">
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div className="wf-grid">
        <div className="wf-card">
          <h3 className="wf-card-title">My Tasks</h3>
          {loading && tasks.length === 0 ? <div>Loading...</div> : null}
          {tasks.length === 0 ? <div className="wf-muted">Không có task.</div> : null}

          {tasks.map((t) => (
            <div key={t.id} className="wf-row">
              <div>
                <b>Task #{t.id}</b> — {t.activity_name} (activityDef: {t.activity_definition_id})
              </div>
              <div className="wf-muted">
                instance state: {t.state} — business_id: {t.business_id}
              </div>

              <div className="wf-task-actions">
                <label className="wf-field">
                  Condition
                  <select
                    className="wf-control"
                    value={conditionByTaskId[t.id] || 'Done'}
                    onChange={(e) =>
                      setConditionByTaskId((prev) => ({
                        ...prev,
                        [t.id]: e.target.value
                      }))
                    }
                  >
                    <option value="Done">Done</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>

                <button className="wf-btn wf-btn-primary" onClick={() => completeTask(t.id)} disabled={loading}>
                  Complete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="wf-card">
          <h3 className="wf-card-title">Workflow Instance Detail</h3>
          {loading && !instanceDetail ? <div>Loading...</div> : null}
          {!instanceDetail ? <div className="wf-muted">Chưa có dữ liệu instance.</div> : null}

          {instanceDetail ? (
            <>
              <div className="wf-muted" style={{ marginBottom: 8 }}>
                instance #{instanceDetail.instance.id} — state: {instanceDetail.instance.state} — business_id:{' '}
                {instanceDetail.instance.business_id}
              </div>

              <div>
                <b>Activities</b>
                {instanceDetail.activities.map((a) => (
                  <div key={a.id} className="wf-row" style={{ paddingTop: 6, marginTop: 6 }}>
                    #{a.id} — {a.activity_name} ({a.activity_type}) — <b>{a.status}</b>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <b>Transition Log</b>
                {instanceDetail.logs.length === 0 ? <div className="wf-muted">Chưa có log.</div> : null}
                {instanceDetail.logs.map((l) => (
                  <div key={l.id} className="wf-row" style={{ paddingTop: 6, marginTop: 6 }}>
                    #{l.id}: {l.condition} — {l.from_activity_instance_id} → {l.to_activity_instance_id} — by user{' '}
                    {l.acted_by_user_id}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <WorkflowDefinitionDiagram
          runningActivityDefinitionIds={runningActivityDefinitionIds}
          fullscreen={false}
          onOpenFull={() => setShowBpmnFull(true)}
        />
      </div>
      {showBpmnFull && (
        <div className="wf-modal-backdrop" onClick={() => setShowBpmnFull(false)}>
          <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
            <WorkflowDefinitionDiagram
              runningActivityDefinitionIds={runningActivityDefinitionIds}
              fullscreen
              onClose={() => setShowBpmnFull(false)}
            />
          </div>
        </div>
      )}
        </div>
      </LoadingProvider>
      </ToastProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
