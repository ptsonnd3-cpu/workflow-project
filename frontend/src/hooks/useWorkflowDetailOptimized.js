import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowService } from '../services/workflowService';
import { activityService, transitionService } from '../services/dataService';
import { queryKeys } from '../lib/queryClient';

export function useWorkflowDetailOptimized(selectedWorkflowId) {
  const queryClient = useQueryClient();

  // Get workflow full details with caching
  const workflowDetailQuery = useQuery({
    queryKey: queryKeys.workflowDetail(selectedWorkflowId),
    queryFn: () => workflowService.getFullDetails(selectedWorkflowId),
    enabled: !!selectedWorkflowId, // Only run query if we have an ID
    staleTime: 3 * 60 * 1000, // 3 minutes for detail data
  });

  // Activity mutations
  const createActivityMutation = useMutation({
    mutationFn: (data) => activityService.create(selectedWorkflowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, data }) => activityService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: activityService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  // Transition mutations
  const createTransitionMutation = useMutation({
    mutationFn: (data) => transitionService.create(selectedWorkflowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  const updateTransitionMutation = useMutation({
    mutationFn: ({ id, data }) => transitionService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  const deleteTransitionMutation = useMutation({
    mutationFn: transitionService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  // BPMN save mutation
  const saveBpmnMutation = useMutation({
    mutationFn: (bpmnXml) => workflowService.saveBpmnXml(selectedWorkflowId, bpmnXml),
    onSuccess: () => {
      // Update the workflow detail cache with new BPMN XML
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(selectedWorkflowId) });
    },
  });

  // Extract data from query result
  const workflowDetail = workflowDetailQuery.data?.workflow || null;
  const activities = workflowDetailQuery.data?.activities || [];
  const transitions = workflowDetailQuery.data?.transitions || [];

  return {
    // Data
    workflowDetail,
    activities,
    transitions,
    isLoading: workflowDetailQuery.isLoading,
    error: workflowDetailQuery.error?.message || '',

    // Activity operations
    createActivity: async (data) => {
      try {
        const result = await createActivityMutation.mutateAsync(data);
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

    // Transition operations
    createTransition: async (data) => {
      try {
        const result = await createTransitionMutation.mutateAsync(data);
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

    // BPMN operations
    saveBpmnXml: async (bpmnXml) => {
      try {
        await saveBpmnMutation.mutateAsync(bpmnXml);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    // Loading states for mutations
    isCreatingActivity: createActivityMutation.isPending,
    isUpdatingActivity: updateActivityMutation.isPending,
    isDeletingActivity: deleteActivityMutation.isPending,
    isCreatingTransition: createTransitionMutation.isPending,
    isUpdatingTransition: updateTransitionMutation.isPending,
    isDeletingTransition: deleteTransitionMutation.isPending,
    isSavingBpmn: saveBpmnMutation.isPending,

    // Refresh function
    refetch: workflowDetailQuery.refetch,
  };
}