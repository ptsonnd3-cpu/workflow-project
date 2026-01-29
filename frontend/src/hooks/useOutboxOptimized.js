import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { outboxService } from '../services/dataService';
import { queryKeys } from '../lib/queryClient';

export function useOutboxOptimized(isActive) {
  const queryClient = useQueryClient();

  // Outbox status state (could be moved to URL params later)
  const [outboxStatus, setOutboxStatus] = React.useState('PENDING');

  // Get outbox events with caching
  const outboxQuery = useQuery({
    queryKey: queryKeys.outbox(outboxStatus),
    queryFn: () => outboxService.getAll(outboxStatus),
    enabled: isActive, // Only fetch when tab is active
    refetchInterval: isActive ? 30 * 1000 : false, // Refresh every 30 seconds when active
    staleTime: 10 * 1000, // Consider data stale after 10 seconds (outbox changes frequently)
  });

  // Retry outbox mutation
  const retryMutation = useMutation({
    mutationFn: outboxService.retry,
    onSuccess: () => {
      // Invalidate current outbox query to refetch data
      queryClient.invalidateQueries({ queryKey: queryKeys.outbox(outboxStatus) });
      // Also invalidate all outbox queries to update other status views
      queryClient.invalidateQueries({ queryKey: ['outbox'] });
    },
  });

  return {
    // Data
    outbox: outboxQuery.data || [],
    outboxStatus,
    setOutboxStatus: (status) => {
      setOutboxStatus(status);
      // Prefetch new status data
      if (isActive) {
        queryClient.prefetchQuery({
          queryKey: queryKeys.outbox(status),
          queryFn: () => outboxService.getAll(status),
        });
      }
    },
    
    // State
    isLoading: outboxQuery.isLoading,
    error: outboxQuery.error?.message || '',
    
    // Actions
    retryOutbox: async (id) => {
      try {
        await retryMutation.mutateAsync(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    // Loading states
    isRetrying: retryMutation.isPending,
    
    // Manual refresh
    refetch: outboxQuery.refetch,
    
    // Background refresh toggle
    toggleAutoRefresh: () => {
      const currentInterval = outboxQuery.refetchInterval;
      queryClient.setQueryDefaults(queryKeys.outbox(outboxStatus), {
        refetchInterval: currentInterval ? false : 30 * 1000,
      });
    },
  };
}