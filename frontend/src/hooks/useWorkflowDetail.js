import { useState, useCallback, useEffect } from 'react';
import { workflowService } from '../services/workflowService';
import { activityService, transitionService } from '../services/dataService';

export function useWorkflowDetail(selectedWorkflowId) {
  const [workflowDetail, setWorkflowDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadWorkflowDetail = useCallback(async () => {
    if (!selectedWorkflowId) {
      setWorkflowDetail(null);
      setActivities([]);
      setTransitions([]);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const data = await workflowService.getFullDetails(selectedWorkflowId);
      
      console.log('Loaded workflow detail:', {
        id: data.workflow?.id,
        name: data.workflow?.name,
        hasBpmnXml: !!data.workflow?.bpmn_xml,
        bpmnXmlLength: data.workflow?.bpmn_xml?.length || 0
      });
      
      setWorkflowDetail(data.workflow);
      setActivities(data.activities);
      setTransitions(data.transitions);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId]);

  // Auto-load when selectedWorkflowId changes
  useEffect(() => {
    loadWorkflowDetail();
  }, [loadWorkflowDetail]);

  // Activity operations
  const createActivity = useCallback(async (data) => {
    if (!selectedWorkflowId) return { success: false, error: 'No workflow selected' };

    setError('');
    setLoading(true);
    try {
      await activityService.create(selectedWorkflowId, data);
      await loadWorkflowDetail();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, loadWorkflowDetail]);

  const updateActivity = useCallback(async (id, data) => {
    setError('');
    setLoading(true);
    try {
      await activityService.update(id, data);
      await loadWorkflowDetail();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflowDetail]);

  const deleteActivity = useCallback(async (id) => {
    setError('');
    setLoading(true);
    try {
      await activityService.delete(id);
      await loadWorkflowDetail();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflowDetail]);

  // Transition operations
  const createTransition = useCallback(async (data) => {
    if (!selectedWorkflowId) return { success: false, error: 'No workflow selected' };

    setError('');
    setLoading(true);
    try {
      await transitionService.create(selectedWorkflowId, data);
      await loadWorkflowDetail();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, loadWorkflowDetail]);

  const updateTransition = useCallback(async (id, data) => {
    setError('');
    setLoading(true);
    try {
      await transitionService.update(id, data);
      await loadWorkflowDetail();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflowDetail]);

  const deleteTransition = useCallback(async (id) => {
    setError('');
    setLoading(true);
    try {
      await transitionService.delete(id);
      await loadWorkflowDetail();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflowDetail]);

  return {
    workflowDetail,
    activities,
    transitions,
    loading,
    error,
    setError,
    loadWorkflowDetail,
    // Activity operations
    createActivity,
    updateActivity,
    deleteActivity,
    // Transition operations
    createTransition,
    updateTransition,
    deleteTransition
  };
}