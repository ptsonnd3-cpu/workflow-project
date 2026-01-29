import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowService } from '../services/workflowService';
import { queryKeys } from '../lib/queryClient';

// Workflow detail hook
export function useWorkflowDetailOptimized(workflowId) {
  const queryClient = useQueryClient();

  const workflowDetailQuery = useQuery({
    queryKey: queryKeys.workflowDetail(workflowId),
    queryFn: () => workflowService.getFullDetails(workflowId),
    enabled: !!workflowId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const createActivityMutation = useMutation({
    mutationFn: ({ workflowId, data }) => workflowService.createActivity(workflowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, data }) => workflowService.updateActivity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: workflowService.deleteActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
    },
  });

  const createTransitionMutation = useMutation({
    mutationFn: ({ workflowId, data }) => workflowService.createTransition(workflowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
    },
  });

  const updateTransitionMutation = useMutation({
    mutationFn: ({ id, data }) => workflowService.updateTransition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
    },
  });

  const deleteTransitionMutation = useMutation({
    mutationFn: workflowService.deleteTransition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
    },
  });

  return {
    workflowDetail: workflowDetailQuery.data?.workflow,
    activities: workflowDetailQuery.data?.activities || [],
    transitions: workflowDetailQuery.data?.transitions || [],
    loading: workflowDetailQuery.isLoading,
    error: workflowDetailQuery.error?.message || '',
    
    loadWorkflowDetail: () => workflowDetailQuery.refetch(),
    
    createActivity: async (data) => {
      try {
        const result = await createActivityMutation.mutateAsync({ workflowId, data });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    updateActivity: async (id, data) => {
      try {
        const result = await updateActivityMutation.mutateAsync({ id, data });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    deleteActivity: async (id) => {
      try {
        await deleteActivityMutation.mutateAsync(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    createTransition: async (data) => {
      try {
        const result = await createTransitionMutation.mutateAsync({ workflowId, data });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    updateTransition: async (id, data) => {
      try {
        const result = await updateTransitionMutation.mutateAsync({ id, data });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    deleteTransition: async (id) => {
      try {
        await deleteTransitionMutation.mutateAsync(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    setError: (err) => {
      console.error('Workflow detail error:', err);
    }
  };
}

// Outbox hook  
export function useOutboxOptimized() {
  const outboxQuery = useQuery({
    queryKey: ['outbox'],
    queryFn: () => workflowService.getOutbox(),
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    outboxData: outboxQuery.data || [],
    loading: outboxQuery.isLoading,
    error: outboxQuery.error?.message || '',
    refreshOutbox: () => outboxQuery.refetch(),
  };
}

export function useWorkflowsOptimized() {
  const queryClient = useQueryClient();

  // Get all workflows with caching
  const workflowsQuery = useQuery({
    queryKey: queryKeys.workflows,
    queryFn: workflowService.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create workflow mutation
  const createMutation = useMutation({
    mutationFn: workflowService.create,
    onSuccess: () => {
      // Invalidate and refetch workflows list
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
    onError: (error) => {
      console.error('Create workflow failed:', error);
    },
  });

  // Update workflow mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => workflowService.update(id, data),
    onSuccess: (data, { id }) => {
      // Update the workflows list cache
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
      // Also invalidate the specific workflow detail if cached
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(id) });
    },
  });

  // Delete workflow mutation
  const deleteMutation = useMutation({
    mutationFn: workflowService.delete,
    onSuccess: (data, deletedId) => {
      // Remove from workflows list cache
      queryClient.setQueryData(queryKeys.workflows, (oldData) => {
        return oldData?.filter(wf => wf.id !== deletedId) || [];
      });
      // Remove workflow detail from cache
      queryClient.removeQueries({ queryKey: queryKeys.workflowDetail(deletedId) });
    },
  });

  // Demo workflow mutations
  const createDemoMutation = useMutation({
    mutationFn: ({ type, data }) => {
      if (type === 'basic') {
        return workflowService.createApprovalWorkflow(data);
      } else if (type === 'advanced') {
        return workflowService.createAdvancedApprovalWorkflow(data);
      }
      throw new Error('Unknown demo type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });

  return {
    // Data
    workflows: workflowsQuery.data || [],
    loading: workflowsQuery.isLoading,
    error: workflowsQuery.error?.message || '',
    
    // Actions
    loadWorkflows: () => workflowsQuery.refetch(),
    
    createWorkflow: async (data) => {
      try {
        const result = await createMutation.mutateAsync(data);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    updateWorkflow: async (id, data) => {
      try {
        const result = await updateMutation.mutateAsync({ id, data });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    deleteWorkflow: async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    createDemoWorkflow: async (type, data) => {
      try {
        const result = await createDemoMutation.mutateAsync({ type, data });
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCreatingDemo: createDemoMutation.isPending,
    
    // Error handling
    setError: (err) => {
      console.error('Setting error:', err);
    },
    
    // Refresh function
    refetch: workflowsQuery.refetch,
  };
}