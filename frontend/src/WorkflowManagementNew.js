import React, { useEffect, useState, Suspense, lazy } from 'react';
import './App.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

// Contexts
import { useToast } from './contexts/ToastContext';

// Hooks
import { useWorkflowsOptimized, useWorkflowDetailOptimized, useOutboxOptimized } from './hooks/useWorkflowsOptimized';

// Skeleton loaders
import { WorkflowListSkeleton, WorkflowDetailSkeleton, BPMNEditorSkeleton } from './components/SkeletonLoaders';

// Error boundary
import ErrorBoundary from './components/ErrorBoundary';

// Components
import Modal, { ConfirmModal } from './components/Modal';
import ProgressBar from './components/ProgressBar';
import WorkflowList from './components/WorkflowEditor/WorkflowList';
import ActivityPanel from './components/WorkflowEditor/ActivityPanel';
import TransitionPanel from './components/WorkflowEditor/TransitionPanel';
import OutboxPanel from './components/WorkflowEditor/OutboxPanel';

// Lazy load heavy components
const BPMNEditor = lazy(() => import('./components/BPMNEditor'));
const WorkflowFormLazy = lazy(() => import('./components/Forms/WorkflowForm'));
const ActivityFormLazy = lazy(() => import('./components/Forms/ActivityForm'));
const TransitionFormLazy = lazy(() => import('./components/Forms/TransitionForm'));

function WorkflowManagement({ onBack }) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [activeTab, setActiveTab] = useState('activities'); // activities | transitions | bpmn | outbox
  const [showForm, setShowForm] = useState(null); // 'workflow' | 'activity' | 'transition' | null
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [operationProgress, setOperationProgress] = useState(0);

  // Contexts
  const toast = useToast();

  // Workflows hook with React Query
  const {
    workflows,
    loading: workflowsLoading,
    error: workflowsError,
    loadWorkflows,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    createDemoWorkflow,
    setError: setWorkflowsError
  } = useWorkflowsOptimized();

  // Workflow detail hook with React Query
  const {
    workflowDetail,
    activities,
    transitions,
    loading: detailLoading,
    error: detailError,
    setError: setDetailError,
    loadWorkflowDetail,
    createActivity,
    updateActivity,
    deleteActivity,
    createTransition,
    updateTransition,
    deleteTransition
  } = useWorkflowDetailOptimized(selectedWorkflowId);

  // Outbox hook with React Query
  const { 
    outboxData, 
    loading: outboxLoading, 
    error: outboxError,
    refreshOutbox 
  } = useOutboxOptimized();

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Handlers
  const handleSelectWorkflow = (id) => {
    setSelectedWorkflowId(id);
    setActiveTab('activities');
  };

  const handleCreateWorkflow = () => {
    setShowForm('workflow');
    setEditingItem(null);
  };

  const handleEditWorkflow = (workflow) => {
    setShowForm('workflow');
    setEditingItem(workflow);
  };

  const handleDeleteWorkflow = async (id, name) => {
    setShowDeleteConfirm({ type: 'workflow', id, name });
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    
    try {
      const { type, id, name } = showDeleteConfirm;
      
      let result;
      if (type === 'workflow') {
        result = await deleteWorkflow(id);
      } else if (type === 'activity') {
        result = await deleteActivity(id);
      } else if (type === 'transition') {
        result = await deleteTransition(id);
      }
      
      if (result?.success) {
        toast.success(`Đã xóa ${type === 'workflow' ? 'workflow' : type === 'activity' ? 'activity' : 'transition'} "${name}" thành công!`);
        
        if (type === 'workflow' && selectedWorkflowId === id) {
          setSelectedWorkflowId(null);
        }
      } else {
        toast.error(`Không thể xóa ${type}. Vui lòng thử lại.`);
      }
      
    } catch (error) {
      toast.error(`Lỗi khi xóa: ${error.message}`);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const handleCreateDemoWorkflow = async (type) => {
    const data = {
      name: type === 'basic' ? 'Quy trình phê duyệt với thông báo' : 'Quy trình phê duyệt nâng cao',
      description: type === 'basic' 
        ? 'Workflow mẫu: Soạn đơn → Lãnh đạo phê duyệt → Gửi thông báo tự động'
        : 'Workflow với xử lý từ chối thông minh: Song song gửi thông báo + quay về soạn lại'
    };
    
    const result = await createDemoWorkflow(type, data);
    if (result.success) {
      setSelectedWorkflowId(result.data.workflowId);
      const message = `${result.data.message}`;
      const details = type === 'basic' 
        ? `Hướng dẫn sử dụng: ${Object.values(result.data.usage).join(', ')}`
        : `Tính năng nâng cao: ${Object.entries(result.data.features).map(([k,v]) => v).join(', ')}. Hướng dẫn: ${Object.values(result.data.usage).join(', ')}`;
      
      toast.success(message);
      toast.info(details, 8000);
    } else {
      toast.error(result.error || 'Có lỗi khi tạo demo workflow');
    }
  };

  const handleWorkflowFormSubmit = async (data) => {
    try {
      console.log('Creating workflow:', data);

      setOperationProgress(20);
      
      const result = editingItem 
        ? await updateWorkflow(editingItem.id, data)
        : await createWorkflow(data);
      
      console.log('Workflow creation result:', result);
      setOperationProgress(80);
      
      if (result.success) {
        console.log('Showing success toast...');
        toast.success(
          editingItem 
            ? `Đã cập nhật workflow "${data.name}" thành công!`
            : `Đã tạo workflow "${data.name}" thành công!`
        );
        setShowForm(null);
        setEditingItem(null);
        
        if (editingItem && selectedWorkflowId === editingItem.id) {
          await loadWorkflowDetail();
        }
      } else {
        console.log('Showing error toast...');
        toast.error(result.error || 'Có lỗi xảy ra khi lưu workflow');
      }
      
      setOperationProgress(100);
      setTimeout(() => setOperationProgress(0), 1000);
      
    } catch (error) {
      toast.error(`Lỗi: ${error.message}`);
      setOperationProgress(0);
    } finally {

    }
  };

  // Activity handlers
  const handleCreateActivity = () => {
    setShowForm('activity');
    setEditingItem(null);
  };

  const handleEditActivity = (activity) => {
    setShowForm('activity');
    setEditingItem(activity);
  };

  const handleDeleteActivity = async (id, name) => {
    setShowDeleteConfirm({ type: 'activity', id, name });
  };

  const handleActivityFormSubmit = async (data) => {
    try {

      
      const result = editingItem
        ? await updateActivity(editingItem.id, data)
        : await createActivity(data);
      
      if (result.success) {
        toast.success(
          editingItem 
            ? `Đã cập nhật activity "${data.name}" thành công!`
            : `Đã tạo activity "${data.name}" thành công!`
        );
        setShowForm(null);
        setEditingItem(null);
      } else {
        toast.error(result.error || 'Có lỗi xảy ra khi lưu activity');
      }
    } catch (error) {
      toast.error(`Lỗi: ${error.message}`);
    } finally {

    }
  };

  // Transition handlers
  const handleCreateTransition = () => {
    setShowForm('transition');
    setEditingItem(null);
  };

  const handleEditTransition = (transition) => {
    setShowForm('transition');
    setEditingItem(transition);
  };

  const handleDeleteTransition = async (id, name) => {
    setShowDeleteConfirm({ type: 'transition', id, name });
  };

  const handleTransitionFormSubmit = async (data) => {
    try {

      
      const result = editingItem
        ? await updateTransition(editingItem.id, data)
        : await createTransition(data);
      
      if (result.success) {
        toast.success(
          editingItem 
            ? `Đã cập nhật transition thành công!`
            : `Đã tạo transition thành công!`
        );
        setShowForm(null);
        setEditingItem(null);
      } else {
        toast.error(result.error || 'Có lỗi xảy ra khi lưu transition');
      }
    } catch (error) {
      toast.error(`Lỗi: ${error.message}`);
    } finally {

    }
  };

  const handleFormCancel = () => {
    setShowForm(null);
    setEditingItem(null);
  };

  // Error handling với toast notifications
  const error = workflowsError || detailError;
  React.useEffect(() => {
    if (error) {
      toast.error(`Lỗi: ${error}`);
    }
  }, [error, toast]);

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

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginTop: 16 }}>
        {/* Sidebar: Danh sách workflows */}
        {workflowsLoading ? (
          <WorkflowListSkeleton count={3} />
        ) : (
          <WorkflowList
            workflows={workflows}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={handleSelectWorkflow}
            onCreateWorkflow={handleCreateWorkflow}
            onEditWorkflow={handleEditWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
            onCreateDemoWorkflow={handleCreateDemoWorkflow}
            loading={workflowsLoading}
          />
        )}

        {/* Main: Chi tiết workflow */}
        <div className="wf-card">
          {!selectedWorkflowId ? (
            <div className="wf-muted">Chọn một workflow từ danh sách bên trái để xem chi tiết.</div>
          ) : detailLoading ? (
            <WorkflowDetailSkeleton />
          ) : (
            <ErrorBoundary>
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
                <ActivityPanel
                  activities={activities}
                  onCreateActivity={handleCreateActivity}
                  onEditActivity={handleEditActivity}
                  onDeleteActivity={handleDeleteActivity}
                />
              )}

              {activeTab === 'transitions' && (
                <TransitionPanel
                  transitions={transitions}
                  activities={activities}
                  onCreateTransition={handleCreateTransition}
                  onEditTransition={handleEditTransition}
                  onDeleteTransition={handleDeleteTransition}
                />
              )}

              {activeTab === 'bpmn' && (
                <Suspense fallback={<BPMNEditorSkeleton />}>
                  <BPMNEditor
                    bpmnXml={workflowDetail?.bpmn_xml}
                    onSave={async (workflowId, xml) => {
                      // Save BPMN XML logic here
                      const response = await fetch(`/api/workflows/${workflowId}/save-bpmn-xml`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bpmnXml: xml })
                      });
                      if (!response.ok) throw new Error('Failed to save BPMN');
                      await loadWorkflowDetail(); // Refresh data
                    }}
                    workflowId={selectedWorkflowId}
                  />
                </Suspense>
              )}

              {activeTab === 'outbox' && (
                <OutboxPanel 
                  isActive={activeTab === 'outbox'} 
                  data={outboxData}
                  loading={outboxLoading}
                  error={outboxError}
                  onRefresh={refreshOutbox}
                />
              )}
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Forms */}
      {showForm === 'workflow' && (
        <Suspense fallback={<div>Đang tải form...</div>}>
          <WorkflowFormLazy
            workflow={editingItem}
            onSubmit={handleWorkflowFormSubmit}
            onCancel={handleFormCancel}
            loading={workflowsLoading}
          />
        </Suspense>
      )}

      {showForm === 'activity' && (
        <Suspense fallback={<div>Đang tải form...</div>}>
          <ActivityFormLazy
            activity={editingItem}
            onSubmit={handleActivityFormSubmit}
            onCancel={handleFormCancel}
            loading={detailLoading}
          />
        </Suspense>
      )}

      {showForm === 'transition' && (
        <Suspense fallback={<div>Đang tải form...</div>}>
          <TransitionFormLazy
            transition={editingItem}
            activities={activities}
            onSubmit={handleTransitionFormSubmit}
            onCancel={handleFormCancel}
            loading={detailLoading}
          />
        </Suspense>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Xác nhận xóa"
        message={showDeleteConfirm ? 
          `Bạn có chắc chắn muốn xóa ${showDeleteConfirm.type === 'workflow' ? 'workflow' : showDeleteConfirm.type} "${showDeleteConfirm.name}"?` : 
          ""
        }
        confirmText="Xóa"
        cancelText="Hủy"
        variant="danger"
      />

      {/* Progress Bar for operations */}
      {operationProgress > 0 && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 9999 
        }}>
          <ProgressBar
            value={operationProgress}
            size="small"
            variant="primary"
            showPercentage={false}
            animated={operationProgress < 100}
          />
        </div>
      )}
    </div>
  );
}

export default WorkflowManagement;