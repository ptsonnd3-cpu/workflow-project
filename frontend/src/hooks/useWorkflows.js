import { useState, useCallback } from 'react';
import { workflowService } from '../services/workflowService';
import { activityService, transitionService } from '../services/dataService';

export function useWorkflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadWorkflows = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await workflowService.getAll();
      setWorkflows(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorkflow = useCallback(async (data) => {
    setError('');
    setLoading(true);
    try {
      await workflowService.create(data);
      await loadWorkflows();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflows]);

  const updateWorkflow = useCallback(async (id, data) => {
    setError('');
    setLoading(true);
    try {
      await workflowService.update(id, data);
      await loadWorkflows();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflows]);

  const deleteWorkflow = useCallback(async (id) => {
    setError('');
    setLoading(true);
    try {
      await workflowService.delete(id);
      await loadWorkflows();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflows]);

  const createDemoWorkflow = useCallback(async (type, data) => {
    setError('');
    setLoading(true);
    try {
      let result;
      if (type === 'basic') {
        result = await workflowService.createApprovalWorkflow(data);
      } else if (type === 'advanced') {
        result = await workflowService.createAdvancedApprovalWorkflow(data);
      }
      await loadWorkflows();
      return { success: true, data: result };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadWorkflows]);

  return {
    workflows,
    loading,
    error,
    loadWorkflows,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    createDemoWorkflow,
    setError
  };
}